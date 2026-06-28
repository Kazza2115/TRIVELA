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

// Table nom FR → code court (équipes susceptibles d'apparaître en phase finale).
const FR2SHORT = {
  'Brésil': 'BRA', 'Argentine': 'ARG', 'Colombie': 'COL', 'Uruguay': 'URU', 'Équateur': 'ECU',
  'Paraguay': 'PAR', 'France': 'FRA', 'Allemagne': 'GER', 'Espagne': 'ESP', 'Angleterre': 'ENG',
  'Portugal': 'POR', 'Pays-Bas': 'NED', 'Belgique': 'BEL', 'Suisse': 'SUI', 'Croatie': 'CRO',
  'Autriche': 'AUT', 'Norvège': 'NOR', 'Suède': 'SWE', 'Écosse': 'SCO', 'Tchéquie': 'CZE',
  'Irlande du Nord': 'NIR', 'États-Unis': 'USA', 'Mexique': 'MEX', 'Canada': 'CAN', 'Panama': 'PAN',
  'Haïti': 'HAI', 'Curaçao': 'CUR', 'Japon': 'JPN', 'Corée du Sud': 'KOR', 'Iran': 'IRN',
  'Australie': 'AUS', 'Arabie Saoudite': 'SAU', 'Irak': 'IRQ', 'Jordanie': 'JOR', 'Ouzbékistan': 'UZB',
  'Qatar': 'QAT', 'Turquie': 'TUR', 'Maroc': 'MAR', 'Sénégal': 'SEN', 'Égypte': 'EGY',
  'Afrique du Sud': 'ZAF', 'Algérie': 'DZA', 'RD Congo': 'COD', 'Ghana': 'GHA', 'Tunisie': 'TUN',
  'Nouvelle-Zélande': 'NZL', 'Cap-Vert': 'CPV', 'Bosnie-Herzégovine': 'BIH', 'Côte d\'Ivoire': 'CIV',
}
const toShort = n => FR2SHORT[(n || '').trim()] || (n || '').trim().toUpperCase()

// 1) Bracket (slot → équipes).
const ko = {}
for (const r of await (await sb('knockout_teams?select=match_id,home_short,away_short,source')).json()) ko[r.match_id] = r
// Index inverse : paire d'équipes {A,B} (triée) → slot du bracket.
const pairToSlot = {}
for (const [id, t] of Object.entries(ko)) {
  if (t.home_short && t.away_short) pairToSlot[[t.home_short, t.away_short].sort().join('|')] = id
}

// 0) Profils (pseudo) pour rendre le rapport lisible.
const pseudo = {}
try { for (const p of await (await sb('profiles?select=id,pseudo')).json()) pseudo[p.id] = p.pseudo } catch {}
const who = uid => pseudo[uid] || uid.slice(0, 8)

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

// === Paris mal rattachés (placés avant le réordonnancement du bracket) ===
// Pour chaque pari KO, on déduit le slot VISÉ depuis la paire d'équipes stockée,
// puis on le compare au slot réellement enregistré.
console.log('\n=== PARIS MAL RATTACHÉS (slot enregistré ≠ affiche pariée) ===')
const misslots = []
for (const b of koBets) {
  const hs = toShort(b.home), as = toShort(b.away)
  const target = pairToSlot[[hs, as].sort().join('|')]
  if (target && target !== b.match_id) misslots.push({ b, hs, as, target })
}
if (!misslots.length) {
  console.log('  ✅ Aucun — tous les paris KO sont rattachés au bon slot.')
} else {
  // Un pari sur le slot cible existe-t-il déjà pour ce joueur ? (risque de collision si on déplace)
  const occupied = new Set(koBets.map(b => `${b.user_id}|${b.match_id}`))
  for (const m of misslots.sort((a, b) => a.target.localeCompare(b.target, undefined, { numeric: true }))) {
    const coll = occupied.has(`${m.b.user_id}|${m.target}`)
    const sc = `${m.b.home_score}-${m.b.away_score}`
    console.log(`  ${who(m.b.user_id).padEnd(16)} ${m.hs}-${m.as} (${sc})  : ${m.b.match_id} → devrait être ${m.target}${coll ? '  ⚠️ COLLISION (pari déjà présent sur la cible)' : ''}`)
  }
  console.log(`\n  → ${misslots.length} pari(s) à redéplacer, ${misslots.filter(m => occupied.has(`${m.b.user_id}|${m.target}`)).length} collision(s).`)
}

console.log('\n=== SYNTHÈSE ===')
console.log('Slots KO avec au moins 1 pari :', slots.filter(id => (byMatch[id] || []).length).length)
console.log('Total paris KO               :', koBets.length)
console.log('Joueurs distincts (KO)       :', new Set(koBets.map(b => b.user_id)).size)
console.log('Joueurs distincts (tous paris):', new Set(bets.map(b => b.user_id)).size)
// Qui n'a pas (encore) parié sur les éliminatoires ?
const koPlayers = new Set(koBets.map(b => b.user_id))
const allPlayers = new Set(bets.map(b => b.user_id))
const missing = [...allPlayers].filter(u => !koPlayers.has(u))
if (missing.length) console.log('Joueurs SANS aucun pari KO    :', missing.map(who).join(', '))
console.log('\n✅ Terminé.')
