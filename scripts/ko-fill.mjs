// Ponctuel : pré-remplit le bracket (phases éliminatoires) dans knockout_teams à partir
// de l'état RÉEL de la Coupe du Monde 2026 (API-Football). Reproduit EXACTEMENT la logique
// du worker (`syncKnockoutTeams`) mais déclenchable à la demande via GitHub Actions.
//
//   • APPLY non défini  → mode RAPPORT seul : affiche classements + affiches connues, n'écrit rien.
//   • APPLY=1           → écrit knockout_teams (source 'api') pour toute affiche dont les
//                         DEUX équipes sont connues. Ne touche jamais une affectation 'admin'.
//
// Idempotent. Lecture seule de l'API ; écriture Supabase uniquement si APPLY=1. À retirer après usage.
// Relance 2026-06-28 : contrôle de l'état de knockout_teams après réordonnancement du bracket.
import { buildFixtureMap, shortOf } from './wc-map.mjs'

const KEY = process.env.API_FOOTBALL_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('❌ API_FOOTBALL_KEY absent'); process.exit(1) }
if (!SERVICE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const APPLY = process.env.APPLY === '1'

const API = 'https://v3.football.api-sports.io'
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const api = p => fetch(`${API}${p}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})

// match_id de groupe valides (aide au mapping des journées).
const GROUPS = {
  A: ['MEX', 'KOR', 'ZAF', 'CZE'], B: ['CAN', 'SUI', 'QAT', 'BIH'], C: ['BRA', 'MAR', 'SCO', 'HAI'],
  D: ['USA', 'PAR', 'AUS', 'TUR'], E: ['GER', 'ECU', 'CIV', 'CUR'], F: ['NED', 'JPN', 'SWE', 'TUN'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'], H: ['ESP', 'URU', 'SAU', 'CPV'], I: ['FRA', 'SEN', 'NOR', 'IRQ'],
  J: ['ARG', 'DZA', 'AUT', 'JOR'], K: ['POR', 'COL', 'UZB', 'COD'], L: ['ENG', 'CRO', 'PAN', 'GHA'],
}
const VALID = new Set()
for (const [g, arr] of Object.entries(GROUPS))
  for (let md = 1; md <= 3; md++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
    if (i !== j) VALID.add(`g${g}-md${md}-${arr[i].toLowerCase()}-${arr[j].toLowerCase()}`)

console.log(`=== KO-FILL (${APPLY ? 'ÉCRITURE' : 'RAPPORT seul'}) ===`)
try { const s = await api('/status'); const r = s.response?.requests || {}; console.log(`requêtes API ${r.current}/${r.limit_day}`) } catch {}

const fx = (await api('/fixtures?league=1&season=2026')).response || []
console.log(`fixtures total : ${fx.length}`)

// Classements de groupe (qui est qualifié / 1er-2e-3e).
console.log('\n=== CLASSEMENTS DE GROUPE ===')
try {
  const st = (await api('/standings?league=1&season=2026')).response || []
  const groups = st[0]?.league?.standings || []
  for (const grp of groups) {
    console.log('  ' + grp.map(t => `${t.rank}.${t.team?.name}(${t.points}pts,${t.all?.played}j)`).join('  '))
  }
} catch (e) { console.log('  standings indispo :', String(e)) }

// Mapping fixture → notre match_id, puis affiches éliminatoires.
const { map } = buildFixtureMap(fx, VALID)
const ko = fx.filter(f => !/group/i.test(f.league?.round || ''))
  .sort((a, b) => Date.parse(a.fixture?.date || 0) - Date.parse(b.fixture?.date || 0))

console.log('\n=== AFFICHES ÉLIMINATOIRES (API) ===')
const want = []
for (const f of ko) {
  const id = map.get(f.fixture?.id)
  const hn = f.teams?.home?.name, an = f.teams?.away?.name
  const hs = shortOf(hn), as = shortOf(an)
  const d = (f.fixture?.date || '').slice(0, 16)
  console.log(`  [${(id || '—').padEnd(7)}] ${d}  ${(hn || 'TBD')} (${hs || '??'}) vs ${(an || 'TBD')} (${as || '??'})  | round="${f.league?.round}"`)
  if (id && /^(r32|r16|qf|sf|3rd|final)/.test(id) && hs && as) want.push({ id, hs, as })
}
console.log(`\n→ ${want.length} affiche(s) avec les DEUX équipes connues (candidates à l'écriture).`)

// Lecture de l'état actuel de knockout_teams (et protection des choix 'admin').
const er = await sb('knockout_teams?select=match_id,source,home_short,away_short')
if (!er.ok) { console.error(`❌ Lecture knockout_teams impossible (${er.status}). Table créée (db-knockout.sql) ?`); process.exit(1) }
const existing = new Map()
for (const r of await er.json()) existing.set(r.match_id, r)

const rows = []
for (const w of want) {
  const ex = existing.get(w.id)
  if (ex && ex.source === 'admin') { console.log(`  ⏭  ${w.id} : override admin (${ex.home_short}-${ex.away_short}) → conservé`); continue }
  if (ex && ex.home_short === w.hs && ex.away_short === w.as) continue   // déjà à jour
  rows.push({ match_id: w.id, home_short: w.hs, away_short: w.as, source: 'api', updated_at: new Date().toISOString() })
}

console.log(`\n=== ${rows.length} ligne(s) à écrire ===`)
for (const r of rows) console.log(`  ${r.match_id} : ${r.home_short} vs ${r.away_short}`)

if (!APPLY) {
  console.log('\nℹ️  Mode RAPPORT : aucune écriture. Relancer avec APPLY=1 pour appliquer.')
  process.exit(0)
}

if (rows.length) {
  const up = await sb('knockout_teams?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!up.ok) { console.error(`❌ Échec écriture (${up.status}) : ${await up.text()}`); process.exit(1) }
  console.log(`✅ ${rows.length} affiche(s) écrite(s) dans knockout_teams (source 'api').`)
} else {
  console.log('✅ Rien à écrire — bracket déjà à jour.')
}

// Relecture pour confirmation.
const fr = await sb('knockout_teams?select=match_id,home_short,away_short,source&order=match_id.asc')
if (fr.ok) {
  console.log('\n=== BRACKET APRÈS ÉCRITURE ===')
  for (const r of await fr.json()) console.log(`  [${r.match_id.padEnd(7)}] ${r.home_short || '—'} vs ${r.away_short || '—'}  (${r.source})`)
}
console.log('\n✅ Terminé.')
