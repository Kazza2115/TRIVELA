// Ponctuel : pose le pronostic de KAZA sur Côte d'Ivoire–Équateur (2-1), calcule ses
// points d'après le résultat réel, puis recalcule son score. Lecture/écriture REST.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
function betPoints(ph, pa, rh, ra) {
  if (ph === rh && pa === ra) return 5
  if (rh > ra && ph > pa) return 3
  if (rh < ra && ph < pa) return 3
  if (rh === ra && ph === pa) return 4
  return 0
}

const MATCH = 'gE-md1-civ-ecu', PH = 2, PA = 1

const users = await (await sb('profiles?pseudo=ilike.KAZA&select=id,pseudo')).json()
if (!users[0]) { console.error('❌ KAZA introuvable'); process.exit(1) }
const uid = users[0].id
console.log('KAZA id=' + uid)

const rr = await (await sb(`match_results?match_id=eq.${MATCH}&select=home_score,away_score`)).json()
const res = rr[0]
console.log('résultat réel ' + MATCH + ' = ' + (res ? `${res.home_score}-${res.away_score}` : 'PAS ENCORE RÉGLÉ'))
const pts = res ? betPoints(PH, PA, res.home_score, res.away_score) : null

const up = await sb('bets?on_conflict=user_id,match_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify([{
    user_id: uid, match_id: MATCH, home: "Côte d'Ivoire", away: 'Équateur',
    home_score: PH, away_score: PA, stage: 'Groupe E · J1', locked: true, points: pts,
  }]),
})
console.log('upsert pari status=' + up.status + ' body=' + await up.text().catch(() => '?'))

// Recalcule le score de KAZA = somme de ses points.
const myBets = await (await sb(`bets?user_id=eq.${uid}&select=points`)).json()
const total = myBets.reduce((s, b) => s + (b.points || 0), 0)
const pr = await sb(`profiles?id=eq.${uid}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ score: total }) })
console.log(`score KAZA recalculé = ${total} (patch ${pr.status})`)
