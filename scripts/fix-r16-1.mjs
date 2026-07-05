// Relance 2 : propagation FRA → qf-1 après correctif de la dérivation partielle.
// Ponctuel : règle r16-1 (Paraguay - France, 8e de finale du 4 juil) que l'API n'a pas
// remonté à temps. Stratégie :
//   • si l'API donne le match TERMINÉ → règlement normal (score API réorienté + buteurs) ;
//   • sinon → règlement de SECOURS avec le score officiel FIFA 0-1 (Mbappé pen 70e),
//     buteur écrit manuellement ; l'API confirmera/corrigera plus tard (settleViaRest
//     est auto-correcteur si le score stocké diffère).
// Puis : propagation (FRA → qf-1) + réconciliation du classement. Idempotent.
import { buildFixtureMap, orient, settleViaRest, reconcileScores, propagateKnockout, shortOf } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY = process.env.API_FOOTBALL_KEY
const API = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})
const api = p => fetch(`${API}${p}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const FINISHED = new Set(['FT', 'AET', 'PEN'])
const MATCH_ID = 'r16-1'
const OFFICIAL = { home: 0, away: 1 }   // PAR 0 - 1 FRA (source FIFA)

// Déjà réglé ?
const ex = await (await sb(`match_results?match_id=eq.${MATCH_ID}&select=home_score,away_score`)).json()
if (ex.length) console.log(`ℹ️ Déjà réglé : ${ex[0].home_score}-${ex[0].away_score} (revalidation…)`)

const sres = await sb('match_schedule?select=match_id')
const validIds = new Set((await sres.json()).map(r => r.match_id))
const all = (await api('/fixtures?league=1&season=2026')).response || []
const { map: fxMap } = buildFixtureMap(all, validIds)
const fx = all.find(f => fxMap.get(f.fixture?.id) === MATCH_ID)
console.log(`Fixture API r16-1 : ${fx ? `${fx.teams?.home?.name} vs ${fx.teams?.away?.name} · statut ${fx.fixture?.status?.short} · buts ${fx.goals?.home}-${fx.goals?.away}` : 'ABSENTE'}`)

if (fx && FINISHED.has(fx.fixture?.status?.short) && fx.goals?.home != null && fx.goals?.away != null) {
  const o = orient(MATCH_ID, fx)
  const res = await settleViaRest(sb, MATCH_ID, o.homeScore, o.awayScore)
  console.log(`✅ Réglé depuis l'API : ${o.homeScore}-${o.awayScore} (changed=${res.changed})`)
  try {
    const ev = await api(`/fixtures/events?fixture=${fx.fixture?.id}`)
    const scorers = (ev.response || [])
      .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
      .map(e => ({ p: e.player?.name || '?', s: e.team?.id === o.appHomeId ? 'home' : 'away', t: e.time?.elapsed ?? null, og: e.detail === 'Own Goal', pen: e.detail === 'Penalty' }))
    if (scorers.length) {
      await sb('match_goals?on_conflict=match_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ match_id: MATCH_ID, scorers, updated_at: new Date().toISOString() }]),
      })
      console.log(`⚽ Buteurs API écrits (${scorers.length}).`)
    }
  } catch { /* buteurs complétés plus tard par le cron */ }
} else {
  const res = await settleViaRest(sb, MATCH_ID, OFFICIAL.home, OFFICIAL.away)
  console.log(`🛟 Réglé avec le score OFFICIEL (API en retard) : ${OFFICIAL.home}-${OFFICIAL.away} (changed=${res.changed})`)
  await sb('match_goals?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ match_id: MATCH_ID, scorers: [{ p: 'K. Mbappé', s: 'away', t: 70, pen: true }], updated_at: new Date().toISOString() }]),
  })
  console.log('⚽ Buteur officiel écrit : K. Mbappé (pen, 70e).')
}

// Propagation (FRA → qf-1, écriture monotone) + classement.
const results = {}
for (const r of await (await sb('match_results?select=match_id,home_score,away_score')).json()) results[r.match_id] = r
const kr = await (await sb('knockout_teams?select=match_id,home_short,away_short,source')).json()
const ko = {}, src = {}
for (const r of kr) { ko[r.match_id] = r; src[r.match_id] = r.source }
const tab = {}
for (const f of all) {
  const id = fxMap.get(f.fixture?.id)
  if (!id || !/^(r32|r16|qf|sf|3rd|final)/.test(id)) continue
  const gh = f.goals?.home, ga = f.goals?.away
  if (gh == null || ga == null || gh !== ga) continue
  const ws = shortOf(f.teams?.home?.winner ? f.teams?.home?.name : f.teams?.away?.winner ? f.teams?.away?.name : null)
  if (ws) tab[id] = ws
}
const derived = propagateKnockout(ko, results, tab)
const rows = []
for (const [mid, t] of Object.entries(derived)) {
  if (src[mid] === 'admin') continue
  const cur = ko[mid]
  const hs = t.home_short ?? cur?.home_short ?? null
  const as = t.away_short ?? cur?.away_short ?? null
  if (cur && cur.home_short === hs && cur.away_short === as) continue
  rows.push({ match_id: mid, home_short: hs, away_short: as, source: 'api', updated_at: new Date().toISOString() })
}
if (rows.length) {
  await sb('knockout_teams?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  for (const r of rows) console.log(`🗂️  ${r.match_id} → ${r.home_short ?? '∅'} vs ${r.away_short ?? '∅'}`)
}
const fixed = await reconcileScores(sb)
console.log(`⚖️  Classement : ${fixed} joueur(s) corrigé(s).`)
console.log('✅ Terminé.')
