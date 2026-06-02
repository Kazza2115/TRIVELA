// Validation croisée : compare les VRAIS matchs WC 2026 de football-data.org
// avec les tables de correspondance du robot (API_TEAM_MAP + MATCH_LOOKUP).
// Objectif : garantir qu'AUCUN match ne sera ignoré ni mal réglé le jour J.
//
// Détecte : équipes non mappées, fixtures non couverts, et surtout les
// inversions domicile/extérieur (qui feraient échouer le settlement en silence).

import { API_TEAM_MAP, MATCH_LOOKUP } from './update-results.mjs'

const FOOT_KEY = process.env.FOOTBALL_DATA_API_KEY
if (!FOOT_KEY) { console.error('FOOTBALL_DATA_API_KEY absent'); process.exit(1) }

async function main() {
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches?season=2026',
    { headers: { 'X-Auth-Token': FOOT_KEY } }
  )
  if (!res.ok) {
    console.error(`API HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`)
    process.exit(1)
  }
  const { matches = [] } = await res.json()
  console.log(`${matches.length} match(s) reçus de l'API.\n`)

  const unknownTeams   = new Set()
  const missingFixture = []
  const orientationBad = []
  const okKeys         = new Set()
  let groupMatches = 0, mappedOk = 0

  for (const m of matches) {
    const hName = m.homeTeam?.name, aName = m.awayTeam?.name
    if (!hName || !aName) continue            // knockout TBD : équipes non connues
    groupMatches++

    const h = API_TEAM_MAP[hName]
    const a = API_TEAM_MAP[aName]
    if (!h) unknownTeams.add(hName)
    if (!a) unknownTeams.add(aName)
    if (!h || !a) continue

    const key = `${h}-${a}`, rev = `${a}-${h}`
    if (MATCH_LOOKUP[key]) { mappedOk++; okKeys.add(key) }
    else if (MATCH_LOOKUP[rev]) orientationBad.push(`${hName} vs ${aName}  (API: ${key} / table: ${rev})`)
    else missingFixture.push(`${hName} vs ${aName}  (${h}-${a})`)
  }

  // Clés de la table jamais confirmées par un match de l'API (obsolètes / fautes de frappe)
  const staleKeys = Object.keys(MATCH_LOOKUP).filter(k => !okKeys.has(k))

  console.log('── RÉSULTAT DE LA VALIDATION ──')
  console.log(`Matchs avec équipes connues (phase de groupes) : ${groupMatches}`)
  console.log(`Correctement mappés (équipe + orientation OK)   : ${mappedOk}`)
  console.log(`Entrées dans MATCH_LOOKUP                        : ${Object.keys(MATCH_LOOKUP).length}`)

  console.log(`\n${unknownTeams.size === 0 ? '✅' : '❌'} Équipes non reconnues par API_TEAM_MAP : ${unknownTeams.size}`)
  unknownTeams.forEach(t => console.log(`   ❌ "${t}"  → ajouter dans API_TEAM_MAP`))

  console.log(`\n${orientationBad.length === 0 ? '✅' : '❌'} Inversions domicile/extérieur : ${orientationBad.length}`)
  orientationBad.forEach(s => console.log(`   ❌ ${s}`))

  console.log(`\n${missingFixture.length === 0 ? '✅' : '❌'} Fixtures non couverts par MATCH_LOOKUP : ${missingFixture.length}`)
  missingFixture.forEach(s => console.log(`   ❌ ${s}`))

  console.log(`\n${staleKeys.length === 0 ? '✅' : '⚠️'} Entrées MATCH_LOOKUP non confirmées par l'API : ${staleKeys.length}`)
  staleKeys.forEach(k => console.log(`   ⚠️ ${k} → ${MATCH_LOOKUP[k]} (pas (encore) vu côté API)`))

  const allGood = unknownTeams.size === 0 && orientationBad.length === 0 && missingFixture.length === 0
  console.log(`\n${allGood ? '🎉 Aucun problème : chaque match sera correctement capté et réglé.' : '⚠️ Corrige les points ❌ ci-dessus avant le lancement.'}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
