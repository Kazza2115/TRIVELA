// Relance 2026-07-05 : résultat r16-1 (PAR-FRA) non réglé — audit du statut API.
// Ponctuel (lecture seule) : état COMPLET du bracket éliminatoire pour audit.
//   1) knockout_teams tel quel (slot, équipes, source, dernière maj) ;
//   2) match_results des matchs KO ;
//   3) propagation ATTENDUE (propagateKnockout sur les résultats + T.A.B. API)
//      comparée à la base → signale tout écart (ex. équipe manquante type « Canada »).
// N'écrit rien.
import { buildFixtureMap, propagateKnockout, shortOf } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY = process.env.API_FOOTBALL_KEY
const API = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant'); process.exit(1) }
const sb = p => fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })
const api = p => fetch(`${API}${p}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())

const KO = /^(r32|r16|qf|sf|3rd|final)/
const ORDER = ['r32', 'r16', 'qf', 'sf', '3rd', 'final']
const rank = id => { const p = id.split('-')[0]; return ORDER.indexOf(p) * 100 + parseInt(id.split('-')[1] || '0', 10) }

// 1) knockout_teams
const koRows = (await (await sb('knockout_teams?select=match_id,home_short,away_short,source,updated_at')).json())
  .filter(r => KO.test(r.match_id)).sort((a, b) => rank(a.match_id) - rank(b.match_id))
const ko = {}
for (const r of koRows) ko[r.match_id] = r
console.log('=== knockout_teams (base) ===')
for (const r of koRows)
  console.log(`  [${r.match_id.padEnd(7)}] ${String(r.home_short ?? '∅').padEnd(4)} vs ${String(r.away_short ?? '∅').padEnd(4)} src=${r.source}  maj=${r.updated_at}`)

// 2) Résultats KO
const results = {}
const rr = (await (await sb('match_results?select=match_id,home_score,away_score,settled_at')).json()).filter(r => KO.test(r.match_id))
for (const r of rr) results[r.match_id] = r
console.log('\n=== match_results (KO) ===')
for (const r of rr.sort((a, b) => rank(a.match_id) - rank(b.match_id)))
  console.log(`  [${r.match_id.padEnd(7)}] ${r.home_score}-${r.away_score}  réglé=${r.settled_at}`)

// 3) Propagation attendue vs base (T.A.B. via drapeau winner de l'API)
const sres = await sb('match_schedule?select=match_id')
const validIds = new Set((await sres.json()).map(r => r.match_id))
const all = (await api('/fixtures?league=1&season=2026')).response || []
const { map: fxMap } = buildFixtureMap(all, validIds)
const tab = {}
for (const f of all) {
  const id = fxMap.get(f.fixture?.id)
  if (!id || !KO.test(id)) continue
  const gh = f.goals?.home, ga = f.goals?.away
  if (gh == null || ga == null || gh !== ga) continue
  const wName = f.teams?.home?.winner ? f.teams?.home?.name : f.teams?.away?.winner ? f.teams?.away?.name : null
  const ws = shortOf(wName)
  if (ws) tab[id] = ws
}
console.log('\n=== Vainqueurs T.A.B. (API) ===', JSON.stringify(tab))

const derived = propagateKnockout(ko, results, tab)
console.log('\n=== Propagation ATTENDUE vs BASE ===')
let issues = 0
for (const [mid, t] of Object.entries(derived).sort((a, b) => rank(a[0]) - rank(b[0]))) {
  const cur = ko[mid] || {}
  const hs = t.home_short ?? null, as = t.away_short ?? null
  const same = (cur.home_short ?? null) === hs && (cur.away_short ?? null) === as
  console.log(`  [${mid.padEnd(7)}] attendu ${String(hs ?? '∅').padEnd(4)} vs ${String(as ?? '∅').padEnd(4)} · base ${String(cur.home_short ?? '∅').padEnd(4)} vs ${String(cur.away_short ?? '∅').padEnd(4)} ${same ? 'OK' : `⚠️ ÉCART (src=${cur.source ?? 'absent'})`}`)
  if (!same) issues++
}

// 4) Fixtures API des 8es (équipes réelles + mapping)
console.log('\n=== Fixtures API R16+ ===')
for (const f of all) {
  const id = fxMap.get(f.fixture?.id)
  if (!id || !/^(r16|qf|sf|3rd|final)/.test(id)) continue
  console.log(`  [${String(id).padEnd(7)}] ${f.teams?.home?.name} vs ${f.teams?.away?.name}  (${f.fixture?.date}, statut ${f.fixture?.status?.short})`)
}

console.log(issues ? `\n⚠️ ${issues} écart(s) détecté(s).` : '\n✅ Base cohérente avec la propagation.')
