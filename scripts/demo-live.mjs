// Démo LIVE visible dans l'appli — crée 10 joueurs "DEMO" dont les scores
// montent progressivement, pour observer le Classement se mettre à jour en
// temps réel sur https://kazza2115.github.io/TRIVELA/ (onglet Classement).
//
// MODE=live    → crée les joueurs et règle les matchs un par un (laisse les données)
// MODE=cleanup → supprime tous les joueurs DEMO et résultats de démo
//
// N'utilise que des match_id préfixés "demo-" (jamais les vrais matchs).

import { createClient } from '@supabase/supabase-js'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const MODE     = process.env.MODE || 'live'
const DEMO_DOMAIN = '@trivela-demo.invalid'
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }

const supabase = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } })
const sb = (path, init = {}) => fetch(`${SUPA_URL}${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json', ...(init.headers || {}) },
})
const rnd   = n => Math.floor(Math.random() * n)
const sleep = ms => new Promise(r => setTimeout(r, ms))

const NAMES = [
  ['Alex','fr','France'], ['Marie','be','Belgique'], ['Luca','it','Italie'],
  ['Sofia','es','Espagne'], ['Tom','gb-eng','Angleterre'], ['Emma','de','Allemagne'],
  ['Noah','nl','Pays-Bas'], ['Lina','pt','Portugal'], ['Hugo','br','Brésil'],
  ['Clara','ar','Argentine'],
]
const TEAMS = ['Brésil','France','Espagne','Angleterre','Argentine','Portugal',
  'Allemagne','Belgique','Pays-Bas','Croatie','Maroc','Sénégal']

function calcPoints(rH, rA, pH, pA) {
  if (rH === pH && rA === pA) return 5
  if (rH > rA && pH > pA) return 3
  if (rH < rA && pH < pA) return 3
  if (rH === rA) return 1
  return 0
}

// ── Supprime tous les comptes de démo + résultats demo-* ─────────────────────
async function cleanup() {
  console.log('Nettoyage des données de démo…')
  await sb(`/rest/v1/match_results?match_id=like.demo-*`, { method: 'DELETE' })
  let page = 1, removed = 0
  for (;;) {
    const res = await sb(`/auth/v1/admin/users?page=${page}&per_page=200`)
    const body = await res.json().catch(() => ({}))
    const users = body.users || []
    if (users.length === 0) break
    for (const u of users) {
      if ((u.email || '').endsWith(DEMO_DOMAIN)) {
        const d = await sb(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
        if (d.ok) removed++
      }
    }
    if (users.length < 200) break
    page++
  }
  console.log(`✅ Nettoyage terminé — ${removed} joueur(s) DEMO supprimé(s).`)
}

async function live() {
  await cleanup() // repart propre

  const stamp = Date.now()
  console.log('\n▶️  DÉMO LIVE — ouvre le Classement : https://kazza2115.github.io/TRIVELA/\n')

  // 1. Crée les 10 joueurs DEMO
  const players = []
  for (let i = 0; i < NAMES.length; i++) {
    const [name, code, country] = NAMES[i]
    const res = await sb('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: `demo_${stamp}_${i}${DEMO_DOMAIN}`,
        password: crypto.randomUUID(), email_confirm: true,
        user_metadata: { pseudo: `DEMO ${name}`, country_code: code, country_name: country },
      }),
    })
    const u = await res.json().catch(() => ({}))
    if (u.id) players.push({ id: u.id, name: `DEMO ${name}`, bets: {} })
  }
  await sleep(2000)
  console.log(`${players.length} joueurs DEMO créés (visibles après le 1er match réglé).`)

  // 2. Génère 12 matchs et les paris aléatoires de chaque joueur
  const matches = []
  for (let i = 0; i < 12; i++) {
    let a = rnd(TEAMS.length), b = rnd(TEAMS.length)
    while (b === a) b = rnd(TEAMS.length)
    matches.push({ id: `demo-${stamp}-${i}`, home: TEAMS[a], away: TEAMS[b] })
  }
  for (const p of players) {
    const rows = matches.map(m => {
      const pH = rnd(4), pA = rnd(4)
      p.bets[m.id] = { pH, pA }
      return { user_id: p.id, match_id: m.id, home: m.home, away: m.away,
        home_score: pH, away_score: pA, stage: 'Démo' }
    })
    await sb('/rest/v1/bets', { method: 'POST',
      headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) })
  }
  console.log('Paris placés. Règlement des matchs un par un (toutes les 7 s)…\n')

  // 3. Règle un match toutes les 7 s → mises à jour visibles en direct
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const rH = rnd(4), rA = rnd(4)
    await sb('/rest/v1/rpc/settle_match', { method: 'POST',
      body: JSON.stringify({ p_match_id: m.id, p_home_score: rH, p_away_score: rA }) })
    for (const p of players) {
      const { pH, pA } = p.bets[m.id]
      p.score = (p.score || 0) + calcPoints(rH, rA, pH, pA)
    }
    const top = [...players].sort((x, y) => y.score - x.score)[0]
    console.log(`Match ${i + 1}/12 réglé (${m.home} ${rH}-${rA} ${m.away}) — leader: ${top.name} ${top.score} pts`)
    if (i < matches.length - 1) await sleep(7000)
  }

  console.log('\n✅ Démo terminée. Les 10 joueurs DEMO restent visibles dans le Classement.')
  console.log('   Quand tu as fini de regarder, lance le nettoyage (MODE=cleanup).')
  console.log('\n── Classement final de la démo ──')
  ;[...players].sort((a, b) => b.score - a.score)
    .forEach((p, i) => console.log(`${String(i + 1).padStart(2)}. ${p.name.padEnd(14)} ${p.score} pts`))
}

async function main() {
  if (MODE === 'cleanup') await cleanup()
  else await live()
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
