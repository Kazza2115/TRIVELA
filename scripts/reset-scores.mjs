// One-off : remet l'app à zéro pour la Coupe du Monde.
// Vide résultats / live / buteurs, supprime les paris du match test (fr-nir),
// déverrouille les paris restants et remet tous les scores à 0.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant'); process.exit(1) }

const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

async function main() {
  const del   = async p => { const r = await sb(p, { method: 'DELETE' }); console.log('DELETE', p, '→', r.status) }
  const patch = async (p, body) => { const r = await sb(p, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) }); console.log('PATCH', p, '→', r.status) }

  await del('match_results?match_id=not.is.null')
  await del('match_live?match_id=not.is.null')
  await del('match_goals?match_id=not.is.null')
  await del('bets?match_id=eq.fr-nir')                 // paris du match test
  await patch('bets?id=not.is.null', { points: null, locked: false })
  await patch('profiles?id=not.is.null', { score: 0 })

  console.log('✅ Remise à zéro terminée — app prête pour la Coupe du Monde.')
}
main().catch(e => { console.error(e); process.exit(1) })
