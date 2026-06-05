// Remet tous les matchs à 0 : supprime résultats + live, et remet les scores des joueurs à 0.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
async function main() {
  const r1 = await sb('match_results?match_id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  console.log('match_results supprimés →', r1.status)
  const r2 = await sb('match_live?match_id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  console.log('match_live supprimés →', r2.status)
  const r3 = await sb('profiles?id=not.is.null', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ score: 0 }) })
  console.log('scores joueurs remis à 0 →', r3.status)
  console.log('✅ Tous les matchs remis à 0.')
}
main().catch(e => { console.error(e); process.exit(1) })
