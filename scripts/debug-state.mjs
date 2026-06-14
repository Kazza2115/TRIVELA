// Diagnostic : la table match_results est-elle inscriptible en REST (service role) ?
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

// 1) Upsert direct d'une ligne sentinelle.
const up = await sb('match_results?on_conflict=match_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify([{ match_id: 'ZZ-debug-test', home_score: 9, away_score: 9, settled_at: new Date().toISOString() }]),
})
console.log(`upsert direct status=${up.status} body=${await up.text().catch(() => '?')}`)

// 2) Relecture.
const after = await (await sb('match_results?match_id=eq.ZZ-debug-test&select=*')).json()
console.log('── relecture sentinelle ──\n' + JSON.stringify(after, null, 0))

// 3) Nettoyage.
const del = await sb('match_results?match_id=eq.ZZ-debug-test', { method: 'DELETE' })
console.log(`delete sentinelle status=${del.status}`)
