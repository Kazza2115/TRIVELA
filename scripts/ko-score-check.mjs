// Ponctuel (lecture seule) : diagnostique le scoring des matchs éliminatoires.
// Pour chaque match KO réglé : résultat officiel, qualifié déduit (koActualQualifier),
// et la répartition des points des paris. Repère les nuls (T.A.B.) dont le qualifié
// est indéterminé (bracket du tour suivant non rempli → bonus +2/+3 non octroyé).
import { isKnockout, koActualQualifier, scoreBet } from './wc-map.mjs'
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})

// Bracket + résultats. (Relance 2026-06-30 : diagnostic bracket cassé.)
const ko = {}
for (const r of await (await sb('knockout_teams?select=match_id,home_short,away_short,source')).json()) ko[r.match_id] = r
const results = {}
for (const r of await (await sb('match_results?select=match_id,home_score,away_score')).json()) results[r.match_id] = r

// Paris (paginé).
const bets = []
for (let off = 0; ; off += 1000) {
  const cols = 'id,user_id,match_id,home,away,home_score,away_score,qualifier_short,points,locked'
  const r = await sb(`bets?select=${cols}&order=id.asc&limit=1000&offset=${off}`)
  if (!r.ok) { console.error('lecture bets:', r.status, await r.text()); break }
  const rows = await r.json(); bets.push(...rows)
  if (rows.length < 1000) break
}

console.log('=== BRACKET KO (knockout_teams) ===')
for (const id of Object.keys(ko).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
  console.log(`  [${id.padEnd(7)}] ${ko[id].home_short || '—'} vs ${ko[id].away_short || '—'}  (${ko[id].source || '?'})`)

console.log('\n=== MATCHS KO RÉGLÉS ===')
const koResultIds = Object.keys(results).filter(isKnockout).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
if (!koResultIds.length) console.log('  (aucun résultat KO enregistré dans match_results)')
for (const id of koResultIds) {
  const r = results[id]
  const t = ko[id] || {}
  const draw = r.home_score === r.away_score
  const Q = koActualQualifier(id, r.home_score, r.away_score, ko)
  const flag = draw && !Q ? '  ⚠️ QUALIFIÉ INDÉTERMINÉ (bonus non octroyé !)' : ''
  console.log(`  [${id.padEnd(7)}] ${(t.home_short || '?')} ${r.home_score}-${r.away_score} ${(t.away_short || '?')}${draw ? ' (NUL → T.A.B.)' : ''} → qualifié déduit : ${Q || '∅'}${flag}`)
  // Répartition des points recalculés pour ce match.
  const here = bets.filter(b => b.match_id === id)
  const dist = {}
  for (const b of here) {
    const exp = scoreBet(b.match_id, b.home_score, b.away_score, b.qualifier_short, r.home_score, r.away_score, ko)
    const key = `${b.home_score}-${b.away_score}${b.qualifier_short ? ` [Q:${b.qualifier_short}]` : ''} → ${exp} pts (actuel ${b.points})`
    dist[key] = (dist[key] || 0) + 1
  }
  for (const [k, n] of Object.entries(dist).sort((a, b) => b[1] - a[1]))
    console.log(`        ${String(n).padStart(3)}×  prono ${k}`)
}
console.log('\n✅ Terminé.')
