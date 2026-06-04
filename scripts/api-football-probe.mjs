// Sonde de vérification API-Football : teste la clé, détecte l'auth (api-sports
// vs RapidAPI), affiche le quota, et repère la ligue Coupe du Monde 2026.
const KEY = process.env.API_FOOTBALL_KEY
if (!KEY) { console.error('❌ Secret API_FOOTBALL_KEY absent (vérifie le nom du secret).'); process.exit(1) }

const candidates = [
  { name: 'api-sports', url: 'https://v3.football.api-sports.io', headers: { 'x-apisports-key': KEY } },
  { name: 'rapidapi',   url: 'https://api-football-v1.p.rapidapi.com/v3',
    headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' } },
]

async function getJson(base, path) {
  const r = await fetch(`${base.url}${path}`, { headers: base.headers })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, j }
}

let base = null
for (const c of candidates) {
  try {
    const { status, j } = await getJson(c, '/status')
    console.log(`[${c.name}] /status → ${status}`)
    if (status === 200 && j.response) {
      base = c
      const acc = j.response.account || {}
      const sub = j.response.subscription || {}
      const req = j.response.requests || {}
      console.log(`✅ Auth OK via "${c.name}"`)
      console.log(`   Compte : ${acc.firstname || ''} ${acc.lastname || ''} ${acc.email ? '('+acc.email+')' : ''}`)
      console.log(`   Plan : ${sub.plan} · actif : ${sub.active} · fin : ${sub.end}`)
      console.log(`   Requêtes : ${req.current}/${req.limit_day} aujourd'hui`)
      break
    } else {
      console.log(`   réponse : ${JSON.stringify(j).slice(0, 300)}`)
    }
  } catch (e) { console.log(`[${c.name}] erreur réseau : ${String(e)}`) }
}
if (!base) { console.error('❌ Aucune méthode d\'authentification n\'a fonctionné. Clé ou abonnement à vérifier.'); process.exit(1) }

// Cherche la Coupe du Monde
const { j: lj } = await getJson(base, `/leagues?search=${encodeURIComponent('World Cup')}`)
console.log(`\n🏆 Ligues "World Cup" trouvées : ${lj.results ?? 0}`)
for (const item of (lj.response || [])) {
  const seasons = (item.seasons || []).map(s => s.year)
  console.log(` - id=${item.league.id} | "${item.league.name}" | type=${item.league.type} | ${item.country?.name} | saisons=[${seasons.join(', ')}]`)
}

// Essaie les fixtures de la WC pour la saison 2026
const wc = (lj.response || []).find(i =>
  /world cup/i.test(i.league.name) && i.league.type === 'Cup' &&
  !/women|wom|u-?\d|club|qualif/i.test(i.league.name))
if (wc) {
  const id = wc.league.id
  const { j: fj } = await getJson(base, `/fixtures?league=${id}&season=2026`)
  console.log(`\n📅 Fixtures ligue ${id} saison 2026 : ${fj.results ?? 0} match(s)`)
  const sample = (fj.response || []).slice(0, 4).map(f => ({
    fixtureId: f.fixture.id, date: f.fixture.date, status: f.fixture.status?.short,
    round: f.league.round, home: f.teams.home.name, away: f.teams.away.name,
    venue: f.fixture.venue?.name,
  }))
  console.log(JSON.stringify(sample, null, 2))
} else {
  console.log('\n⚠️  Coupe du Monde non identifiée automatiquement — je choisirai l\'ID à la main d\'après la liste ci-dessus.')
}
console.log('\n✅ Sonde terminée.')
