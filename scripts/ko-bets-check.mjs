// Ponctuel (lecture seule) : vérifie l'état des paris sur les matchs éliminatoires.
// Pour chaque slot KO : équipes du bracket, coup d'envoi (match_schedule), nb de paris,
// et le détail des affiches réellement pariées (pour repérer un pari rattaché à un ancien slot).
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})
const KO_RE = /^(r32|r16|qf|sf|3rd|final)/

// 1) Bracket (slot → équipes).
const ko = {}
for (const r of await (await sb('knockout_teams?select=match_id,home_short,away_short,source')).json()) ko[r.match_id] = r

// 2) Calendrier (slot → coup d'envoi).
const sched = {}
for (const r of await (await sb('match_schedule?select=match_id,kickoff')).json()) sched[r.match_id] = r.kickoff

// 3) Tous les paris (paginé).
const bets = []
for (let off = 0; ; off += 1000) {
  const r = await sb(`bets?select=match_id,home,away,user_id,home_score,away_score,locked&order=match_id.asc&limit=1000&offset=${off}`)
  if (!r.ok) { console.error('lecture bets KO:', r.status, await r.text()); break }
  const rows = await r.json(); bets.push(...rows)
  if (rows.length < 1000) break
}
const koBets = bets.filter(b => KO_RE.test(b.match_id))

// Regroupe par slot.
const byMatch = {}
for (const b of koBets) (byMatch[b.match_id] ||= []).push(b)

const slots = [...new Set([...Object.keys(ko), ...Object.keys(byMatch)])].filter(id => KO_RE.test(id))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

console.log('=== ÉTAT DES PARIS — MATCHS ÉLIMINATOIRES ===\n')
for (const id of slots) {
  const t = ko[id]
  const slot = t ? `${t.home_short || '?'} - ${t.away_short || '?'}` : '⚠️ (aucune équipe dans le bracket)'
  const k = sched[id] || '⚠️ (absent de match_schedule)'
  const list = byMatch[id] || []
  console.log(`[${id.padEnd(7)}] bracket: ${slot.padEnd(16)} | kickoff: ${k} | paris: ${list.length}`)
  // Détail des affiches réellement pariées (équipes stockées au moment du pari).
  const pairs = {}
  for (const b of list) { const key = `${b.home} / ${b.away}`; pairs[key] = (pairs[key] || 0) + 1 }
  for (const [pair, n] of Object.entries(pairs).sort((a, b) => b[1] - a[1])) {
    console.log(`            ${String(n).padStart(3)}×  ${pair}`)
  }
}

console.log('\n=== SYNTHÈSE ===')
console.log('Slots KO avec au moins 1 pari :', slots.filter(id => (byMatch[id] || []).length).length)
console.log('Total paris KO               :', koBets.length)
console.log('Joueurs distincts (KO)       :', new Set(koBets.map(b => b.user_id)).size)
console.log('Joueurs distincts (tous paris):', new Set(bets.map(b => b.user_id)).size)
console.log('\n✅ Terminé.')
