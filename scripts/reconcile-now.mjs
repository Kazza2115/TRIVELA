// Ponctuel : vérifie le classement, signale les joueurs dont profiles.score ≠ somme
// de leurs points (paris non comptabilisés), réconcilie (autoritaire), puis affiche
// le classement final. À retirer après exécution.
import { reconcileScores } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }

const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init,
  headers: {
    apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json', ...(init.headers || {}),
  },
})

// ── 1) DIAGNOSTIC AVANT : qui n'a pas (tous) ses points ? ────────────────────
const profiles = await (await sb('profiles?select=id,pseudo,score')).json()
const mismatches = []
for (const p of profiles) {
  const bets = await (await sb(`bets?user_id=eq.${p.id}&select=points`)).json()
  const expected = bets.reduce((s, b) => s + (b.points || 0), 0)
  if (expected !== p.score) mismatches.push({ pseudo: p.pseudo, stored: p.score, expected })
}
console.log(`\n🔎 ${profiles.length} joueur(s) au total.`)
if (mismatches.length === 0) {
  console.log('✅ Aucun écart : tout le monde a déjà ses points. Classement à jour.')
} else {
  console.log(`⚠️  ${mismatches.length} joueur(s) avec un score incorrect (avant correction) :`)
  for (const m of mismatches) {
    console.log(`   • ${m.pseudo} : affiché ${m.stored} → devrait être ${m.expected} (${m.expected - m.stored >= 0 ? '+' : ''}${m.expected - m.stored})`)
  }
}

// ── 2) RÉCONCILIATION AUTORITAIRE ────────────────────────────────────────────
const fixed = await reconcileScores(sb)
console.log(`\n⚖️  Réconciliation terminée : ${fixed} profil(s) corrigé(s).`)

// ── 3) CLASSEMENT FINAL ──────────────────────────────────────────────────────
const top = await (await sb('profiles?select=pseudo,score&order=score.desc,pseudo.asc&limit=20')).json()
console.log('\n🏆 Classement (top 20) :')
top.forEach((p, i) => console.log(`   ${String(i + 1).padStart(2)}. ${p.pseudo} — ${p.score} pts`))
