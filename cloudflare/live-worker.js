// TRIVELA — Worker Cloudflare : scores en direct API-Football → Supabase (match_live + match_goals)
// Cron 1 min, avec une boucle interne (~14 s) → mise à jour quasi temps réel.
// Mapping FIABLE par fixture_id (groupes + élimination directe) via buildFixtureMap.
// Secrets (wrangler secret put) : API_FOOTBALL_KEY, SUPABASE_SERVICE_ROLE_KEY
import { buildFixtureMap } from '../scripts/wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const API = 'https://v3.football.api-sports.io'
const INPLAY = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'])
const sleep = ms => new Promise(r => setTimeout(r, ms))

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

async function buildMap(api, sb) {
  try {
    const sres = await sb('match_schedule?select=match_id')
    const validIds = sres.ok ? new Set((await sres.json()).map(r => r.match_id)) : new Set()
    const allRes = await api('/fixtures?league=1&season=2026')
    return buildFixtureMap(allRes.response || [], validIds).map
  } catch { return new Map() }
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

  // Match test : amical France–Irlande du Nord du 8 juin 2026 (par date + noms)
  try {
    const d = await api('/fixtures?date=2026-06-08')
    const f = (d.response || []).find(x => {
      const n = [x.teams?.home?.name, x.teams?.away?.name]
      return n.includes('France') && n.includes('Northern Ireland')
    })
    const st = f?.fixture?.status?.short
    if (f && INPLAY.has(st)) {
      rows.push({
        match_id: 'fr-nir', status: st, elapsed: f.fixture?.status?.elapsed ?? null,
        home_score: f.goals?.home ?? 0, away_score: f.goals?.away ?? 0, updated_at: new Date().toISOString(),
      })
      if ((f.goals?.home ?? 0) + (f.goals?.away ?? 0) > 0) goalJobs.push(writeGoals('fr-nir', f.fixture?.id, f.teams?.home?.id))
    }
  } catch { /* ignore */ }

  const ids = rows.map(r => r.match_id)
  if (ids.length) await sb(`match_live?match_id=not.in.(${ids.join(',')})`, { method: 'DELETE' })
  else await sb('match_live?match_id=not.is.null', { method: 'DELETE' })
  if (rows.length) await sb('match_live?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  if (goalJobs.length) await Promise.all(goalJobs)
  return rows.length
}

// Boucle ~4 passages espacés de 14 s → couvre la minute du cron (≈14 s de granularité)
async function runLoop(env) {
  const { api, sb, ok } = clients(env)
  if (!ok) return
  const fxMap = await buildMap(api, sb)
  for (let i = 0; i < 4; i++) {
    try { await poll(api, sb, fxMap) } catch (e) { console.log('poll err', String(e)) }
    if (i < 3) await sleep(14000)
  }
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(runLoop(env)) },
  async fetch(_req, env) {
    const { api, sb, ok } = clients(env)
    if (!ok) return new Response('secrets manquants', { status: 500 })
    const fxMap = await buildMap(api, sb)
    const n = await poll(api, sb, fxMap)
    return new Response(`live: ${n} (map: ${fxMap.size})`)
  },
}
