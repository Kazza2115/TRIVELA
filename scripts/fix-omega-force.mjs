// Ponctuel : FORCE le prono d'Omega sur Irak–Norvège (J1, déjà joué) → 0–2,
// recalcule ses points et le classement. Demandé explicitement par l'admin. À retirer.
import { betPoints, reconcileScores } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})

const PSEUDO = 'Omega', MID = 'gI-md1-irq-nor'
const HOME = 'Irak', AWAY = 'Norvège', HS = 0, AS = 2, STAGE = 'Groupe I · J1'

// 1) Omega
const profs = await (await sb(`profiles?pseudo=ilike.${encodeURIComponent(PSEUDO)}&select=id,pseudo,score`)).json()
if (!Array.isArray(profs) || profs.length !== 1) { console.log('⚠️ Omega introuvable ou ambigu — abandon.', JSON.stringify(profs)); process.exit(0) }
const me = profs[0], uid = me.id
console.log('Omega AVANT:', JSON.stringify(me))

// 2) Résultat réel du match
const rr = await (await sb(`match_results?match_id=eq.${MID}&select=home_score,away_score`)).json()
if (!Array.isArray(rr) || !rr.length) { console.log('❌ Aucun résultat pour ce match — abandon.'); process.exit(0) }
const real = rr[0]
console.log(`Résultat réel : Irak ${real.home_score}–${real.away_score} Norvège`)

// 3) Pari actuel d'Omega
const old = await (await sb(`bets?user_id=eq.${uid}&match_id=eq.${MID}&select=home_score,away_score,points,locked`)).json()
console.log('Pari Omega AVANT:', JSON.stringify(old))

// 4) Nouveaux points pour 0–2
const newPts = betPoints(HS, AS, real.home_score, real.away_score)
console.log(`Nouveau pari ${HS}–${AS} → ${newPts} point(s)`)

// 5) Upsert du pari (force, verrouillé car match joué)
const up = await sb('bets?on_conflict=user_id,match_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ user_id: uid, match_id: MID, home: HOME, away: AWAY, home_score: HS, away_score: AS, stage: STAGE, points: newPts, locked: true }]),
})
console.log('Upsert pari HTTP', up.status)

// 6) Réconciliation (score = somme des points), idempotent
const fixed = await reconcileScores(sb)
console.log('Réconciliation : profils corrigés =', fixed)

// 7) Audit final
const af = await (await sb(`profiles?id=eq.${uid}&select=pseudo,score`)).json()
const newScore = af[0]?.score
console.log('Omega APRÈS:', JSON.stringify(af))
console.log(`Δ score Omega : ${me.score} → ${newScore} (${newScore - me.score >= 0 ? '+' : ''}${newScore - me.score})`)
