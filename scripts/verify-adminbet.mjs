// Ponctuel : la fonction admin_set_bet existe-t-elle en base ? À retirer après.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

async function probe(fn, body) {
  const r = await sb(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) })
  const t = await r.text()
  let verdict
  if (/Could not find the function|schema cache|PGRST202/i.test(t)) verdict = '❌ ABSENTE (db-admin-bets.sql non appliqué, ou cache périmé)'
  else if (/administrateur/i.test(t)) verdict = '✅ PRÉSENTE (garde admin OK — refus normal pour la clé service)'
  else verdict = `ℹ️ autre réponse (HTTP ${r.status})`
  console.log(`${fn} → ${verdict}`)
  console.log(`   réponse: ${t.slice(0, 200)}`)
}

await probe('admin_set_bet', {
  p_user_id: '00000000-0000-0000-0000-000000000000', p_match_id: 'test',
  p_home: 'X', p_away: 'Y', p_home_score: 1, p_away_score: 0, p_stage: 'test',
})
await probe('admin_get_bet', { p_user_id: '00000000-0000-0000-0000-000000000000', p_match_id: 'test' })

// Liste les fonctions admin_* visibles via le catalogue (si la vue est accessible).
const r = await sb('rpc/admin_set_bet', { method: 'POST', headers: { 'Accept-Profile': 'public' }, body: '{}' })
console.log(`\nappel sans args → HTTP ${r.status} : ${(await r.text()).slice(0, 160)}`)
