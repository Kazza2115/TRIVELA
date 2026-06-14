const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = path => fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }).then(r => r.json())
const results = await sb('match_results?select=match_id,home_score,away_score')
const goals = await sb('match_goals?select=match_id,scorers,cards')
const gmap = {}
for (const g of goals) gmap[g.match_id] = g
for (const r of results) {
  const exp = (r.home_score||0)+(r.away_score||0)
  const g = gmap[r.match_id]
  const have = g && Array.isArray(g.scorers) ? g.scorers.length : 0
  const cards = g && Array.isArray(g.cards) ? 'cards:ok' : 'cards:NULL'
  console.log(`${r.match_id} ${r.home_score}-${r.away_score} buteurs ${have}/${exp} ${have<exp?'⚠️INCOMPLET':''} ${cards}`)
}
