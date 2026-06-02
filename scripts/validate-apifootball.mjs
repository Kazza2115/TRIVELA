// Valide la SOURCE DE SECOURS API-Football : la WC 2026 est-elle accessible
// avec ta clé/plan, et les noms d'équipes sont-ils mappables ?
// À lancer après avoir ajouté le secret APIFOOTBALL_KEY.

import { API_TEAM_MAP, MATCH_LOOKUP } from './update-results.mjs'

const KEY    = process.env.APIFOOTBALL_KEY
const LEAGUE = process.env.APIFOOTBALL_LEAGUE || '1'   // 1 = FIFA World Cup
const SEASON = process.env.APIFOOTBALL_SEASON || '2026'
if (!KEY) { console.error('APIFOOTBALL_KEY absent — ajoute le secret puis relance.'); process.exit(1) }

async function main() {
  const r = await fetch(`https://v3.football.api-sports.io/fixtures?league=${LEAGUE}&season=${SEASON}`,
    { headers: { 'x-apisports-key': KEY } })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) { console.error(`API-Football HTTP ${r.status} — ${JSON.stringify(body).slice(0, 200)}`); process.exit(1) }
  if (body.errors && Object.keys(body.errors).length) {
    console.error('API-Football a renvoyé des erreurs :', JSON.stringify(body.errors))
    console.error('→ Souvent : plan gratuit limité aux saisons anciennes. Vérifie ton plan/clé.')
    process.exit(1)
  }
  const fixtures = body.response ?? []
  console.log(`Ligue ${LEAGUE} saison ${SEASON} : ${fixtures.length} match(s) renvoyés.\n`)
  if (fixtures.length === 0) {
    console.log('⚠️ Aucun match — la WC 2026 n\'est pas accessible avec ce plan/cette ligue.')
    console.log('   Essaie une autre league id (env APIFOOTBALL_LEAGUE) ou vérifie ton abonnement.')
    process.exit(0)
  }

  const unknown = new Set(), missing = [], orientation = [], okKeys = new Set()
  let known = 0, mapped = 0
  for (const f of fixtures) {
    const hN = f.teams?.home?.name, aN = f.teams?.away?.name
    if (!hN || !aN) continue
    known++
    const h = API_TEAM_MAP[hN], a = API_TEAM_MAP[aN]
    if (!h) unknown.add(hN)
    if (!a) unknown.add(aN)
    if (!h || !a) continue
    const key = `${h}-${a}`, rev = `${a}-${h}`
    if (MATCH_LOOKUP[key]) { mapped++; okKeys.add(key) }
    else if (MATCH_LOOKUP[rev]) orientation.push(`${hN} vs ${aN}`)   // géré automatiquement (scores permutés)
    else missing.push(`${hN} vs ${aN} (${h}-${a})`)
  }

  console.log('── VALIDATION SOURCE DE SECOURS (API-Football) ──')
  console.log(`Matchs équipes connues : ${known} · correctement mappés : ${mapped}`)
  console.log(`\n${unknown.size === 0 ? '✅' : '❌'} Équipes non reconnues : ${unknown.size}`)
  unknown.forEach(n => console.log(`   ❌ "${n}"  → ajouter dans API_TEAM_MAP`))
  console.log(`\n${orientation.length === 0 ? '✅' : 'ℹ️'} Inversions domicile/extérieur : ${orientation.length} (gérées automatiquement par la bascule)`)
  console.log(`\n${missing.length === 0 ? '✅' : '❌'} Fixtures non couverts : ${missing.length}`)
  missing.forEach(s => console.log(`   ❌ ${s}`))

  const ok = unknown.size === 0 && missing.length === 0
  console.log(`\n${ok ? '🎉 Source de secours prête : chaque match sera capté en repli.' : '⚠️ Ajoute les alias manquants avant de compter sur le secours.'}`)
}
main().catch(e => { console.error(e); process.exit(1) })
