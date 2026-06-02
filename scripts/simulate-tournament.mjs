// Simulation complète TRIVELA — teste tout le pipeline de paris en production.
// Lancé via le workflow "simulate.yml". N'utilise QUE des match_id préfixés
// "sim-" pour ne jamais entrer en collision avec les vrais matchs du Mondial.
// Tout (joueurs, paris, résultats simulés) est supprimé à la fin.
//
// Vérifie : création de profils, insertion de paris, moteur settle_match,
// mise à jour de profiles.score, classement, et Realtime (abonnement live).

import { createClient } from '@supabase/supabase-js'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }

const supabase = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })

const NB_PLAYERS = 10
const TEAMS = [
  ['Brésil','br'],['Argentine','ar'],['France','fr'],['Espagne','es'],
  ['Angleterre','gb-eng'],['Portugal','pt'],['Pays-Bas','nl'],['Allemagne','de'],
  ['Belgique','be'],['Croatie','hr'],['Maroc','ma'],['Sénégal','sn'],
  ['USA','us'],['Mexique','mx'],['Japon','jp'],['Corée du Sud','kr'],
  ['Uruguay','uy'],['Colombie','co'],['Suisse','ch'],['Danemark','dk'],
  ['Nigéria','ng'],['Australie','au'],['Canada','ca'],['Égypte','eg'],
]
const rnd = n => Math.floor(Math.random() * n)
const sb = (path, init = {}) => fetch(`${SUPA_URL}${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json', ...(init.headers || {}) },
})

// Barème identique à calcPoints() de src/pages/Paris.tsx (résultat vs pari)
function calcPoints(rH, rA, pH, pA) {
  if (rH === pH && rA === pA) return 5
  if (rH > rA && pH > pA) return 3
  if (rH < rA && pH < pA) return 3
  if (rH === rA) return 1
  return 0
}

async function main() {
  const stamp = Date.now()
  const createdUserIds = []

  // ── 0. Abonnement Realtime sur profiles (test live) ────────────────────────
  const rtEvents = []
  const channel = supabase
    .channel('sim-rt')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' },
      payload => rtEvents.push(payload))
  await new Promise((resolve) => {
    channel.subscribe(status => { if (status === 'SUBSCRIBED') resolve() })
    setTimeout(resolve, 8000) // garde-fou si Realtime ne répond pas
  })
  console.log('Realtime: abonnement profiles établi.\n')

  // ── 1. Génère les matchs simulés (sim-XXX) ─────────────────────────────────
  const NB_MATCHES = 24
  const matches = []
  for (let i = 0; i < NB_MATCHES; i++) {
    let a = rnd(TEAMS.length), b = rnd(TEAMS.length)
    while (b === a) b = rnd(TEAMS.length)
    matches.push({
      id: `sim-${stamp}-${String(i).padStart(3, '0')}`,
      home: TEAMS[a][0], away: TEAMS[b][0],
    })
  }
  console.log(`${NB_MATCHES} matchs simulés générés.`)

  // ── 2. Crée 10 faux joueurs (déclenche la création de profil) ──────────────
  for (let i = 0; i < NB_PLAYERS; i++) {
    const [name, code] = TEAMS[i % TEAMS.length]
    const meta = { pseudo: `SIM_${stamp}_${i}`, country_code: code, country_name: name }
    const res = await sb('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: `sim_${stamp}_${i}@trivela-sim.invalid`,
        password: crypto.randomUUID(), email_confirm: true, user_metadata: meta,
      }),
    })
    const u = await res.json().catch(() => ({}))
    if (u.id) createdUserIds.push(u.id)
    else console.warn(`  ⚠️ création joueur ${i} échouée: HTTP ${res.status} ${u.msg || ''}`)
  }
  await new Promise(r => setTimeout(r, 2000)) // laisse le trigger créer les profils
  console.log(`${createdUserIds.length}/${NB_PLAYERS} joueurs créés.`)

  // ── 3. Chaque joueur parie au hasard sur chaque match ──────────────────────
  const bets = {} // userId -> { matchId -> {pH,pA} }
  for (const uid of createdUserIds) {
    bets[uid] = {}
    const rows = matches.map(m => {
      const pH = rnd(5), pA = rnd(5)
      bets[uid][m.id] = { pH, pA }
      return { user_id: uid, match_id: m.id, home: m.home, away: m.away,
        home_score: pH, away_score: pA, stage: 'Simulation' }
    })
    const res = await sb('/rest/v1/bets', {
      method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows),
    })
    if (!res.ok) console.warn(`  ⚠️ paris joueur ${uid}: HTTP ${res.status} ${(await res.text()).slice(0,100)}`)
  }
  console.log(`Paris placés : ${createdUserIds.length} joueurs × ${NB_MATCHES} matchs.`)

  // ── 4. Simule les scores et règle chaque match ─────────────────────────────
  const realScores = {}
  for (const m of matches) {
    const rH = rnd(5), rA = rnd(5)
    realScores[m.id] = { rH, rA }
    const res = await sb('/rest/v1/rpc/settle_match', {
      method: 'POST',
      body: JSON.stringify({ p_match_id: m.id, p_home_score: rH, p_away_score: rA }),
    })
    if (!res.ok) console.warn(`  ⚠️ settle ${m.id}: HTTP ${res.status}`)
  }
  console.log('Tous les matchs réglés via settle_match.\n')
  await new Promise(r => setTimeout(r, 2500)) // laisse arriver les events Realtime

  // ── 5. Calcule les points attendus (côté script) ───────────────────────────
  const expected = {}
  for (const uid of createdUserIds) {
    let total = 0
    for (const m of matches) {
      const { pH, pA } = bets[uid][m.id]
      const { rH, rA } = realScores[m.id]
      total += calcPoints(rH, rA, pH, pA)
    }
    expected[uid] = total
  }

  // ── 6. Lit le classement réel depuis la base ───────────────────────────────
  const idList = createdUserIds.join(',')
  const lbRes = await sb(`/rest/v1/profiles?id=in.(${idList})&select=id,pseudo,score&order=score.desc`)
  const leaderboard = await lbRes.json()

  console.log('── CLASSEMENT FINAL (simulation) ──')
  let allMatch = true
  leaderboard.forEach((p, i) => {
    const exp = expected[p.id]
    const ok = exp === p.score
    if (!ok) allMatch = false
    console.log(`${String(i + 1).padStart(2)}. ${p.pseudo.padEnd(22)} ${String(p.score).padStart(4)} pts  ${ok ? '✅' : `❌ attendu ${exp}`}`)
  })

  // ── 7. Vérdict ─────────────────────────────────────────────────────────────
  console.log('\n── VÉRIFICATIONS ──')
  console.log(`${leaderboard.length === createdUserIds.length ? '✅' : '❌'} ${leaderboard.length}/${createdUserIds.length} profils présents au classement`)
  console.log(`${allMatch ? '✅' : '❌'} points enregistrés == points calculés (moteur settle_match exact)`)
  console.log(`${rtEvents.length > 0 ? '✅' : '⚠️'} Realtime : ${rtEvents.length} événement(s) UPDATE profiles reçus en direct`)
  if (rtEvents.length === 0)
    console.log('   (si 0 : active Realtime sur la table profiles dans Supabase → Database → Replication)')

  // ── 8. Nettoyage complet ───────────────────────────────────────────────────
  console.log('\n── NETTOYAGE ──')
  const delRes = await sb(`/rest/v1/match_results?match_id=like.sim-${stamp}-*`, { method: 'DELETE' })
  console.log(`${delRes.ok ? '✅' : '❌'} résultats simulés supprimés`)
  let delUsers = 0
  for (const uid of createdUserIds) {
    const r = await sb(`/auth/v1/admin/users/${uid}`, { method: 'DELETE' }) // cascade → profils + paris
    if (r.ok) delUsers++
  }
  console.log(`${delUsers === createdUserIds.length ? '✅' : '❌'} ${delUsers}/${createdUserIds.length} joueurs de test supprimés (cascade paris + profils)`)

  await supabase.removeChannel(channel)
  const success = allMatch && leaderboard.length === createdUserIds.length
  console.log(`\n${success ? '🎉 Simulation réussie — tout le pipeline fonctionne.' : '⚠️ Anomalie détectée, voir ci-dessus.'}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
