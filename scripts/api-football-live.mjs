// Scores en direct : interroge l'API toutes les 30 s pendant ~5 min (le cron
// relance toutes les 5 min) et écrit l'état des matchs en cours dans match_live.
// S'arrête tôt s'il n'y a aucun match en direct (économise le quota).
import { buildFixtureMap } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant'); process.exit(1) }

const sb  = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const api   = path => fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const sleep = ms => new Promise(r => setTimeout(r, ms))

let validIds = new Set()
let fxMap = new Map()   // fixture_id API → notre match_id (groupes + élimination directe)
let tickN = 0           // compteur de ticks (throttle des appels events à 0-0)

// Extrait les buteurs d'un fixture (type "Goal"), avec côté domicile/extérieur.
function scorersFrom(events, homeId) {
  return (events || [])
    .filter(e => e.type === 'Goal' && e.detail !== 'Missed Penalty')
    .map(e => {
      const og = e.detail === 'Own Goal'
      // Un csc compte pour l'équipe adverse au joueur.
      const playerHome = e.team?.id === homeId
      const side = og ? (playerHome ? 'away' : 'home') : (playerHome ? 'home' : 'away')
      return {
        p: e.player?.name || '?',
        s: side,
        t: e.time?.elapsed ?? null,
        og,
        pen: e.detail === 'Penalty',
      }
    })
}

// Extrait les cartons rouges (carton rouge direct OU 2e jaune).
function redCardsFrom(events, homeId) {
  return (events || [])
    .filter(e => e.type === 'Card' && (e.detail === 'Red Card' || e.detail === 'Second Yellow card'))
    .map(e => ({
      p: e.player?.name || '?',
      s: e.team?.id === homeId ? 'home' : 'away',
      t: e.time?.elapsed ?? null,
    }))
}

async function writeEvents(matchId, fixtureId, homeId) {
  try {
    const ev = await api(`/fixtures/events?fixture=${fixtureId}`)
    const scorers = scorersFrom(ev.response, homeId)
    const cards   = redCardsFrom(ev.response, homeId)
    // Buteurs : upsert inchangé (ne casse jamais).
    await sb('match_goals?on_conflict=match_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ match_id: matchId, scorers, updated_at: new Date().toISOString() }]),
    })
    // Cartons : écriture séparée, pour ne pas casser les buteurs si la colonne
    // 'cards' n'existe pas encore (migration db-goals.sql non lancée → 400 ignoré).
    const r = await sb(`match_goals?match_id=eq.${matchId}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ cards }),
    })
    if (!r.ok && r.status !== 404) { /* colonne cards probablement absente — ignoré */ }
  } catch (e) { console.warn(`  ⚠️ events ${matchId}:`, String(e)) }
}

async function tick() {
  tickN++
  const data = await api('/fixtures?league=1&season=2026&live=all')
  const fixtures = data.response || []
  const rows = []
  const goalJobs = []
  for (const f of fixtures) {
    const id = fxMap.get(f.fixture?.id)
    if (!id) { console.warn(`⚠️ live non mappé: ${f.teams?.home?.name} vs ${f.teams?.away?.name} (fixture ${f.fixture?.id})`); continue }
    rows.push({
      match_id: id, status: f.fixture?.status?.short || 'LIVE',
      elapsed: f.fixture?.status?.elapsed ?? null,
      home_score: f.goals?.home ?? 0, away_score: f.goals?.away ?? 0,
      updated_at: new Date().toISOString(),
    })
    // Récupère buteurs + cartons rouges : à chaque but, et même à 0-0 une fois
    // par minute (~1 tick sur 4) pour capter les cartons précoces sans cramer le quota.
    const hasGoals = (f.goals?.home ?? 0) + (f.goals?.away ?? 0) > 0
    if (hasGoals || tickN % 4 === 0) {
      goalJobs.push(writeEvents(id, f.fixture?.id, f.teams?.home?.id))
    }
  }
  const ids = rows.map(r => r.match_id)
  // Retire de match_live les matchs qui ne sont plus en direct
  if (ids.length) await sb(`match_live?match_id=not.in.(${ids.join(',')})`, { method: 'DELETE' })
  else await sb('match_live?match_id=not.is.null', { method: 'DELETE' })
  if (rows.length) {
    await sb('match_live?on_conflict=match_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
  }
  if (goalJobs.length) await Promise.all(goalJobs)
  const t = new Date().toISOString().slice(11, 19)
  console.log(`[${t}] en direct : ${rows.length}${rows.length ? ' → ' + ids.join(', ') : ''}`)
  return rows.length
}

async function main() {
  const sched = await sb('match_schedule?select=match_id')
  if (sched.ok) validIds = new Set((await sched.json()).map(r => r.match_id))

  // Mapping fiable de TOUTE la compétition (groupes + élimination directe) par fixture_id.
  try {
    const allRes = await api('/fixtures?league=1&season=2026')
    const { map, unmatched } = buildFixtureMap(allRes.response || [], validIds)
    fxMap = map
    console.log(`Mapping fixtures : ${fxMap.size} mappés${unmatched.length ? ` · ${unmatched.length} NON mappés` : ''}`)
    if (unmatched.length) console.log(' - ' + unmatched.join('\n - '))
  } catch (e) { console.warn('build map erreur:', String(e)) }

  // Boucle ~5,5 min en interrogeant toutes les 15 s (le cron */5 relance →
  // couverture quasi continue). Arrêt anticipé si aucun match en direct.
  const ITER = 22, GAP = 15000
  for (let i = 0; i < ITER; i++) {
    let n = 0
    try { n = await tick() } catch (e) { console.warn('tick erreur:', String(e)) }
    if (i === 0 && n === 0) { console.log('Aucun match en direct — arrêt anticipé.'); break }
    if (i < ITER - 1) await sleep(GAP)
  }
}
main().catch(e => { console.error(e); process.exit(0) })
