// Ponctuel (lecture seule) : dump des coups d'envoi (match_schedule) pour comparer
// aux dates d'affichage (wc2026Matches.ts). Sert à repérer les erreurs de date.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const sb = (p) => fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })

const rows = await (await sb('match_schedule?select=match_id,kickoff&order=kickoff.asc')).json()
const results = {}
for (const r of await (await sb('match_results?select=match_id,home_score,away_score')).json()) results[r.match_id] = r
const KO = /^(r32|r16|qf|sf|3rd|final)/

const fmt = k => k ? new Date(k).toLocaleString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' }) : '—'
console.log('=== match_schedule — MATCHS ÉLIMINATOIRES (coup d\'envoi, heure de Genève) ===')
for (const r of rows.filter(r => KO.test(r.match_id))) {
  const res = results[r.match_id]
  console.log(`  [${r.match_id.padEnd(7)}] ${fmt(r.kickoff)}   (UTC ${r.kickoff})${res ? `  · réglé ${res.home_score}-${res.away_score}` : ''}`)
}
console.log(`\n(${rows.length} lignes au total dans match_schedule ; ${rows.filter(r => KO.test(r.match_id)).length} éliminatoires)`)
console.log('\n✅ Terminé.')
