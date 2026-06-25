// Ponctuel : lit l'état RÉEL de la Coupe du Monde 2026 via API-Football pour préparer
// le pré-remplissage du bracket (phases éliminatoires). Lecture seule. À retirer après.
//   • classements de groupe (qui est 1er/2e, qualifié ?)
//   • fixtures à élimination directe : équipes réelles (ou placeholder) + mapping match_id
import { buildFixtureMap, shortOf, shortToGroup } from './wc-map.mjs'

const KEY = process.env.API_FOOTBALL_KEY
if (!KEY) { console.error('❌ API_FOOTBALL_KEY absent'); process.exit(1) }
const API = 'https://v3.football.api-sports.io'
const get = p => fetch(`${API}${p}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())

// match_id valides côté app (groupes) pour aider le mapping des groupes.
const VALID = new Set()
for (const [g, arr] of Object.entries({
  A:['MEX','KOR','ZAF','CZE'],B:['CAN','SUI','QAT','BIH'],C:['BRA','MAR','SCO','HAI'],
  D:['USA','PAR','AUS','TUR'],E:['GER','ECU','CIV','CUR'],F:['NED','JPN','SWE','TUN'],
  G:['BEL','EGY','IRN','NZL'],H:['ESP','URU','SAU','CPV'],I:['FRA','SEN','NOR','IRQ'],
  J:['ARG','DZA','AUT','JOR'],K:['POR','COL','UZB','COD'],L:['ENG','CRO','PAN','GHA'],
})) for (let md = 1; md <= 3; md++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
  if (i !== j) VALID.add(`g${g}-md${md}-${arr[i].toLowerCase()}-${arr[j].toLowerCase()}`)

console.log('=== STATUS ===')
try { const s = await get('/status'); const r = s.response?.requests || {}; console.log(`requêtes ${r.current}/${r.limit_day}`) } catch {}

const fx = (await get('/fixtures?league=1&season=2026')).response || []
console.log(`\n=== FIXTURES total : ${fx.length} ===`)

// Répartition par round
const byRound = {}
for (const f of fx) { const r = f.league?.round || '?'; (byRound[r] ||= []).push(f) }
console.log('\n=== ROUNDS présents ===')
for (const [r, arr] of Object.entries(byRound)) console.log(`  "${r}" → ${arr.length}`)

// Mapping fixture → notre match_id
const { map } = buildFixtureMap(fx, VALID)

// Détail des matchs à élimination directe (non "group")
console.log('\n=== ÉLIMINATION DIRECTE (mappé) ===')
const ko = fx.filter(f => !/group/i.test(f.league?.round || ''))
  .sort((a, b) => Date.parse(a.fixture?.date || 0) - Date.parse(b.fixture?.date || 0))
for (const f of ko) {
  const id = map.get(f.fixture?.id) || '—'
  const hn = f.teams?.home?.name || 'null'
  const an = f.teams?.away?.name || 'null'
  const hs = shortOf(hn) || '??'
  const as = shortOf(an) || '??'
  const st = f.fixture?.status?.short || '?'
  const d = (f.fixture?.date || '').slice(0, 16)
  console.log(`  [${id.padEnd(7)}] ${d}  ${st.padEnd(3)}  ${hn} (${hs}) vs ${an} (${as})  | round="${f.league?.round}"`)
}

// Classements (qui est qualifié / 1er-2e)
console.log('\n=== CLASSEMENTS DE GROUPE ===')
try {
  const st = (await get('/standings?league=1&season=2026')).response || []
  const groups = st[0]?.league?.standings || []
  for (const grp of groups) {
    const names = grp.map(t => `${t.rank}.${t.team?.name}(${t.points}pts,${t.all?.played}j)`).join('  ')
    console.log(`  ${names}`)
  }
} catch (e) { console.log('  standings indispo :', String(e)) }

console.log('\n✅ Recon terminée.')
