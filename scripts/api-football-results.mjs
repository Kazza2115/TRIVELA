// Résultats via API-Football : règle les matchs de groupe TERMINÉS
// (settle_match → points + classements). Mapping partagé via wc-map.mjs.
import { buildFixtureMap, orient, anyMatchInWindow, RESULTS_MAX_MS } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant'); process.exit(1) }

const sb  = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const api = path => fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const FINISHED = new Set(['FT', 'AET', 'PEN'])

// Buteurs (type "Goal") d'un fixture, avec côté domicile/extérieur.
function scorersFrom(events, homeId) {
  return (events || [])
    .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
    .map(e => ({
      p: e.player?.name || '?',
      // API-Football : e.team est l'équipe CRÉDITÉE du but (csc inclus) → pas d'inversion.
      s: e.team?.id === homeId ? 'home' : 'away',
      t: e.time?.elapsed ?? null,
      og: e.detail === 'Own Goal',
      pen: e.detail === 'Penalty',
    }))
}

// Cartons rouges (rouge direct OU 2e jaune) d'un fixture.
function redCardsFrom(events, homeId) {
  return (events || [])
    .filter(e => e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Second Yellow card'))
    .map(e => ({ p: e.player?.name || '?', s: e.team?.id === homeId ? 'home' : 'away', t: e.time?.elapsed ?? null }))
}

async function main() {
  const sched = await sb('match_schedule?select=match_id,kickoff')
  const schedRows = sched.ok ? await sched.json() : []
  const validIds = new Set(schedRows.map(r => r.match_id))

  // ── GATE QUOTA + BACKUP AUTOMATIQUE ────────────────────────────────────────
  // On lance une passe API football si l'UNE de ces conditions est vraie :
  //   1) un match est dans sa fenêtre de règlement normale (≤ 4 h après le coup d'envoi) ;
  //   2) BACKUP : un match dont le coup d'envoi est passé (≤ 24 h) n'est TOUJOURS PAS réglé
  //      → sa fin a été ratée (creux API pendant sa fenêtre). On le règle automatiquement,
  //      sans aucune action manuelle. Ce cron tourne toutes les 10 min : un match terminé
  //      mais manqué est donc rattrapé en ≤ 10 min, tout seul.
  //   3) FORCE=1 (déclenchement manuel) : rafraîchit tout, hors fenêtre.
  // Tant qu'il n'y a rien à régler : sortie immédiate après lectures Supabase (ZÉRO quota).
  const now = Date.now()
  const rrep = await sb('match_results?select=match_id')
  const settledSet = rrep.ok ? new Set((await rrep.json()).map(r => r.match_id)) : new Set()
  const BACKSTOP_MS = 24 * 60 * 60 * 1000
  const unsettledPast = schedRows.filter(r => {
    if (settledSet.has(r.match_id)) return false
    const k = Date.parse(r.kickoff)
    return Number.isFinite(k) && now > k && now < k + BACKSTOP_MS
  })
  const FORCE = process.env.FORCE === '1'
  const inWindow = anyMatchInWindow(schedRows, 0, RESULTS_MAX_MS)
  if (!FORCE && !inWindow && unsettledPast.length === 0) {
    console.log('⏸️  Aucun match récent ni match passé non réglé — aucune requête API football.')
    return
  }
  if (FORCE) console.log('⚡ FORCE : règlement hors fenêtre (rafraîchissement manuel).')
  else if (!inWindow && unsettledPast.length)
    console.log(`🛟 Backup : ${unsettledPast.length} match(s) passé(s) non réglé(s) → ${unsettledPast.map(r => r.match_id).join(', ')}`)

  // Nb de buteurs déjà enregistrés + cartons déjà synchronisés (cards non null),
  // pour ne re-télécharger les événements que si buteurs incomplets OU cartons jamais synchronisés.
  const gExisting = await sb('match_goals?select=match_id,scorers,cards')
  const storedCount = new Map()
  const cardsKnown = new Set()
  const storedCards = new Map()   // nb de cartons déjà enregistrés (pour ne jamais réduire)
  const hadOG = new Set()         // matchs avec un csc stocké (ancienne logique inversée) → ré-écrire
  if (gExisting.ok) {
    for (const r of await gExisting.json()) {
      storedCount.set(r.match_id, Array.isArray(r.scorers) ? r.scorers.length : 0)
      if (Array.isArray(r.cards)) { cardsKnown.add(r.match_id); storedCards.set(r.match_id, r.cards.length) }
      if (Array.isArray(r.scorers) && r.scorers.some(s => s && s.og)) hadOG.add(r.match_id)
    }
  }

  const data = await api('/fixtures?league=1&season=2026')
  const fixtures = data.response || []
  const { map: fxMap, unmatched } = buildFixtureMap(fixtures, validIds)
  let matched = 0, settled = 0, goalsWritten = 0
  for (const f of fixtures) {
    const id = fxMap.get(f.fixture?.id)
    if (!id) continue
    matched++
    const status = f.fixture?.status?.short
    if (FINISHED.has(status) && f.goals?.home != null && f.goals?.away != null) {
      const o = orient(id, f)   // score + côté buteurs ré-orientés vers notre match_id
      const r = await sb('rpc/settle_match', { method: 'POST',
        body: JSON.stringify({ p_match_id: id, p_home_score: o.homeScore, p_away_score: o.awayScore }) })
      let changed = false
      if (r.ok) { settled++; changed = (await r.json().catch(() => false)) === true }
      else console.warn(`  ⚠️ settle ${id}: ${r.status} ${await r.text().catch(() => '')}`)
      // Persiste les buteurs tant que la liste stockée est incomplète (< score).
      // On écrit dès qu'au moins un buteur est connu (sans jamais RÉDUIRE la liste
      // déjà stockée) : les buteurs apparaissent vite et se complètent run après run.
      const totalGoals = o.homeScore + o.awayScore
      const have = storedCount.get(id) ?? 0
      // Un csc stocké récemment (≤ 36 h) suit peut-être l'ancienne logique inversée :
      // on le ré-écrit depuis l'API pour placer le but du bon côté, automatiquement.
      const finishedAt = Date.parse(f.fixture?.date)
      const recentlyFinished = Number.isFinite(finishedAt) && (Date.now() - finishedAt) < 36 * 3600 * 1000
      // healOG : un csc à réorienter ; sous FORCE on ré-écrit aussi buteurs/cartons
      // de tout match récent pour réparer un creux API (score/buteurs mal renvoyés).
      const healOG = (hadOG.has(id) || FORCE) && recentlyFinished
      // Récupère les événements si les buteurs sont incomplets, OU si les cartons ne sont
      // pas synchronisés, OU si le résultat vient d'être CORRIGÉ (orientation), OU si un csc
      // doit être réorienté → ré-écrit buteurs/cartons du bon côté automatiquement.
      if (changed || healOG || have < totalGoals || !cardsKnown.has(id)) {
        try {
          const ev = await api(`/fixtures/events?fixture=${f.fixture?.id}`)
          const events = ev?.response
          const scorers = Array.isArray(events) ? scorersFrom(events, o.appHomeId) : []
          if (scorers.length > 0 && (changed || healOG || scorers.length >= have)) {
            const gr = await sb('match_goals?on_conflict=match_id', {
              method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify([{ match_id: id, scorers, updated_at: new Date().toISOString() }]),
            })
            if (gr.ok) goalsWritten++
          } else {
            console.warn(`  ⏳ buteurs ${id} indisponibles (${scorers.length}/${totalGoals}) — réessai au prochain run`)
          }
          // Cartons rouges : upsert séparé. On n'écrit que si on ne RÉDUIT pas la
          // liste déjà stockée (un creux API ne doit jamais effacer un carton). Le
          // premier passage marque la synchro (cards = [] si aucun carton).
          if (Array.isArray(events)) {
            const cards = redCardsFrom(events, o.appHomeId)
            if (changed || healOG || cards.length >= (storedCards.get(id) ?? 0)) {
              await sb('match_goals?on_conflict=match_id', {
                method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
                body: JSON.stringify([{ match_id: id, cards }]),
              }).catch(() => {})
            }
          }
        } catch (e) { console.warn(`  ⚠️ events ${id}:`, String(e)) }
      }
    }
  }
  console.log(`✅ Mappés : ${matched}/${fixtures.length} · Réglés : ${settled} · Buteurs écrits : ${goalsWritten}`)
  if (unmatched.length) console.log(`⚠️ Non mappés (${unmatched.length}) :\n - ${unmatched.join('\n - ')}`)
}
main().catch(e => { console.error('Erreur :', e); process.exit(1) })
