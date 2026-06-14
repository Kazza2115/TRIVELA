// Diagnostic lecture seule : imprime l'état réel des tables clés dans les logs CI.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = path => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
}).then(r => r.json())

const results = await sb('match_results?select=match_id,home_score,away_score,settled_at&order=settled_at.desc&limit=15')
console.log('── match_results ──\n' + JSON.stringify(results, null, 0))
const live = await sb('match_live?select=match_id,status,home_score,away_score,updated_at')
console.log('── match_live ──\n' + JSON.stringify(live, null, 0))
const goals = await sb('match_goals?match_id=in.(gD-md1-aus-tur,gB-md1-qat-sui,gC-md1-hai-sco,gC-md1-bra-mar)&select=match_id,scorers,cards')
console.log('── match_goals (hier) ──\n' + JSON.stringify(goals, null, 0))
const top = await sb('profiles?select=pseudo,score&order=score.desc&limit=8')
console.log('── top profiles ──\n' + JSON.stringify(top, null, 0))
