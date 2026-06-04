// Résultats via API-Football : règle les matchs de groupe TERMINÉS
// (settle_match → points + classements). Mapping partagé via wc-map.mjs.
import { fixtureToMatchId } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant'); process.exit(1) }

const sb  = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const api = path => fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const FINISHED = new Set(['FT', 'AET', 'PEN'])

async function main() {
  const sched = await sb('match_schedule?select=match_id')
  const validIds = sched.ok ? new Set((await sched.json()).map(r => r.match_id)) : new Set()

  const data = await api('/fixtures?league=1&season=2026')
  const fixtures = data.response || []
  let matched = 0, settled = 0
  const unmatched = []
  for (const f of fixtures) {
    const id = fixtureToMatchId(f, validIds)
    if (!id) { unmatched.push(`${f.teams?.home?.name} vs ${f.teams?.away?.name} [${f.league?.round}]`); continue }
    matched++
    const status = f.fixture?.status?.short
    if (FINISHED.has(status) && f.goals?.home != null && f.goals?.away != null) {
      const r = await sb('rpc/settle_match', { method: 'POST',
        body: JSON.stringify({ p_match_id: id, p_home_score: f.goals.home, p_away_score: f.goals.away }) })
      if (r.ok) settled++
      else console.warn(`  ⚠️ settle ${id}: ${r.status} ${await r.text().catch(() => '')}`)
    }
  }
  console.log(`✅ Mappés : ${matched}/${fixtures.length} · Réglés (terminés) : ${settled}`)
  if (unmatched.length) console.log(`⚠️ Non mappés (${unmatched.length}) :\n - ${unmatched.join('\n - ')}`)
}
main().catch(e => { console.error('Erreur :', e); process.exit(1) })
