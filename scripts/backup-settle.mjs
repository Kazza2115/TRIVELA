// Règlement de SECOURS réutilisable : quand l'API-Football « perd » une fixture (c'est
// arrivé pour r16-1 PAR-FRA puis r16-5 BRA-NOR), on règle ici avec le score OFFICIEL
// FIFA. Ajouter une entrée à SETTLE et pousser → le job tourne. Idempotent :
//   • si l'API a finalement le match TERMINÉ → on préfère SON score (réorienté) ;
//   • sinon → score officiel ci-dessous + buteurs fournis.
// Puis propagation du bracket (écriture monotone) + réconciliation du classement.
import { buildFixtureMap, orient, settleViaRest, reconcileScores, propagateKnockout, shortOf } from './wc-map.mjs'

// ── Matchs à régler (score = orientation de NOTRE slot, cf. knockout_teams) ─────────────
const SETTLE = [
  // r16-5 : Brésil 1-2 Norvège (5 juil) — Neymar (pen) ; Haaland 79e & 90e.
  {
    id: 'r16-5', home: 1, away: 2,
    scorers: [
      { p: 'Neymar', s: 'home', t: null, pen: true },
      { p: 'E. Haaland', s: 'away', t: 79 },
      { p: 'E. Haaland', s: 'away', t: 90 },
    ],
  },
  // r16-6 : Mexique 2-3 Angleterre (6 juil) — Quiñones, R. Jiménez (pen) ; doublé
  // Bellingham (1re mi-temps), H. Kane (pen). Rouge : J. Quansah (ENG).
  {
    id: 'r16-6', home: 2, away: 3,
    scorers: [
      { p: 'J. Quiñones', s: 'home', t: null },
      { p: 'R. Jiménez', s: 'home', t: null, pen: true },
      { p: 'J. Bellingham', s: 'away', t: null },
      { p: 'J. Bellingham', s: 'away', t: null },
      { p: 'H. Kane', s: 'away', t: null, pen: true },
    ],
    cards: [{ p: 'J. Quansah', s: 'away', t: null }],
  },
  // r16-3 : Portugal 0-1 Espagne (6 juil) — M. Merino (90e+).
  {
    id: 'r16-3', home: 0, away: 1,
    scorers: [{ p: 'M. Merino', s: 'away', t: 90 }],
  },
]

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

const sres = await sb('match_schedule?select=match_id')
const validIds = new Set((await sres.json()).map(r => r.match_id))
const all = (await api('/fixtures?league=1&season=2026')).response || []
const { map: fxMap } = buildFixtureMap(all, validIds)

for (const m of SETTLE) {
  const fx = all.find(f => fxMap.get(f.fixture?.id) === m.id)
  console.log(`[${m.id}] fixture API : ${fx ? `${fx.teams?.home?.name} vs ${fx.teams?.away?.name} · ${fx.fixture?.status?.short} · ${fx.goals?.home}-${fx.goals?.away}` : 'ABSENTE'}`)
  if (fx && FINISHED.has(fx.fixture?.status?.short) && fx.goals?.home != null && fx.goals?.away != null) {
    const o = orient(m.id, fx)
    const res = await settleViaRest(sb, m.id, o.homeScore, o.awayScore)
    console.log(`  ✅ réglé depuis l'API : ${o.homeScore}-${o.awayScore} (changed=${res.changed})`)
  } else {
    const res = await settleViaRest(sb, m.id, m.home, m.away)
    console.log(`  🛟 réglé avec le score OFFICIEL : ${m.home}-${m.away} (changed=${res.changed})`)
    if (m.scorers?.length || m.cards?.length) {
      const row = { match_id: m.id, updated_at: new Date().toISOString() }
      if (m.scorers?.length) row.scorers = m.scorers
      if (m.cards?.length) row.cards = m.cards
      await sb('match_goals?on_conflict=match_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([row]),
      })
      console.log(`  ⚽ buteurs écrits (${m.scorers?.length ?? 0})${m.cards?.length ? ` · 🟥 cartons (${m.cards.length})` : ''}.`)
    }
  }
}

// Propagation (écriture monotone) + classement.
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
