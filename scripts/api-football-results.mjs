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
    .map(e => {
      const og = e.detail === 'Own Goal'
      const playerHome = e.team?.id === homeId
      const side = og ? (playerHome ? 'away' : 'home') : (playerHome ? 'home' : 'away')
      return { p: e.player?.name || '?', s: side, t: e.time?.elapsed ?? null, og, pen: e.detail === 'Penalty' }
    })
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

  // ── GATE QUOTA ────────────────────────────────────────────────────────────
  // On ne règle (et ne complète buteurs/cartons) que dans les 4 h suivant un coup
  // d'envoi. Hors de cette fenêtre : sortie immédiate, ZÉRO requête API football.
  if (!anyMatchInWindow(schedRows, 0, RESULTS_MAX_MS)) {
    console.log('⏸️  Aucun match récent à régler — aucune requête API football.')
    return
  }

  // Nb de buteurs déjà enregistrés + cartons déjà synchronisés (cards non null),
  // pour ne re-télécharger les événements que si buteurs incomplets OU cartons jamais synchronisés.
  const gExisting = await sb('match_goals?select=match_id,scorers,cards')
  const storedCount = new Map()
  const cardsKnown = new Set()
  const storedCards = new Map()   // nb de cartons déjà enregistrés (pour ne jamais réduire)
  if (gExisting.ok) {
    for (const r of await gExisting.json()) {
      storedCount.set(r.match_id, Array.isArray(r.scorers) ? r.scorers.length : 0)
      if (Array.isArray(r.cards)) { cardsKnown.add(r.match_id); storedCards.set(r.match_id, r.cards.length) }
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
      // Récupère les événements si les buteurs sont incomplets, OU si les cartons ne sont
      // pas synchronisés, OU si le résultat vient d'être CORRIGÉ (orientation) → ré-écrit
      // alors buteurs/cartons du bon côté automatiquement, sans intervention manuelle.
      if (changed || have < totalGoals || !cardsKnown.has(id)) {
        try {
          const ev = await api(`/fixtures/events?fixture=${f.fixture?.id}`)
          const events = ev?.response
          const scorers = Array.isArray(events) ? scorersFrom(events, o.appHomeId) : []
          if (scorers.length > 0 && (changed || scorers.length >= have)) {
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
            if (changed || cards.length >= (storedCards.get(id) ?? 0)) {
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
