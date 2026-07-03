// Ponctuel (lecture seule) : diagnostic complet des dates des matchs à élimination directe.
// Pour CHAQUE fixture KO renvoyée par l'API : round, équipes, date (UTC), slot mappé par
// buildFixtureMap, + comparaison avec match_schedule. Sert à repérer les mappings/dates faux
// (ex. match de la Suisse mal placé). N'écrit rien.
import { buildFixtureMap, shortOf, koSlotForFixture } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY = process.env.API_FOOTBALL_KEY
const API = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant'); process.exit(1) }
const sb = p => fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })
const api = p => fetch(`${API}${p}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())

const validIds = new Set((await (await sb('match_schedule?select=match_id')).json()).map(r => r.match_id))
const sched = {}
for (const r of await (await sb('match_schedule?select=match_id,kickoff')).json()) sched[r.match_id] = r.kickoff

const all = (await api('/fixtures?league=1&season=2026')).response || []
const { map } = buildFixtureMap(all, validIds)

const ko = all.filter(f => !/group/i.test(f.league?.round || ''))
ko.sort((a, b) => (Date.parse(a.fixture?.date || '') || 0) - (Date.parse(b.fixture?.date || '') || 0))

console.log('=== FIXTURES KO (API) → slot mappé · date API (UTC) · date match_schedule ===')
for (const f of ko) {
  const fid = f.fixture?.id
  const slot = map.get(fid) || '—'
  const hs = shortOf(f.teams?.home?.name), as = shortOf(f.teams?.away?.name)
  const teams = `${(hs || f.teams?.home?.name || '??')}-${(as || f.teams?.away?.name || '??')}`
  const struct = koSlotForFixture(f.league?.round?.match(/round of 16/i) ? 'r16' : f.league?.round?.match(/quarter/i) ? 'qf' : f.league?.round?.match(/semi/i) ? 'sf' : f.league?.round?.match(/round of 32/i) ? 'r32' : '', hs, as)
  const apiDate = f.fixture?.date || '?'
  const schedDate = sched[slot] || '—'
  const flag = (slot !== '—' && sched[slot] && new Date(sched[slot]).toISOString() !== new Date(apiDate).toISOString()) ? '  ⚠️ ÉCART' : ''
  console.log(`  [${String(slot).padEnd(7)}] ${teams.padEnd(9)} "${f.league?.round}"  API=${apiDate}  sched=${schedDate}  struct=${struct || '—'}${flag}`)
}

console.log('\n=== match_schedule KO actuel ===')
const KO = /^(r32|r16|qf|sf|3rd|final)/
const rows = (await (await sb('match_schedule?select=match_id,kickoff&order=kickoff.asc')).json()).filter(r => KO.test(r.match_id))
for (const r of rows) console.log(`  [${r.match_id.padEnd(7)}] ${r.kickoff}`)
console.log('\n✅ Terminé.')
