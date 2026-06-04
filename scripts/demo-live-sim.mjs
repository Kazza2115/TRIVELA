// Démo : simule un match EN DIRECT (France–Sénégal) en mettant à jour match_live
// toutes les ~22 s avec des buts, pour visualiser le rendu live + les flammes.
// Se nettoie tout seul à la fin. Re-upsert à chaque étape → résiste au poller.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const MATCH = 'gI-md1-fra-sen' // France (dom) vs Sénégal (ext)

const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const sleep = ms => new Promise(r => setTimeout(r, ms))

const STEPS = [
  { status: '1H', elapsed: 8,  h: 0, a: 0, note: 'coup d\'envoi' },
  { status: '1H', elapsed: 23, h: 1, a: 0, note: '⚽ BUT France' },
  { status: 'HT', elapsed: 45, h: 1, a: 0, note: 'mi-temps' },
  { status: '2H', elapsed: 58, h: 1, a: 1, note: '⚽ BUT Sénégal' },
  { status: '2H', elapsed: 74, h: 2, a: 1, note: '⚽ BUT France' },
  { status: '2H', elapsed: 88, h: 2, a: 1, note: 'fin de match proche' },
]

async function upsert(s) {
  await sb('match_live?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ match_id: MATCH, status: s.status, elapsed: s.elapsed,
      home_score: s.h, away_score: s.a, updated_at: new Date().toISOString() }),
  })
}

async function main() {
  console.log('▶️ Simulation live France–Sénégal')
  for (const s of STEPS) {
    await upsert(s)
    console.log(`  ${s.elapsed}' ${s.h}-${s.a} · ${s.note}`)
    await sleep(22000)
  }
  await sleep(8000)
  await sb(`match_live?match_id=eq.${MATCH}`, { method: 'DELETE' })
  console.log('🧹 Démo terminée et nettoyée.')
}
main().catch(e => { console.error(e); process.exit(0) })
