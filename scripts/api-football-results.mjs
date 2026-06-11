// Résultats via API-Football : règle les matchs de groupe TERMINÉS
// (settle_match → points + classements). Mapping partagé via wc-map.mjs.
import { buildFixtureMap } from './wc-map.mjs'

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
  const sched = await sb('match_schedule?select=match_id')
  const validIds = sched.ok ? new Set((await sched.json()).map(r => r.match_id)) : new Set()

  // Nb de buteurs déjà enregistrés + cartons déjà synchronisés (cards non null),
  // pour ne re-télécharger les événements que si buteurs incomplets OU cartons jamais synchronisés.
  const gExisting = await sb('match_goals?select=match_id,scorers,cards')
  const storedCount = new Map()
  const cardsKnown = new Set()
  if (gExisting.ok) {
    for (const r of await gExisting.json()) {
      storedCount.set(r.match_id, Array.isArray(r.scorers) ? r.scorers.length : 0)
      if (Array.isArray(r.cards)) cardsKnown.add(r.match_id)
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
      const r = await sb('rpc/settle_match', { method: 'POST',
        body: JSON.stringify({ p_match_id: id, p_home_score: f.goals.home, p_away_score: f.goals.away }) })
      if (r.ok) settled++
      else console.warn(`  ⚠️ settle ${id}: ${r.status} ${await r.text().catch(() => '')}`)
      // Persiste les buteurs tant que la liste stockée est incomplète (< score).
      // On écrit dès qu'au moins un buteur est connu (sans jamais RÉDUIRE la liste
      // déjà stockée) : les buteurs apparaissent vite et se complètent run après run.
      const totalGoals = f.goals.home + f.goals.away
      const have = storedCount.get(id) ?? 0
      // Récupère les événements si les buteurs sont incomplets OU si les cartons
      // n'ont jamais été synchronisés (cards null) → toutes les stats finissent à jour.
      if (have < totalGoals || !cardsKnown.has(id)) {
        try {
          const ev = await api(`/fixtures/events?fixture=${f.fixture?.id}`)
          const events = ev?.response
          const scorers = Array.isArray(events) ? scorersFrom(events, f.teams?.home?.id) : []
          if (scorers.length > 0 && scorers.length >= have) {
            const gr = await sb('match_goals?on_conflict=match_id', {
              method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify([{ match_id: id, scorers, updated_at: new Date().toISOString() }]),
            })
            if (gr.ok) goalsWritten++
          } else {
            console.warn(`  ⏳ buteurs ${id} indisponibles (${scorers.length}/${totalGoals}) — réessai au prochain run`)
          }
          // Cartons rouges : upsert séparé (crée la ligne si besoin, même à 0-0 →
          // évite de re-télécharger à l'infini). Marque les cartons comme synchronisés.
          if (Array.isArray(events)) {
            const cards = redCardsFrom(events, f.teams?.home?.id)
            await sb('match_goals?on_conflict=match_id', {
              method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify([{ match_id: id, cards }]),
            }).catch(() => {})
          }
        } catch (e) { console.warn(`  ⚠️ events ${id}:`, String(e)) }
      }
    }
  }
  console.log(`✅ Mappés : ${matched}/${fixtures.length} · Réglés : ${settled} · Buteurs écrits : ${goalsWritten}`)
  if (unmatched.length) console.log(`⚠️ Non mappés (${unmatched.length}) :\n - ${unmatched.join('\n - ')}`)
}
main().catch(e => { console.error('Erreur :', e); process.exit(1) })
