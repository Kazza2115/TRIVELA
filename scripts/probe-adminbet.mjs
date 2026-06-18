// Ponctuel : les fonctions admin_set_bet/admin_get_bet existent-elles ? À retirer.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})
for (const [fn, body] of [
  ['admin_get_bet', { p_user_id: '00000000-0000-0000-0000-000000000000', p_match_id: 'x' }],
  ['admin_set_bet', { p_user_id: '00000000-0000-0000-0000-000000000000', p_match_id: 'x', p_home: 'a', p_away: 'b', p_home_score: 0, p_away_score: 0, p_stage: 's' }],
]) {
  const r = await sb(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) })
  const t = await r.text()
  const verdict = /PGRST202|Could not find the function|schema cache/i.test(t) ? '❌ ABSENTE'
    : /administrateur/i.test(t) ? '✅ PRÉSENTE (garde admin OK)'
    : `ℹ️ HTTP ${r.status}`
  console.log(`${fn} → ${verdict} | ${t.slice(0, 140)}`)
}
