// Ponctuel (lecture seule) : sort le classement final + des statistiques amusantes pour
// rédiger le message d'annonce de fin de tournoi. N'écrit rien.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const sb = async p => {
  const r = await fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  const j = await r.json()
  if (!Array.isArray(j)) { console.error(`⚠️  ${p} →`, JSON.stringify(j)); return [] }
  return j
}

let profiles = await sb('profiles?select=id,pseudo,score,exact_count,good_count,country_name')
if (!profiles.length) profiles = await sb('profiles?select=*')
const results  = await sb('match_results?select=match_id,home_score,away_score')
const R = {}; for (const r of results) R[r.match_id] = r

// Tous les paris (paginé).
let bets = []
for (let off = 0; ; off += 1000) {
  const rows = await sb(`bets?select=user_id,match_id,home_score,away_score,points,qualifier_short&order=user_id.asc&limit=1000&offset=${off}`)
  bets.push(...rows); if (rows.length < 1000) break
}
if (profiles[0]) console.error('🔎 colonnes profiles :', Object.keys(profiles[0]).join(', '))
const nameOf = {}; for (const p of profiles) nameOf[p.id] = p.pseudo

const N = profiles.length
const sorted = [...profiles].sort((a, b) =>
  (b.score - a.score) || ((b.exact_count ?? 0) - (a.exact_count ?? 0)) || ((b.good_count ?? 0) - (a.good_count ?? 0)))

console.log('=== CLASSEMENT FINAL (' + N + ' joueurs) ===')
sorted.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.pseudo.padEnd(16)} ${String(p.score).padStart(4)} pts · 🎯 ${p.exact_count ?? 0} exacts · ✓ ${p.good_count ?? 0} bons`))

const totalScore = profiles.reduce((s, p) => s + (p.score || 0), 0)
const avg = N ? Math.round(totalScore / N) : 0
console.log(`\n=== GLOBAL ===`)
console.log(`  Paris placés : ${bets.length} · Score moyen : ${avg} pts · Total distribué : ${totalScore} pts`)

// Sniper : le plus de scores exacts.
const bestExact = [...profiles].sort((a, b) => (b.exact_count ?? 0) - (a.exact_count ?? 0))[0]
console.log(`\n🎯 Sniper (scores exacts) : ${bestExact?.pseudo} — ${bestExact?.exact_count ?? 0} exacts`)

// Meilleur coup : le pari le plus rémunérateur (points max sur un match).
let best = null
for (const b of bets) if (b.points != null && (!best || b.points > best.points)) best = b
if (best) console.log(`💥 Plus gros coup : ${nameOf[best.user_id]} — ${best.points} pts sur ${best.match_id} (prono ${best.home_score}-${best.away_score})`)

// +7 (nul exact KO + bon qualifié) et +6.
const cnt = pts => bets.filter(b => b.points === pts).length
const who = pts => [...new Set(bets.filter(b => b.points === pts).map(b => nameOf[b.user_id]))]
console.log(`\n🔥 Paris à +7 : ${cnt(7)} → ${who(7).join(', ') || '—'}`)
console.log(`🥇 Paris à +6 : ${cnt(6)} → ${who(6).join(', ') || '—'}`)
console.log(`✅ Scores exacts (+5) : ${cnt(5)}`)

// Finale : qui a mis le score exact (ESP 1-0 → home 1, away 0) et qui avait vu l'Espagne gagner.
const fin = R['final']
if (fin) {
  const exactFinal = bets.filter(b => b.match_id === 'final' && b.home_score === fin.home_score && b.away_score === fin.away_score)
  const espWin = bets.filter(b => b.match_id === 'final' && b.home_score > b.away_score)
  console.log(`\n🏆 FINALE (réglée ${fin.home_score}-${fin.away_score}) :`)
  console.log(`   Score EXACT : ${exactFinal.length} → ${exactFinal.map(b => nameOf[b.user_id]).join(', ') || 'personne !'}`)
  console.log(`   Avaient vu l'Espagne gagner : ${espWin.length} → ${espWin.map(b => nameOf[b.user_id]).join(', ') || 'personne !'}`)
}

// Lanterne rouge (dernier) + moins de scores exacts (roast gentil).
const last = sorted[sorted.length - 1]
console.log(`\n🐢 Lanterne rouge : ${last?.pseudo} — ${last?.score} pts`)

// Écart 1er/2e et 2e/3e.
if (sorted.length >= 3) {
  console.log(`\n📏 Écarts : 1er→2e = ${sorted[0].score - sorted[1].score} pts · 2e→3e = ${sorted[1].score - sorted[2].score} pts`)
}
console.log('\n✅ Terminé.')
