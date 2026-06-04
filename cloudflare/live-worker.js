// TRIVELA — Worker Cloudflare : interroge API-Football toutes les minutes (cron)
// et écrit les scores en direct dans Supabase (table match_live).
// Secrets à définir : API_FOOTBALL_KEY, SUPABASE_SERVICE_ROLE_KEY
import { fixtureToMatchId } from '../scripts/wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const API = 'https://v3.football.api-sports.io'

async function poll(env) {
  const KEY = env.API_FOOTBALL_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
  if (!KEY || !SERVICE) return 0
  const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const sres = await sb('match_schedule?select=match_id')
  const validIds = sres.ok ? new Set((await sres.json()).map(r => r.match_id)) : new Set()

  const data = await fetch(`${API}/fixtures?league=1&season=2026&live=all`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
  const rows = []
  for (const f of (data.response || [])) {
    const id = fixtureToMatchId(f, validIds)
    if (!id) continue
    rows.push({
      match_id: id, status: f.fixture?.status?.short || 'LIVE', elapsed: f.fixture?.status?.elapsed ?? null,
      home_score: f.goals?.home ?? 0, away_score: f.goals?.away ?? 0, updated_at: new Date().toISOString(),
    })
  }
  const ids = rows.map(r => r.match_id)
  if (ids.length) await sb(`match_live?match_id=not.in.(${ids.join(',')})`, { method: 'DELETE' })
  else await sb('match_live?match_id=not.is.null', { method: 'DELETE' })
  if (rows.length) await sb('match_live?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  return rows.length
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(poll(env)) },
  async fetch(_req, env) { const n = await poll(env); return new Response(`live: ${n}`) },
}
