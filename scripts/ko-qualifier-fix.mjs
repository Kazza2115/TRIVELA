// Ponctuel : reconstruit l'arbre du tableau (R16 → finale) à partir des RÉSULTATS en
// propageant chaque vainqueur dans son VRAI créneau du bracket FIFA (et non selon l'horaire),
// puis réconcilie le classement. Corrige à la fois :
//   • le placement des équipes dans la branche de tournoi (ex. CAN-MAR = r16-2, pas r16-1) ;
//   • la déduction du qualifié des matchs nuls réglés aux T.A.B. (bonus +2/+3 enfin octroyés).
//
// Les vainqueurs aux tirs au but (matchs nuls) sont fournis ci-dessous (TAB_WINNERS) car le
// score seul ne les révèle pas. Écrit knockout_teams (source 'admin' → la synchro API ne
// réécrase plus). Idempotent. APPLY=1 pour écrire. À retirer/mettre à jour après chaque soirée.
import { propagateKnockout, reconcileScores, koActualQualifier, scoreBet } from './wc-map.mjs'
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const APPLY = process.env.APPLY === '1'
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})

// Vainqueurs aux T.A.B. des matchs nuls (le score ne suffit pas à les déduire).
const TAB_WINNERS = { 'r32-1': 'PAR', 'r32-4': 'MAR' }

console.log(`=== KO-QUALIFIER-FIX (${APPLY ? 'ÉCRITURE' : 'RAPPORT seul'}) ===`)

const ko = {}
for (const r of await (await sb('knockout_teams?select=match_id,home_short,away_short,source')).json()) ko[r.match_id] = r
const results = {}
for (const r of await (await sb('match_results?select=match_id,home_score,away_score')).json()) results[r.match_id] = r

// Propagation déterministe des vainqueurs dans l'arbre. On écrit EXACTEMENT les valeurs
// propagées (null si le côté n'est pas encore déterminé) — surtout PAS de repli sur
// l'ancienne valeur du slot, qui pouvait contenir des données chronologiques erronées
// (c'est ce qui mettait le Maroc à tort en r16-1.away).
const derived = propagateKnockout(ko, results, TAB_WINNERS)
// source 'api' (et non 'admin') : le worker (rebuildBracketFromResults) doit pouvoir
// continuer à mettre à jour ces créneaux après chaque match (ex. remplir le 2e qualifié).
const rows = Object.entries(derived).map(([match_id, t]) => ({
  match_id,
  home_short: t.home_short ?? null,
  away_short: t.away_short ?? null,
  source: 'api',
  updated_at: new Date().toISOString(),
}))

console.log('Créneaux du tableau (re)calculés depuis les résultats :')
for (const r of rows) console.log(`  ${r.match_id} = ${r.home_short || '—'} vs ${r.away_short || '—'}`)

if (APPLY && rows.length) {
  const up = await sb('knockout_teams?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  if (!up.ok) { console.error(`❌ Échec écriture knockout_teams (${up.status}) : ${await up.text()}`); process.exit(1) }
  console.log(`✅ ${rows.length} créneau(x) écrit(s).`)
  // Recharge le bracket pour la vérif + la réconciliation.
  for (const r of rows) ko[r.match_id] = { home_short: r.home_short, away_short: r.away_short }
  const fixed = await reconcileScores(sb)
  console.log(`✅ Classement réconcilié — ${fixed} profil(s) corrigé(s).`)
} else if (!APPLY) {
  console.log('\nℹ️  Mode RAPPORT : aucune écriture. Relancer avec APPLY=1 pour appliquer.')
}

// Vérification : qualifié déduit + barème sur les matchs nuls réglés aux T.A.B.
const bets = []
for (let off = 0; ; off += 1000) {
  const r = await sb(`bets?select=match_id,home_score,away_score,qualifier_short,points&order=id.asc&limit=1000&offset=${off}`)
  if (!r.ok) break
  const rows2 = await r.json(); bets.push(...rows2)
  if (rows2.length < 1000) break
}
console.log('\n=== VÉRIFICATION (matchs nuls → T.A.B.) ===')
for (const id of Object.keys(TAB_WINNERS)) {
  const r = results[id]; if (!r) { console.log(`  ${id} : pas de résultat`); continue }
  const Q = koActualQualifier(id, r.home_score, r.away_score, ko)
  console.log(`  [${id}] ${ko[id]?.home_short} ${r.home_score}-${r.away_score} ${ko[id]?.away_short} → qualifié : ${Q || '∅ (toujours indéterminé !)'}`)
  const dist = {}
  for (const b of bets.filter(b => b.match_id === id)) {
    const exp = scoreBet(b.match_id, b.home_score, b.away_score, b.qualifier_short, r.home_score, r.away_score, ko)
    const k = `${b.home_score}-${b.away_score}${b.qualifier_short ? ` [Q:${b.qualifier_short}]` : ''} → ${exp} pts`
    dist[k] = (dist[k] || 0) + 1
  }
  for (const [k, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) console.log(`        ${String(n).padStart(3)}×  prono ${k}`)
}
console.log('\n✅ Terminé.')
