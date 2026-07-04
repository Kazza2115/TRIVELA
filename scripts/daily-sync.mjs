// Ping quotidien (cron 08 h Suisse) : reprend TOUT l'état de la Coupe du Monde depuis
// l'API-Football et garantit que la prod est correcte, sans intervention manuelle.
//
//   1) Réconcilie le classement (profiles.score = somme des points de chaque joueur).
//   2) Règle les matchs terminés manqués (résultat + points) — filet de sécurité.
//   3) Bracket, tour des 32 : écrit knockout_teams (source 'api') pour les affiches r32
//      dont les deux équipes sont connues (jamais un override 'admin').
//   4) Bracket, R16 → finale : propage le vainqueur de chaque affiche réglée dans son
//      créneau du tour suivant (vrai bracket FIFA, T.A.B. via drapeau `winner`).
//   5) Coups d'envoi : met match_schedule à jour depuis l'API (dates toujours correctes).
//
// Reproduit EXACTEMENT la logique du worker (syncKnockoutTeams / rebuildBracketFromResults /
// syncSchedule) pour servir de filet indépendant si le worker rate un passage. Idempotent :
// n'écrit QUE les changements. Zéro action manuelle requise.
// Relance manuelle 2026-07-03 : « actualise bien le classement » (réconciliation prod).
import { buildFixtureMap, orient, settleViaRest, reconcileScores, propagateKnockout, shortOf } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant (SUPABASE_SERVICE_ROLE_KEY / API_FOOTBALL_KEY)'); process.exit(1) }

const sb  = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const api = path => fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const FINISHED = new Set(['FT', 'AET', 'PEN'])

// ── 3) Bracket, tour des 32 (mirroir de syncKnockoutTeams, r32 seulement) ────────────────
async function syncKnockoutTeams(all, fxMap) {
  const want = []
  for (const f of (all || [])) {
    const id = fxMap.get(f.fixture?.id)
    if (!id || !/^r32/.test(id)) continue          // les tours suivants sont propagés (étape 4)
    const hs = shortOf(f.teams?.home?.name)
    const as = shortOf(f.teams?.away?.name)
    if (!hs || !as) continue                        // équipes pas encore déterminées
    want.push({ id, hs, as })
  }
  if (!want.length) return 0
  const er = await sb('knockout_teams?select=match_id,source,home_short,away_short')
  if (!er.ok) return 0
  const existing = new Map()
  for (const r of await er.json()) existing.set(r.match_id, r)
  const rows = []
  for (const w of want) {
    const ex = existing.get(w.id)
    if (ex && ex.source === 'admin') continue                            // override manuel prioritaire
    if (ex && ex.home_short === w.hs && ex.away_short === w.as) continue  // déjà à jour
    rows.push({ match_id: w.id, home_short: w.hs, away_short: w.as, source: 'api', updated_at: new Date().toISOString() })
  }
  if (!rows.length) return 0
  await sb('knockout_teams?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  return rows.length
}

// ── 4) Bracket, R16 → finale (miroir de rebuildBracketFromResults) ───────────────────────
async function rebuildBracketFromResults(all, fxMap) {
  const rr = await sb('match_results?select=match_id,home_score,away_score')
  if (!rr.ok) return 0
  const results = {}
  for (const r of await rr.json()) results[r.match_id] = r
  const kr = await sb('knockout_teams?select=match_id,home_short,away_short,source')
  if (!kr.ok) return 0
  const ko = {}, src = {}
  for (const r of await kr.json()) { ko[r.match_id] = r; src[r.match_id] = r.source }
  // Vainqueurs aux tirs au but (matchs nuls) depuis l'API : drapeau teams.*.winner.
  const tab = {}
  for (const f of (all || [])) {
    const id = fxMap.get(f.fixture?.id)
    if (!id || !/^(r32|r16|qf|sf|3rd|final)/.test(id)) continue
    const gh = f.goals?.home, ga = f.goals?.away
    if (gh == null || ga == null || gh !== ga) continue
    const wName = f.teams?.home?.winner ? f.teams?.home?.name : f.teams?.away?.winner ? f.teams?.away?.name : null
    const ws = shortOf(wName)
    if (ws) tab[id] = ws
  }
  const derived = propagateKnockout(ko, results, tab)
  const rows = []
  for (const [mid, t] of Object.entries(derived)) {
    if (src[mid] === 'admin') continue                    // override manuel prioritaire
    const hs = t.home_short ?? null, as = t.away_short ?? null
    const cur = ko[mid]
    if (cur && cur.home_short === hs && cur.away_short === as) continue   // déjà à jour
    rows.push({ match_id: mid, home_short: hs, away_short: as, source: 'api', updated_at: new Date().toISOString() })
  }
  if (!rows.length) return 0
  await sb('knockout_teams?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  return rows.length
}

// ── 5) Coups d'envoi (miroir de syncSchedule) ────────────────────────────────────────────
async function syncSchedule(all, fxMap) {
  const cur = {}
  const er = await sb('match_schedule?select=match_id,kickoff')
  if (er.ok) for (const r of await er.json()) cur[r.match_id] = r.kickoff ? new Date(r.kickoff).toISOString() : null
  const rows = []
  for (const f of (all || [])) {
    const id = fxMap.get(f.fixture?.id), dt = f.fixture?.date
    if (!id || !dt) continue
    const iso = new Date(dt).toISOString()
    if (cur[id] !== iso) rows.push({ match_id: id, kickoff: iso })
  }
  if (!rows.length) return 0
  await sb('match_schedule?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  return rows.length
}

async function main() {
  console.log('=== PING QUOTIDIEN (reprise complète depuis l’API) ===')

  // 1) Classement.
  const reconciled = await reconcileScores(sb)
  console.log(`⚖️  Classement : ${reconciled || 0} joueur(s) corrigé(s).`)

  // Fixtures + mapping (une seule lecture API partagée par toutes les étapes).
  const sres = await sb('match_schedule?select=match_id')
  const validIds = sres.ok ? new Set((await sres.json()).map(r => r.match_id)) : new Set()
  const all = (await api('/fixtures?league=1&season=2026')).response || []
  const { map: fxMap } = buildFixtureMap(all, validIds)
  console.log(`📡 Fixtures API : ${all.length} · mappées : ${fxMap.size}`)

  // 2) Filet de règlement : tout match terminé non encore réglé est réglé maintenant.
  const rrep = await sb('match_results?select=match_id')
  const settled = new Set(rrep.ok ? (await rrep.json()).map(r => r.match_id) : [])
  let newlySettled = 0
  for (const f of all) {
    const id = fxMap.get(f.fixture?.id)
    if (!id || settled.has(id)) continue
    if (!FINISHED.has(f.fixture?.status?.short) || f.goals?.home == null || f.goals?.away == null) continue
    const o = orient(id, f)
    await settleViaRest(sb, id, o.homeScore, o.awayScore)
    newlySettled++
    console.log(`  ⚙️  réglé : ${id} (${o.homeScore}-${o.awayScore})`)
  }
  console.log(`🏁 Matchs réglés (manqués) : ${newlySettled}`)

  // 3–5) Bracket + dates.
  const r32  = await syncKnockoutTeams(all, fxMap)
  const tree = await rebuildBracketFromResults(all, fxMap)
  const dates = await syncSchedule(all, fxMap)
  console.log(`🗂️  Bracket r32 : ${r32} · propagation R16→finale : ${tree} · dates : ${dates}`)
  console.log('✅ Terminé — prod à jour.')
}
main().catch(e => { console.error('Erreur :', e); process.exit(1) })
