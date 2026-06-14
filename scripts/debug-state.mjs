const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = path => fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }).then(r => r.json())
console.log('results=' + JSON.stringify(await sb('match_results?select=match_id,home_score,away_score&order=settled_at.desc&limit=10')))
console.log('top=' + JSON.stringify(await sb('profiles?select=pseudo,score&order=score.desc&limit=6')))
