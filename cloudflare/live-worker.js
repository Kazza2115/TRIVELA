// TRIVELA — Worker Cloudflare : scores en direct API-Football → Supabase (match_live + match_goals)
// Cron 1 min, avec une boucle interne (~14 s) → mise à jour quasi temps réel.
// Mapping FIABLE par fixture_id (groupes + élimination directe) via buildFixtureMap.
// Secrets (wrangler secret put) : API_FOOTBALL_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// ⚠️ QUOTA API : on n'appelle l'API football QUE si au moins un match est dans sa
// fenêtre de jeu (coup d'envoi → fin). Hors match, le cron sort immédiatement après
// 2 lectures Supabase (gratuites) → ZÉRO appel à l'API football. Cette fenêtre est
// déterminée à partir de match_schedule (kickoff) et de match_results (déjà réglé).
import { buildFixtureMap } from '../scripts/wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const API = 'https://v3.football.api-sports.io'
const FINISHED = new Set(['FT', 'AET', 'PEN'])
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Fenêtre de jeu d'un match : on commence à suivre 5 min avant le coup d'envoi,
// et jusqu'à 150 min après (couvre prolongations + tirs au but + arrêts de jeu).
// Un match déjà réglé (présent dans match_results) sort de la fenêtre immédiatement.
const PREROLL_MS = 5 * 60 * 1000
const MAX_DURATION_MS = 150 * 60 * 1000

// Y a-t-il au moins un match à suivre MAINTENANT ?
// N'utilise QUE Supabase (REST) → aucun appel à l'API football, donc aucun quota consommé.
// Échec de lecture (Supabase indisponible) → on NE lance PAS le suivi : sans accès au
// planning on ne saurait de toute façon pas où écrire, et on protège le quota.
async function hasActiveMatch(sb) {
  try {
    const now = Date.now()
    const sres = await sb('match_schedule?select=match_id,kickoff')
    if (!sres.ok) return false
    const sched = await sres.json()
    const rres = await sb('match_results?select=match_id')
    const settled = rres.ok ? new Set((await rres.json()).map(r => r.match_id)) : new Set()
    return sched.some(s => {
      if (settled.has(s.match_id)) return false
      const k = Date.parse(s.kickoff)
      return Number.isFinite(k) && now >= k - PREROLL_MS && now <= k + MAX_DURATION_MS
    })
  } catch { return false }
}

function scorersFrom(events, homeId) {
  return (events || [])
    .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
    .map(e => {
      const og = e.detail === 'Own Goal'
      const playerHome = e.team?.id === homeId
      const side = og ? (playerHome ? 'away' : 'home') : (playerHome ? 'home' : 'away')
      return { p: e.player?.name || '?', s: side, t: e.time?.elapsed ?? null, og, pen: e.detail === 'Penalty' }
    })
}

function clients(env) {
  const KEY = env.API_FOOTBALL_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
  const api = path => fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
  const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  return { api, sb, ok: !!(KEY && SERVICE) }
}

async function buildContext(api, sb) {
  try {
    const sres = await sb('match_schedule?select=match_id')
    const validIds = sres.ok ? new Set((await sres.json()).map(r => r.match_id)) : new Set()
    const all = (await api('/fixtures?league=1&season=2026')).response || []
    return { map: buildFixtureMap(all, validIds).map, all }
  } catch { return { map: new Map(), all: [] } }
}

async function settleOne(api, sb, id, f, haveGoals) {
  await sb('rpc/settle_match', {
    method: 'POST', body: JSON.stringify({ p_match_id: id, p_home_score: f.goals.home, p_away_score: f.goals.away }),
  })
  if (!haveGoals.has(id) && (f.goals.home + f.goals.away) > 0) {
    try {
      const ev = await api(`/fixtures/events?fixture=${f.fixture?.id}`)
      await sb('match_goals?on_conflict=match_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ match_id: id, scorers: scorersFrom(ev.response, f.teams?.home?.id), updated_at: new Date().toISOString() }]),
      })
    } catch { /* ignore */ }
  }
}

// Règle (débloque les pronos) les matchs terminés — dès la minute suivant la fin.
async function settleAll(api, sb, all, fxMap) {
  const er = await sb('match_results?select=match_id')
  const have = er.ok ? new Set((await er.json()).map(r => r.match_id)) : new Set()
  const eg = await sb('match_goals?select=match_id')
  const haveGoals = eg.ok ? new Set((await eg.json()).map(r => r.match_id)) : new Set()
  const jobs = []
  for (const f of all) {
    const id = fxMap.get(f.fixture?.id)
    const st = f.fixture?.status?.short
    if (id && !have.has(id) && FINISHED.has(st) && f.goals?.home != null && f.goals?.away != null) {
      jobs.push(settleOne(api, sb, id, f, haveGoals))
    }
  }
  if (jobs.length) await Promise.all(jobs)
}

async function poll(api, sb, fxMap) {
  const writeGoals = async (matchId, fixtureId, homeId) => {
    try {
      const ev = await api(`/fixtures/events?fixture=${fixtureId}`)
      const scorers = scorersFrom(ev.response, homeId)
      await sb('match_goals?on_conflict=match_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ match_id: matchId, scorers, updated_at: new Date().toISOString() }]),
      })
    } catch { /* ignore */ }
  }

  const rows = [], goalJobs = []
  // Matchs de Coupe du Monde en direct (mappés par fixture_id)
  const data = await api('/fixtures?league=1&season=2026&live=all')
  for (const f of (data.response || [])) {
    const id = fxMap.get(f.fixture?.id)
    if (!id) continue
    rows.push({
      match_id: id, status: f.fixture?.status?.short || 'LIVE', elapsed: f.fixture?.status?.elapsed ?? null,
      home_score: f.goals?.home ?? 0, away_score: f.goals?.away ?? 0, updated_at: new Date().toISOString(),
    })
    if ((f.goals?.home ?? 0) + (f.goals?.away ?? 0) > 0) goalJobs.push(writeGoals(id, f.fixture?.id, f.teams?.home?.id))
  }

  const ids = rows.map(r => r.match_id)
  if (ids.length) await sb(`match_live?match_id=not.in.(${ids.join(',')})`, { method: 'DELETE' })
  else await sb('match_live?match_id=not.is.null', { method: 'DELETE' })
  if (rows.length) await sb('match_live?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  if (goalJobs.length) await Promise.all(goalJobs)
  return rows.length
}

// Boucle ~5 passages espacés de 12 s → couvre toute la minute du cron sans trou
// (≈12 s de granularité) pour des scores/buts/cartons en direct sans accroc.
async function runLoop(env) {
  const { api, sb, ok } = clients(env)
  if (!ok) return
  // Aucun match dans sa fenêtre de jeu → on s'arrête AVANT tout appel à l'API football.
  if (!(await hasActiveMatch(sb))) return
  const { map: fxMap, all } = await buildContext(api, sb)
  try { await settleAll(api, sb, all, fxMap) } catch (e) { console.log('settle err', String(e)) }
  for (let i = 0; i < 5; i++) {
    try { await poll(api, sb, fxMap) } catch (e) { console.log('poll err', String(e)) }
    if (i < 4) await sleep(12000)
  }
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(runLoop(env)) },
  async fetch(req, env) {
    const { api, sb, ok } = clients(env)
    if (!ok) return new Response('secrets manquants', { status: 500 })
    // Par défaut on respecte la fenêtre de jeu (zéro appel API hors match).
    // ?force=1 force un passage pour un test manuel.
    const force = new URL(req.url).searchParams.get('force') === '1'
    if (!force && !(await hasActiveMatch(sb))) {
      return new Response('aucun match en cours — appel API ignoré (ajoute ?force=1 pour forcer)')
    }
    const { map: fxMap, all } = await buildContext(api, sb)
    await settleAll(api, sb, all, fxMap)
    const n = await poll(api, sb, fxMap)
    return new Response(`live: ${n} (map: ${fxMap.size})`)
  },
}
