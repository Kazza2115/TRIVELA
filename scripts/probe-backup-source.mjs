// Sonde (lecture seule) : évalue TheSportsDB comme SOURCE DE SCORES DE SECOURS.
// Vérifie que la Coupe du Monde 2026 y est disponible et que les noms d'équipes
// peuvent être mappés. Ne règle rien — sert à décider si la source est viable.

import { API_TEAM_MAP } from './update-results.mjs'

const KEY  = process.env.THESPORTSDB_KEY || '3'   // '3' = clé de test publique gratuite
const base = `https://www.thesportsdb.com/api/v1/json/${KEY}`

async function main() {
  // 1. Trouver la ligue Coupe du Monde
  const lr = await fetch(`${base}/all_leagues.php`)
  if (!lr.ok) { console.error(`all_leagues HTTP ${lr.status}`); process.exit(1) }
  const { leagues = [] } = await lr.json()
  const wc = leagues.filter(l => l.strSport === 'Soccer' && /world cup/i.test(l.strLeague || ''))
  console.log('Ligues « World Cup » :', wc.map(l => `${l.idLeague}:${l.strLeague}`).join(' | ') || 'aucune')

  const league = wc.find(l => /^fifa world cup$/i.test(l.strLeague)) || wc[0]
  if (!league) { console.log('\n❌ TheSportsDB : aucune ligue Coupe du Monde → source NON viable.'); process.exit(0) }
  console.log(`Ligue retenue : ${league.idLeague} — ${league.strLeague}\n`)

  // 2. Récupérer les matchs de la saison 2026
  const er = await fetch(`${base}/eventsseason.php?id=${league.idLeague}&s=2026`)
  const body = await er.json().catch(() => ({}))
  const events = body.events || []
  console.log(`Matchs saison 2026 : ${events.length}`)
  if (events.length === 0) {
    console.log('⚠️ Aucun match 2026 publié pour l\'instant (normal avant le tournoi).')
    console.log('   → Relancer cette sonde plus près de la compétition.')
    process.exit(0)
  }

  // 3. Couverture des noms d'équipes
  const names = new Set()
  events.forEach(e => { if (e.strHomeTeam) names.add(e.strHomeTeam); if (e.strAwayTeam) names.add(e.strAwayTeam) })
  const unknown = [...names].filter(n => !API_TEAM_MAP[n])

  console.log('Exemples :', events.slice(0, 3)
    .map(e => `${e.strHomeTeam} ${e.intHomeScore ?? '-'}:${e.intAwayScore ?? '-'} ${e.strAwayTeam}`).join(' | '))
  console.log(`Équipes distinctes : ${names.size}`)
  console.log(`\n${unknown.length === 0 ? '✅' : '⚠️'} Noms non reconnus par API_TEAM_MAP : ${unknown.length}`)
  unknown.forEach(n => console.log(`   • "${n}"  → à ajouter comme alias`))

  console.log(`\n${events.length > 0 && unknown.length === 0
    ? '🎉 TheSportsDB viable comme source de secours.'
    : 'ℹ️ Source partiellement prête — voir les points ci-dessus.'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
