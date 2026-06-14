// Diagnostic lecture seule + TEST settle_match : imprime l'état et teste la RPC.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

// TEST : appel settle_match pour gB-md1-qat-sui (1-1) et on regarde le retour + la persistance.
const r = await sb('rpc/settle_match', { method: 'POST',
  body: JSON.stringify({ p_match_id: 'gB-md1-qat-sui', p_home_score: 1, p_away_score: 1 }) })
console.log(`settle_match status=${r.status} body=${await r.text().catch(() => '?')}`)

const after = await (await sb('match_results?match_id=eq.gB-md1-qat-sui&select=match_id,home_score,away_score,settled_at')).json()
console.log('── après settle (gB-md1-qat-sui) ──\n' + JSON.stringify(after, null, 0))

// Liste des fonctions settle_match visibles (détecte les surcharges).
const fns = await (await sb('rpc/settle_match', { method: 'OPTIONS' })).status
console.log('OPTIONS settle_match status=' + fns)
