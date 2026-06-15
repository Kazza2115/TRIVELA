// Ponctuel : diagnostic du live pour BEL–EGY (gG-md1-bel-egy). À retirer après.
import { buildFixtureMap } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ secret manquant'); process.exit(1) }
const sb  = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, { ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) } })
const api = p => fetch(`${API}${p}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const MID = 'gG-md1-bel-egy'
const j = async (p) => { const r = await sb(p); return r.ok ? r.json() : `err${r.status}` }

const NOW = Date.now()
console.log('NOW (UTC):', new Date(NOW).toISOString())
const liveRow = await j(`match_live?select=*&match_id=eq.${MID}`)
console.log('match_live (BEL-EGY):', JSON.stringify(liveRow))
if (Array.isArray(liveRow) && liveRow[0]?.updated_at) {
  const age = Math.round((NOW - Date.parse(liveRow[0].updated_at)) / 1000)
  console.log(`   → écrit il y a ${age}s (si < 70s et SANS passage manuel → le worker tourne ✅)`)
}
console.log('match_results (BEL-EGY):', JSON.stringify(await j(`match_results?select=*&match_id=eq.${MID}`)))
const allLive = await j('match_live?select=match_id,status,home_score,away_score,updated_at&order=updated_at.desc')
console.log('TOUTES les lignes match_live:', JSON.stringify(allLive))

// API : matchs en direct WC 2026
const liveApi = (await api('/fixtures?league=1&season=2026&live=all')).response || []
console.log(`\nAPI live=all → ${liveApi.length} match(s) :`)
for (const f of liveApi) console.log(`  fixture ${f.fixture?.id} · ${f.fixture?.status?.short} ${f.fixture?.status?.elapsed ?? '-'}' · ${f.teams?.home?.name} ${f.goals?.home}-${f.goals?.away} ${f.teams?.away?.name}`)

// Mapping fixture → match_id
const all = (await api('/fixtures?league=1&season=2026')).response || []
const validIds = new Set((await j('match_schedule?select=match_id')).map?.(r => r.match_id) ?? [])
const { map } = buildFixtureMap(all, validIds)
const fid = [...map.entries()].find(([, m]) => m === MID)?.[0]
console.log(`\nMapping : ${map.size} fixtures mappés · BEL-EGY → fixture ${fid ?? 'NON MAPPÉ'}`)
if (fid) {
  const one = (await api(`/fixtures?id=${fid}`)).response?.[0]
  console.log(`API fixture BEL-EGY : ${one?.fixture?.status?.short} ${one?.fixture?.status?.elapsed ?? '-'}' · ${one?.teams?.home?.name} ${one?.goals?.home}-${one?.goals?.away} ${one?.teams?.away?.name} · date ${one?.fixture?.date}`)
}
