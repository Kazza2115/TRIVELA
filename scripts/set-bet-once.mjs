// Ponctuel : écrit/corrige le prono d'UN joueur sur UN match (clé service role).
// Mécanisme de secours quand l'éditeur in-app n'est pas utilisable. Paramétré par env.
// Si le match est déjà réglé : calcule les points (verrouillés) + réconcilie le classement.
import { betPoints, reconcileScores } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})

const PSEUDO   = process.env.BET_PSEUDO
const MATCH_ID = process.env.BET_MATCH_ID
const HOME_NM  = process.env.BET_HOME_NAME
const AWAY_NM  = process.env.BET_AWAY_NAME
const HOME     = Number(process.env.BET_HOME)
const AWAY     = Number(process.env.BET_AWAY)
const STAGE    = process.env.BET_STAGE || ''
const QUALIF   = (process.env.BET_QUALIFIER || '').trim().toUpperCase() || null   // KO : qualifié choisi (prono nul)
if (!PSEUDO || !MATCH_ID || !HOME_NM || !AWAY_NM || !Number.isFinite(HOME) || !Number.isFinite(AWAY)) {
  console.error('❌ Paramètres manquants (BET_PSEUDO, BET_MATCH_ID, BET_HOME_NAME, BET_AWAY_NAME, BET_HOME, BET_AWAY).'); process.exit(1)
}

// 1) Profil du joueur (insensible à la casse).
const pr = await sb(`profiles?pseudo=ilike.${encodeURIComponent(PSEUDO)}&select=id,pseudo,score`)
const profs = pr.ok ? await pr.json() : []
if (!profs.length) { console.error(`❌ Aucun joueur « ${PSEUDO} ».`); process.exit(1) }
let prof = profs.find(p => p.pseudo.toLowerCase() === PSEUDO.toLowerCase()) || (profs.length === 1 ? profs[0] : null)
if (!prof) { console.error(`❌ Plusieurs joueurs correspondent : ${profs.map(p => p.pseudo).join(', ')}.`); process.exit(1) }
console.log(`Joueur : ${prof.pseudo} (${prof.id}) · score actuel ${prof.score}`)

// 2) Match déjà réglé ?
const rr = await sb(`match_results?match_id=eq.${MATCH_ID}&select=home_score,away_score`)
const res = rr.ok ? (await rr.json())[0] : null
const settled = !!res
console.log(`Match ${MATCH_ID} : ${settled ? `RÉGLÉ ${res.home_score}-${res.away_score}` : 'pas encore réglé'}`)

// 3) Upsert du prono. (qualifier_short : utile pour un prono NUL en phase KO → bonus +2.)
const row = { user_id: prof.id, match_id: MATCH_ID, home: HOME_NM, away: AWAY_NM, home_score: HOME, away_score: AWAY, stage: STAGE, locked: settled }
if (QUALIF) row.qualifier_short = QUALIF
if (settled) row.points = betPoints(HOME, AWAY, res.home_score, res.away_score)   // placeholder ; reconcileScores recalcule avec le bonus KO
let up = await sb('bets?on_conflict=user_id,match_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([row]),
})
// Repli si la colonne qualifier_short n'existe pas encore (migration non appliquée).
if (!up.ok && QUALIF) {
  const { qualifier_short, ...rowNoQ } = row
  up = await sb('bets?on_conflict=user_id,match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([rowNoQ]),
  })
}
if (!up.ok) { console.error(`❌ Échec écriture (${up.status}) : ${await up.text()}`); process.exit(1) }
console.log(`✅ Prono enregistré : ${HOME_NM} ${HOME}-${AWAY} ${AWAY_NM}${QUALIF ? ` · qualifié ${QUALIF}` : ''}${settled ? ` → ${row.points} pt(s) (avant bonus KO)` : ''}`)

// 4) Si réglé, réconcilie le classement (score = somme des points).
if (settled) {
  const fixed = await reconcileScores(sb)
  console.log(`✅ Classement réconcilié (${fixed} profil(s) corrigé(s)).`)
}
console.log('✅ Terminé.')
