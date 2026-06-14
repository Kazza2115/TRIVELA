// TRIVELA — Worker Cloudflare : scores en direct API-Football → Supabase (match_live + match_goals)
// Cron 1 min, avec une boucle interne (~14 s) → mise à jour quasi temps réel.
// Mapping FIABLE par fixture_id (groupes + élimination directe) via buildFixtureMap.
// Secrets (wrangler secret put) : API_FOOTBALL_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// ⚠️ QUOTA API : on n'appelle l'API football QUE si au moins un match est dans sa
// fenêtre de jeu (coup d'envoi → fin). Hors match, le cron sort immédiatement après
// 2 lectures Supabase (gratuites) → ZÉRO appel à l'API football. Cette fenêtre est
// déterminée à partir de match_schedule (kickoff) et de match_results (déjà réglé).
import { buildFixtureMap, orient, settleViaRest, reconcileScores, SETTLE_GRACE_MS } from '../scripts/wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const API = 'https://v3.football.api-sports.io'
const FINISHED = new Set(['FT', 'AET', 'PEN'])
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Fenêtre de jeu d'un match : on commence à suivre 5 min avant le coup d'envoi,
// et jusqu'à 3 h 30 après (couvre arrêts de jeu LONGS + prolongations + tirs au but).
// Un match déjà réglé (présent dans match_results) sort de la fenêtre immédiatement,
// et tant qu'il est suivi en direct sa fin réelle est captée quoi qu'il arrive.
const PREROLL_MS = 5 * 60 * 1000
const MAX_DURATION_MS = 210 * 60 * 1000

// Nettoyage du « en direct » — lecture Supabase UNIQUEMENT (zéro appel API football,
// donc aucun quota consommé). Tourne à CHAQUE minute, même hors fenêtre de match :
// retire de match_live tout match déjà réglé OU dont la durée max (kickoff + 150 min)
// est dépassée. Garantit qu'aucun match ne reste « en direct » après sa fin, même si
// l'API a eu un creux ou si le règlement a échoué/raté.
async function cleanupLive(sb) {
  try {
    const lr = await sb('match_live?select=match_id')
    if (!lr.ok) return
    const liveIds = new Set((await lr.json()).map(r => r.match_id))
    if (!liveIds.size) return
    const toDelete = new Set()
    const rr = await sb('match_results?select=match_id')
    if (rr.ok) for (const r of await rr.json()) if (liveIds.has(r.match_id)) toDelete.add(r.match_id)
    const sr = await sb('match_schedule?select=match_id,kickoff')
    if (sr.ok) {
      const now = Date.now()
      for (const s of await sr.json()) {
        const k = Date.parse(s.kickoff)
        if (liveIds.has(s.match_id) && Number.isFinite(k) && now > k + MAX_DURATION_MS) toDelete.add(s.match_id)
      }
    }
    if (toDelete.size) await sb(`match_live?match_id=in.(${[...toDelete].join(',')})`, { method: 'DELETE' })
  } catch { /* ignore */ }
}

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
    const rres = await sb('match_results?select=match_id,settled_at')
    const settledAt = new Map()
    if (rres.ok) for (const r of await rres.json()) settledAt.set(r.match_id, Date.parse(r.settled_at))
    return sched.some(s => {
      const k = Date.parse(s.kickoff)
      if (!Number.isFinite(k)) return false
      const sa = settledAt.get(s.match_id)
      // Réglé : on continue de suivre 15 min de plus (vérif du score final, VAR…).
      if (sa != null && Number.isFinite(sa)) return now < sa + SETTLE_GRACE_MS
      // Pas réglé : fenêtre normale (coup d'envoi -5 min → +150 min).
      return now >= k - PREROLL_MS && now <= k + MAX_DURATION_MS
    })
  } catch { return false }
}

function scorersFrom(events, homeId) {
  return (events || [])
    .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
    .map(e => ({
      p: e.player?.name || '?',
      // API-Football : e.team est l'équipe CRÉDITÉE du but (csc inclus) → pas d'inversion.
      s: e.team?.id === homeId ? 'home' : 'away',
      t: e.time?.elapsed ?? null,
      og: e.detail === 'Own Goal',
      pen: e.detail === 'Penalty',
    }))
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
  const o = orient(id, f)   // score ré-orienté vers notre match_id (points corrects)
  // Règlement 100 % REST (résultat + points + classement, auto-correcteur).
  await settleViaRest(sb, id, o.homeScore, o.awayScore)
  if (!haveGoals.has(id) && (o.homeScore + o.awayScore) > 0) {
    try {
      const ev = await api(`/fixtures/events?fixture=${f.fixture?.id}`)
      await sb('match_goals?on_conflict=match_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ match_id: id, scorers: scorersFrom(ev.response, o.appHomeId), updated_at: new Date().toISOString() }]),
      })
    } catch { /* ignore */ }
  }
}

// Règle (débloque les pronos) les matchs terminés — dès la minute suivant la fin.
// Et pendant 15 min après le règlement, on RE-vérifie le score final (corrections VAR,
// score mal renvoyé par l'API à la fin) → settle_match auto-corrige et les buteurs sont
// ré-écrits. Au-delà de ce délai de grâce, on n'y touche plus.
async function settleAll(api, sb, all, fxMap) {
  const now = Date.now()
  const er = await sb('match_results?select=match_id,settled_at')
  const settledAt = new Map()
  if (er.ok) for (const r of await er.json()) settledAt.set(r.match_id, Date.parse(r.settled_at))
  const eg = await sb('match_goals?select=match_id')
  const haveGoals = eg.ok ? new Set((await eg.json()).map(r => r.match_id)) : new Set()
  const jobs = []
  for (const f of all) {
    const id = fxMap.get(f.fixture?.id)
    const st = f.fixture?.status?.short
    if (!id || !FINISHED.has(st) || f.goals?.home == null || f.goals?.away == null) continue
    const sa = settledAt.get(id)
    const inGrace = sa != null && Number.isFinite(sa) && (now - sa) < SETTLE_GRACE_MS
    // Jamais réglé → règlement normal. Réglé il y a < 15 min → re-vérification (on force
    // la ré-écriture des buteurs en passant un set vide).
    if (!settledAt.has(id)) jobs.push(settleOne(api, sb, id, f, haveGoals))
    else if (inGrace)       jobs.push(settleOne(api, sb, id, f, new Set()))
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
    const o = orient(id, f)   // score + côté buteurs ré-orientés vers notre match_id
    rows.push({
      match_id: id, status: f.fixture?.status?.short || 'LIVE', elapsed: f.fixture?.status?.elapsed ?? null,
      home_score: o.homeScore, away_score: o.awayScore, updated_at: new Date().toISOString(),
    })
    if (o.homeScore + o.awayScore > 0) goalJobs.push(writeGoals(id, f.fixture?.id, o.appHomeId))
  }

  if (rows.length) await sb('match_live?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  // ⚠️ On ne supprime PAS une ligne juste parce qu'elle est absente de live=all
  // (mi-temps, creux API) → le score reste affiché toute la durée du match, pauses
  // comprises. Nettoyage ciblé : matchs déjà réglés (basculent en résultat final)
  // + lignes périmées (>3 h sans mise à jour) pour ne rien laisser traîner.
  const er = await sb('match_results?select=match_id')
  const settled = er.ok ? (await er.json()).map(r => r.match_id) : []
  if (settled.length) await sb(`match_live?match_id=in.(${settled.join(',')})`, { method: 'DELETE' })
  const stale = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  await sb(`match_live?updated_at=lt.${stale}`, { method: 'DELETE' })
  if (goalJobs.length) await Promise.all(goalJobs)
  return rows.length
}

// Boucle ~5 passages espacés de 12 s → couvre toute la minute du cron sans trou
// (≈12 s de granularité) pour des scores/buts/cartons en direct sans accroc.
async function runLoop(env) {
  const { api, sb, ok } = clients(env)
  if (!ok) return
  // Nettoyage du direct À CHAQUE passage (Supabase only, zéro quota), AVANT le gate :
  // un match terminé ou périmé ne reste jamais « en direct », même hors fenêtre.
  await cleanupLive(sb)
  // Aucun match dans sa fenêtre de jeu → on s'arrête AVANT tout appel à l'API football.
  if (!(await hasActiveMatch(sb))) return
  const { map: fxMap, all } = await buildContext(api, sb)
  try { await settleAll(api, sb, all, fxMap) } catch (e) { console.log('settle err', String(e)) }
  // Classement réconcilié après règlement (idempotent, insensible aux courses).
  try { await reconcileScores(sb) } catch (e) { console.log('reconcile err', String(e)) }
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
