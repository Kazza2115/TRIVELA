// Ponctuel : prono KAZA sur Canada–Qatar (J2) → 2–0. Si match joué : points + recalcul. À retirer.
import { betPoints, reconcileScores } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})

const PSEUDO = 'KAZA', MID = 'gB-md2-can-qat'
const HOME = 'Canada', AWAY = 'Qatar', HS = 2, AS = 0, STAGE = 'Groupe B · J2'

const profs = await (await sb(`profiles?pseudo=ilike.${encodeURIComponent(PSEUDO)}&select=id,pseudo,score`)).json()
if (!Array.isArray(profs) || profs.length !== 1) { console.log('⚠️ KAZA introuvable ou ambigu — abandon.', JSON.stringify(profs)); process.exit(0) }
const me = profs[0], uid = me.id
console.log('KAZA AVANT:', JSON.stringify(me))

const rr = await (await sb(`match_results?match_id=eq.${MID}&select=home_score,away_score`)).json()
const settled = Array.isArray(rr) && rr.length > 0
let pts = null
if (settled) { pts = betPoints(HS, AS, rr[0].home_score, rr[0].away_score); console.log(`Résultat réel : Canada ${rr[0].home_score}–${rr[0].away_score} Qatar → ${pts} pt(s)`) }
else console.log('Match non encore joué (édition simple, sans points).')

const old = await (await sb(`bets?user_id=eq.${uid}&match_id=eq.${MID}&select=home_score,away_score,points,locked`)).json()
console.log('Pari KAZA AVANT:', JSON.stringify(old))

const row = { user_id: uid, match_id: MID, home: HOME, away: AWAY, home_score: HS, away_score: AS, stage: STAGE, locked: settled }
if (settled) row.points = pts
const up = await sb('bets?on_conflict=user_id,match_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([row]),
})
console.log('Upsert pari HTTP', up.status)

if (settled) { const fixed = await reconcileScores(sb); console.log('Réconciliation : profils corrigés =', fixed) }

const af = await (await sb(`profiles?id=eq.${uid}&select=pseudo,score`)).json()
const ns = af[0]?.score
console.log('KAZA APRÈS:', JSON.stringify(af))
console.log(`Δ score KAZA : ${me.score} → ${ns} (${ns - me.score >= 0 ? '+' : ''}${ns - me.score})`)
