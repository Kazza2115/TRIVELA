// Ponctuel : corrige le prono d'Omega → Irak 0–2 Norvège (gI-md1-irq-nor). À retirer.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})

const PSEUDO = 'Omega', MID = 'gI-md1-irq-nor'
const HOME = 'Irak', AWAY = 'Norvège', HS = 0, AS = 2, STAGE = 'Groupe I · J1'

// 1) Trouver Omega
const profs = await (await sb(`profiles?pseudo=ilike.${encodeURIComponent(PSEUDO)}&select=id,pseudo`)).json()
console.log('Profils trouvés:', JSON.stringify(profs))
if (!Array.isArray(profs) || profs.length === 0) { console.log('❌ Omega introuvable — abandon.'); process.exit(0) }
if (profs.length > 1) { console.log('⚠️ Plusieurs « Omega » — abandon par prudence.'); process.exit(0) }
const uid = profs[0].id

// 2) Refuser si le match est déjà réglé
const res = await (await sb(`match_results?match_id=eq.${MID}&select=match_id`)).json()
if (Array.isArray(res) && res.length) { console.log('❌ Match déjà réglé — correction refusée (équité).'); process.exit(0) }

// 3) Pari existant ?
const before = await (await sb(`bets?user_id=eq.${uid}&match_id=eq.${MID}&select=home_score,away_score,locked`)).json()
console.log('Avant:', JSON.stringify(before))

// 4) Upsert (sur la contrainte unique user_id+match_id)
const r = await sb('bets?on_conflict=user_id,match_id', {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify([{ user_id: uid, match_id: MID, home: HOME, away: AWAY, home_score: HS, away_score: AS, stage: STAGE, locked: false }]),
})
console.log('Upsert HTTP', r.status, (await r.text()).slice(0, 300))

// 5) Vérification
const after = await (await sb(`bets?user_id=eq.${uid}&match_id=eq.${MID}&select=home,away,home_score,away_score,locked`)).json()
console.log('Après:', JSON.stringify(after))
console.log(`✅ ${PSEUDO} → ${HOME} ${HS}–${AS} ${AWAY} (2–0 Norvège)`)
