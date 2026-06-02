// Test social — crée des joueurs DEMO avec pronostics, puis les fait se NOTER,
// COMMENTER et réagir (👍/👎) entre eux ET sur les pronostics de l'utilisateur,
// pour pouvoir tester la page profil sans avoir à créer plusieurs comptes.
//
// MODE=seed     → crée les données de démo sociale (laisse tout en place)
// MODE=cleanup  → supprime tous les joueurs DEMO sociaux + leurs interactions
//
// Tout est préfixé : comptes @trivela-social.invalid, matchs "social-…".
// Le nettoyage (cleanup) retire AUSSI les notes/commentaires/réactions que les
// comptes DEMO ont posés sur les vrais pronostics (cascade via les FK).

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const MODE     = process.env.MODE || 'seed'
const USER_EMAIL = process.env.TARGET_EMAIL || 'thebigchungus08@gmail.com'
const DOMAIN   = '@trivela-social.invalid'
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }

const sb = (path, init = {}) => fetch(`${SUPA_URL}${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json', ...(init.headers || {}) },
})
const rnd   = n => Math.floor(Math.random() * n)
const pick  = a => a[rnd(a.length)]
const sleep = ms => new Promise(r => setTimeout(r, ms))

const PLAYERS = [
  ['DEMO Léa', 'fr', 'France'],
  ['DEMO Max', 'be', 'Belgique'],
  ['DEMO Zoé', 'pt', 'Portugal'],
]

// Vrais matchs à venir → resteront MASQUÉS 🔒 (démontre l'équité avant coup d'envoi)
const REAL_MATCHES = [
  { id: 'gA-md1-mex-zaf', home: 'Mexique',    away: 'Afrique du Sud', stage: 'Groupe A' },
  { id: 'gC-md1-bra-mar', home: 'Brésil',     away: 'Maroc',          stage: 'Groupe C' },
  { id: 'gI-md1-fra-sen', home: 'France',     away: 'Sénégal',        stage: 'Groupe I' },
  { id: 'gL-md1-eng-cro', home: 'Angleterre', away: 'Croatie',        stage: 'Groupe L' },
]

const COMMENTS = [
  'Bonne analyse 👍', 'Tu rêves là 😂', 'Risqué mais j\'aime bien',
  'Jamais ce score', 'Solide, je valide', 'Trop optimiste à mon goût',
  'Le nul me semble plus probable', 'Banco, même prono que moi !',
]

async function adminUsers() {
  const out = []
  for (let page = 1; ; page++) {
    const res = await sb(`/auth/v1/admin/users?page=${page}&per_page=200`)
    const body = await res.json().catch(() => ({}))
    const users = body.users || []
    out.push(...users)
    if (users.length < 200) break
  }
  return out
}

async function cleanup() {
  console.log('🧹 Nettoyage de la démo sociale…')
  const users = await adminUsers()
  let removed = 0
  for (const u of users) {
    if ((u.email || '').endsWith(DOMAIN)) {
      const d = await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
      if (d.ok) removed++
    }
  }
  await sb(`/rest/v1/match_results?match_id=like.social-*`, { method: 'DELETE' })
  await sb(`/rest/v1/match_schedule?match_id=like.social-*`, { method: 'DELETE' })
  console.log(`✅ ${removed} compte(s) DEMO social supprimé(s) (notes/commentaires/réactions retirés en cascade).`)
}

async function insert(table, rows, representation = false) {
  const res = await sb(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: representation ? 'return=representation' : 'return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!res.ok) { console.error(`❌ insert ${table}:`, res.status, await res.text().catch(() => '')) ; return [] }
  return representation ? res.json() : []
}

async function seed() {
  await cleanup()
  const stamp = Date.now()
  console.log('\n▶️  Création de la démo sociale…\n')

  // 1. Comptes DEMO
  const players = []
  for (let i = 0; i < PLAYERS.length; i++) {
    const [pseudo, code, country] = PLAYERS[i]
    const res = await sb('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: `social_${stamp}_${i}${DOMAIN}`,
        password: crypto.randomUUID(), email_confirm: true,
        user_metadata: { pseudo, country_code: code, country_name: country },
      }),
    })
    const u = await res.json().catch(() => ({}))
    if (u.id) players.push({ id: u.id, pseudo, code, country })
    else console.error('❌ création joueur:', JSON.stringify(u))
  }
  await sleep(1500) // laisse le trigger créer les profils
  console.log(`👤 ${players.length} joueurs DEMO créés.`)

  // 2. Matchs DEMO (seront RÉGLÉS → scores + points visibles)
  const DEMO_MATCHES = [
    { id: `social-${stamp}-1`, home: 'Brésil',   away: 'Espagne',  stage: 'Démo (réglé)' },
    { id: `social-${stamp}-2`, home: 'France',   away: 'Allemagne',stage: 'Démo (réglé)' },
    { id: `social-${stamp}-3`, home: 'Argentine',away: 'Portugal', stage: 'Démo (réglé)' },
  ]
  const ALL_MATCHES = [...REAL_MATCHES, ...DEMO_MATCHES]

  // 3. Paris de chaque joueur (réels = masqués, démo = révélés après règlement)
  for (const p of players) {
    const rows = ALL_MATCHES.map(m => ({
      user_id: p.id, match_id: m.id, home: m.home, away: m.away,
      home_score: rnd(4), away_score: rnd(3), stage: m.stage,
    }))
    await insert('bets', rows)
  }
  console.log(`🎯 Paris placés (${ALL_MATCHES.length} matchs / joueur).`)

  // 4. Règle les matchs DEMO → révèle les scores et attribue des points
  for (const m of DEMO_MATCHES) {
    await sb('/rest/v1/rpc/settle_match', { method: 'POST',
      body: JSON.stringify({ p_match_id: m.id, p_home_score: rnd(4), p_away_score: rnd(3) }) })
  }
  console.log('⚽ Matchs DEMO réglés (scores + points visibles).')

  // 5. Cible aussi l'utilisateur réel : ses pronostics recevront notes/commentaires
  const all = await adminUsers()
  const me = all.find(u => (u.email || '').toLowerCase() === USER_EMAIL.toLowerCase())
  let myBets = []
  if (me) {
    const res = await sb(`/rest/v1/bets?user_id=eq.${me.id}&select=match_id,home,away,stage&limit=6`)
    myBets = await res.json().catch(() => [])
    console.log(`📨 ${myBets.length} pronostic(s) de ton compte trouvé(s) → ils recevront des notes/commentaires.`)
  } else {
    console.log(`⚠️  Compte ${USER_EMAIL} introuvable — on note seulement entre joueurs DEMO.`)
  }

  // Cibles à noter/commenter : (joueur DEMO, ses matchs) + (toi, tes matchs)
  const targets = players.map(p => ({ id: p.id, matchIds: ALL_MATCHES.map(m => m.id) }))
  if (me && myBets.length) targets.push({ id: me.id, matchIds: myBets.map(b => b.match_id) })

  // 6. Notes ⭐, commentaires 💬 et réactions 👍/👎
  let nRatings = 0, nComments = 0, nReactions = 0
  const createdComments = [] // { id, authorId }
  for (const t of targets) {
    for (const raterP of players) {
      if (raterP.id === t.id) continue // pas d'auto-note
      // chaque joueur DEMO note ~la moitié des matchs de la cible
      for (const mid of t.matchIds) {
        if (Math.random() < 0.4) continue
        const r = await sb('/rest/v1/bet_ratings?on_conflict=match_id,target_user_id,rater_id', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ match_id: mid, target_user_id: t.id, rater_id: raterP.id, rating: 3 + rnd(3) }),
        })
        if (r.ok) nRatings++
        if (Math.random() < 0.6) {
          const c = await insert('bet_comments', [{
            match_id: mid, target_user_id: t.id, author_id: raterP.id,
            author_pseudo: raterP.pseudo, body: pick(COMMENTS),
          }], true)
          if (c[0]?.id) { createdComments.push({ id: c[0].id, authorId: raterP.id }); nComments++ }
        }
      }
    }
  }

  // 7. Réactions 👍/👎 sur les commentaires (par les autres joueurs DEMO)
  for (const c of createdComments) {
    for (const reactor of players) {
      if (reactor.id === c.authorId) continue
      if (Math.random() < 0.5) continue
      const r = await sb('/rest/v1/comment_reactions?on_conflict=comment_id,user_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ comment_id: c.id, user_id: reactor.id, value: Math.random() < 0.7 ? 1 : -1 }),
      })
      if (r.ok) nReactions++
    }
  }

  console.log(`\n✅ Démo sociale prête : ${nRatings} notes · ${nComments} commentaires · ${nReactions} réactions.`)
  console.log('\n──────────────────────────────────────────────')
  console.log('À TESTER sur https://kazza2115.github.io/TRIVELA/ (recharge forcée) :')
  console.log(' 1. Classement → clique un joueur "DEMO" → vois ses pronos, notes ⭐, commentaires 💬, 👍/👎.')
  console.log('    • Matchs DEMO (réglés) : score + points visibles.')
  console.log('    • Vrais matchs à venir : 🔒 masqués (équité avant coup d\'envoi).')
  console.log(' 2. Connecté avec TON compte, sur le profil d\'un DEMO → tu peux NOTER ⭐ et réagir 👍/👎.')
  console.log(' 3. Va sur TON propre profil → tu verras "Note reçue" + commentaires laissés par les DEMO.')
  console.log('\nQuand tu as fini : relance ce workflow en MODE=cleanup.')
}

async function main() {
  if (MODE === 'cleanup') await cleanup()
  else await seed()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
