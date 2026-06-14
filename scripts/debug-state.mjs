const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = path => fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }).then(r => r.json())

const results = await sb('match_results?select=match_id,home_score,away_score,settled_at&order=settled_at.desc')
console.log('RESULTS (' + results.length + '):')
for (const r of results) console.log(`  ${r.match_id} ${r.home_score}-${r.away_score} @${r.settled_at?.slice(5,16)}`)

const profiles = await sb('profiles?select=id,pseudo,score&order=score.desc')
const bets = await sb('bets?select=user_id,points,locked')
const sumByUser = {}, lockedByUser = {}
for (const b of bets) { sumByUser[b.user_id] = (sumByUser[b.user_id]||0) + (b.points||0); if (b.locked) lockedByUser[b.user_id]=(lockedByUser[b.user_id]||0)+1 }
console.log('\nCLASSEMENT (score stocké vs somme des points des paris) :')
for (const p of profiles.slice(0, 20)) {
  const s = sumByUser[p.id] || 0
  const flag = s !== p.score ? '  ❌ INCOHÉRENT' : ''
  console.log(`  ${p.pseudo}: stocké=${p.score} sommePts=${s} parisVerrouillés=${lockedByUser[p.id]||0}${flag}`)
}
