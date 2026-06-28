// Ponctuel : re-rattache les paris éliminatoires placés AVANT le réordonnancement
// du bracket (slot enregistré ≠ affiche réellement pariée). On déduit le bon slot
// depuis la paire d'équipes stockée dans le pari, puis on corrige match_id.
//
//   • APPLY non défini → RAPPORT seul : liste les corrections, n'écrit rien.
//   • APPLY=1          → applique les corrections.
//
// Sûr face à la contrainte unique (user_id, match_id) : comme les corrections d'un
// même joueur forment une permutation, on passe par un match_id temporaire puis on
// pose le slot définitif (deux PATCH par pari, ciblés par PK `id`). Idempotent. À retirer après usage.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const APPLY = process.env.APPLY === '1'
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})
const KO_RE = /^(r32|r16|qf|sf|3rd|final)/

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

console.log(`=== KO-BETS-FIX (${APPLY ? 'ÉCRITURE' : 'RAPPORT seul'}) ===`)

// Bracket : paire {A,B} triée → slot.
const ko = {}
for (const r of await (await sb('knockout_teams?select=match_id,home_short,away_short')).json()) ko[r.match_id] = r
const pairToSlot = {}
for (const [id, t] of Object.entries(ko))
  if (t.home_short && t.away_short) pairToSlot[[t.home_short, t.away_short].sort().join('|')] = id

const pseudo = {}
try { for (const p of await (await sb('profiles?select=id,pseudo')).json()) pseudo[p.id] = p.pseudo } catch {}
const who = uid => pseudo[uid] || uid.slice(0, 8)

// Tous les paris KO (avec PK id).
const bets = []
for (let off = 0; ; off += 1000) {
  const r = await sb(`bets?select=id,match_id,home,away,user_id,home_score,away_score,locked&limit=1000&offset=${off}`)
  if (!r.ok) { console.error('lecture bets:', r.status, await r.text()); process.exit(1) }
  const rows = await r.json(); bets.push(...rows)
  if (rows.length < 1000) break
}
const koBets = bets.filter(b => KO_RE.test(b.match_id))

const moves = []
for (const b of koBets) {
  const target = pairToSlot[[toShort(b.home), toShort(b.away)].sort().join('|')]
  if (target && target !== b.match_id) moves.push({ b, target })
}

console.log(`\n${moves.length} pari(s) à re-rattacher :`)
for (const m of moves.sort((a, b) => who(a.b.user_id).localeCompare(who(b.b.user_id))))
  console.log(`  ${who(m.b.user_id).padEnd(16)} ${m.b.home} / ${m.b.away} (${m.b.home_score}-${m.b.away_score})  ${m.b.match_id} → ${m.target}`)

if (!moves.length) { console.log('\n✅ Rien à corriger.'); process.exit(0) }
if (!APPLY) { console.log('\nℹ️  Mode RAPPORT : aucune écriture. Relancer avec APPLY=1 pour appliquer.'); process.exit(0) }

// Phase 1 : slot temporaire unique (évite toute collision de la permutation).
for (const m of moves) {
  const tmp = `__tmp_${m.b.id}`
  const r = await sb(`bets?id=eq.${m.b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ match_id: tmp }) })
  if (!r.ok) { console.error(`❌ Phase 1 ${m.b.id}: ${r.status} ${await r.text()}`); process.exit(1) }
}
// Phase 2 : slot définitif.
for (const m of moves) {
  const r = await sb(`bets?id=eq.${m.b.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ match_id: m.target }) })
  if (!r.ok) { console.error(`❌ Phase 2 ${m.b.id} → ${m.target}: ${r.status} ${await r.text()}`); process.exit(1) }
}
console.log(`\n✅ ${moves.length} pari(s) re-rattaché(s) au bon slot.`)
