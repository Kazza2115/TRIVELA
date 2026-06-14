// Scores en direct : interroge l'API toutes les 30 s pendant ~5 min (le cron
// relance toutes les 5 min) et écrit l'état des matchs en cours dans match_live.
// S'arrête tôt s'il n'y a aucun match en direct (économise le quota).
import { buildFixtureMap, orient, shouldTrack, settleViaRest, reconcileScores, LIVE_PREROLL_MS, LIVE_MAX_MS } from './wc-map.mjs'

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
const FINISHED = new Set(['FT', 'AET', 'PEN'])
const settled = new Set()    // match_id déjà réglés (évite les doublons en mémoire)
let prevLiveIds = new Set()  // fixture_id en direct au tick précédent

// Règle un match terminé : résultat (points + verrou des paris via settle_match,
// idempotent) puis buteurs finaux. Le classement se met à jour en temps réel côté app.
async function settleFinished(f, matchId) {
  const st = f.fixture?.status?.short
  const h = f.goals?.home, a = f.goals?.away
  if (!FINISHED.has(st) || h == null || a == null) return false
  const o = orient(matchId, f)   // score ré-orienté vers notre match_id (points corrects)
  // Règlement 100 % REST (résultat + points + classement, auto-correcteur).
  await settleViaRest(sb, matchId, o.homeScore, o.awayScore)
  await writeEvents(matchId, f.fixture?.id, o.appHomeId, o.homeScore + o.awayScore)
  return true
}

// Extrait les buteurs d'un fixture (type "Goal"), avec côté domicile/extérieur.
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

async function writeEvents(matchId, fixtureId, homeId, totalGoals) {
  try {
    const ev = await api(`/fixtures/events?fixture=${fixtureId}`)
    const events = ev?.response
    // Réponse API invalide (creux/quota/erreur) → on ne touche à rien (garde l'existant).
    if (!Array.isArray(events)) return
    const scorers = scorersFrom(events, homeId)
    const cards   = redCardsFrom(events, homeId)
    // Anti-flicker : ne JAMAIS écraser par une liste de buteurs VIDE alors qu'il y
    // a des buts (réponse API en creux). En revanche, on affiche les buteurs dès
    // qu'au moins un est connu (les manquants se compléteront au tick suivant).
    if (totalGoals > 0 && scorers.length === 0) return
    // Buteurs : upsert.
    await sb('match_goals?on_conflict=match_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ match_id: matchId, scorers, updated_at: new Date().toISOString() }]),
    })
    // Cartons : on écrit UNIQUEMENT s'il y a au moins un carton rouge — jamais une
    // liste vide (un carton ne se retire pas, et un creux API ne doit pas l'effacer).
    if (cards.length > 0) {
      const r = await sb(`match_goals?match_id=eq.${matchId}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ cards }),
      })
      if (!r.ok && r.status !== 404) { /* colonne cards probablement absente — ignoré */ }
    }
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
    const o = orient(id, f)   // score + côté buteurs ré-orientés vers notre match_id
    rows.push({
      match_id: id, status: f.fixture?.status?.short || 'LIVE',
      elapsed: f.fixture?.status?.elapsed ?? null,
      home_score: o.homeScore, away_score: o.awayScore,
      updated_at: new Date().toISOString(),
    })
    // Récupère buteurs + cartons rouges : à chaque but, et même à 0-0 une fois
    // par minute (~1 tick sur 4) pour capter les cartons précoces sans cramer le quota.
    const totalGoals = o.homeScore + o.awayScore
    if (totalGoals > 0 || tickN % 4 === 0) {
      goalJobs.push(writeEvents(id, f.fixture?.id, o.appHomeId, totalGoals))
    }
  }
  // Fin de match « à la minute » : un fixture en direct au tick précédent mais
  // absent maintenant vient de se terminer → on le règle aussitôt (résultat +
  // points + verrou). Ainsi le « en direct » disparaît et le match est grisé sans
  // attendre le cron résultats.
  const curLiveIds = new Set(fixtures.map(f => f.fixture?.id).filter(Boolean))
  const ended = [...prevLiveIds].filter(id => !curLiveIds.has(id))
  prevLiveIds = curLiveIds
  for (const fid of ended) {
    const mid = fxMap.get(fid)
    if (!mid || settled.has(mid)) continue
    try {
      const one = await api(`/fixtures?id=${fid}`)
      const ff = one.response?.[0]
      if (ff && await settleFinished(ff, mid)) {
        settled.add(mid)
        console.log(`✅ terminé & réglé : ${mid} (${ff.goals?.home}-${ff.goals?.away})`)
      }
    } catch (e) { console.warn(`  ⚠️ fin ${mid}:`, String(e)) }
  }

  if (rows.length) {
    await sb('match_live?on_conflict=match_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
  }
  // On NE supprime PAS une ligne juste parce qu'elle est absente de live=all
  // (mi-temps, creux API) → le score reste affiché pendant toute la durée du match,
  // pauses comprises. On retire seulement les matchs réglés + les lignes périmées (>3 h).
  const er = await sb('match_results?select=match_id')
  const settledRows = er.ok ? (await er.json()).map(r => r.match_id) : []
  if (settledRows.length) await sb(`match_live?match_id=in.(${settledRows.join(',')})`, { method: 'DELETE' })
  const stale = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  await sb(`match_live?updated_at=lt.${stale}`, { method: 'DELETE' })
  const ids = rows.map(r => r.match_id)
  if (goalJobs.length) await Promise.all(goalJobs)
  const t = new Date().toISOString().slice(11, 19)
  console.log(`[${t}] en direct : ${rows.length}${rows.length ? ' → ' + ids.join(', ') : ''}`)
  return rows.length
}

// Nettoyage du « en direct » — Supabase UNIQUEMENT (zéro appel API football). Retire de
// match_live tout match déjà réglé OU dont la durée max (kickoff + 150 min) est dépassée.
// Tourne avant le gate, donc même hors fenêtre : aucun match ne reste « en direct » à tort.
async function cleanupLive(schedRows, settledSet) {
  try {
    const lr = await sb('match_live?select=match_id')
    if (!lr.ok) return
    const liveIds = new Set((await lr.json()).map(r => r.match_id))
    if (!liveIds.size) return
    const now = Date.now()
    const toDelete = new Set()
    for (const id of liveIds) if (settledSet.has(id)) toDelete.add(id)
    for (const s of schedRows) {
      const k = Date.parse(s.kickoff)
      if (liveIds.has(s.match_id) && Number.isFinite(k) && now > k + LIVE_MAX_MS) toDelete.add(s.match_id)
    }
    if (toDelete.size) await sb(`match_live?match_id=in.(${[...toDelete].join(',')})`, { method: 'DELETE' })
  } catch { /* ignore */ }
}

async function main() {
  const sched = await sb('match_schedule?select=match_id,kickoff')
  const schedRows = sched.ok ? await sched.json() : []
  validIds = new Set(schedRows.map(r => r.match_id))

  // ── GATE QUOTA ────────────────────────────────────────────────────────────
  // On n'appelle l'API football QUE si un match est dans sa fenêtre de jeu et pas
  // encore réglé, OU réglé depuis < 15 min (on tourne ~15 min après la fin pour être
  // sûr que le match est terminé). Sinon : sortie immédiate, ZÉRO requête API.
  const rr0 = await sb('match_results?select=match_id,settled_at')
  const settledAt = new Map()
  if (rr0.ok) for (const r of await rr0.json()) settledAt.set(r.match_id, Date.parse(r.settled_at))
  const settled0 = new Set(settledAt.keys())
  // Nettoyage du direct à CHAQUE passage (avant le gate) : un match terminé/périmé
  // ne reste jamais affiché « en direct », même hors fenêtre de jeu.
  await cleanupLive(schedRows, settled0)
  if (!shouldTrack(schedRows, settledAt, LIVE_PREROLL_MS, LIVE_MAX_MS)) {
    console.log('⏸️  Aucun match dans sa fenêtre de jeu — aucune requête API football.')
    return
  }
  for (const m of settled0) settled.add(m)   // réutilise le set pour le dedup des règlements

  // Mapping fiable de TOUTE la compétition (groupes + élimination directe) par fixture_id.
  let allFixtures = []
  try {
    const allRes = await api('/fixtures?league=1&season=2026')
    allFixtures = allRes.response || []
    const { map, unmatched } = buildFixtureMap(allFixtures, validIds)
    fxMap = map
    console.log(`Mapping fixtures : ${fxMap.size} mappés${unmatched.length ? ` · ${unmatched.length} NON mappés` : ''}`)
    if (unmatched.length) console.log(' - ' + unmatched.join('\n - '))
  } catch (e) { console.warn('build map erreur:', String(e)) }

  // Règle d'emblée les matchs déjà terminés mais pas encore réglés (couvre ceux
  // finis entre deux exécutions du worker, ou ratés par le cron résultats).
  try {
    const rr = await sb('match_results?select=match_id')
    if (rr.ok) for (const r of await rr.json()) settled.add(r.match_id)
    for (const f of allFixtures) {
      const mid = fxMap.get(f.fixture?.id)
      if (!mid || settled.has(mid)) continue
      if (await settleFinished(f, mid)) {
        settled.add(mid)
        console.log(`✅ réglé au démarrage : ${mid} (${f.goals?.home}-${f.goals?.away})`)
      }
    }
  } catch (e) { console.warn('settle démarrage erreur:', String(e)) }

  // Boucle ~5,5 min en interrogeant toutes les 15 s (le cron */5 relance →
  // couverture quasi continue). Arrêt anticipé si aucun match en direct.
  const ITER = 22, GAP = 15000
  for (let i = 0; i < ITER; i++) {
    let n = 0
    try { n = await tick() } catch (e) { console.warn('tick erreur:', String(e)) }
    if (i === 0 && n === 0) { console.log('Aucun match en direct — arrêt anticipé.'); break }
    if (i < ITER - 1) await sleep(GAP)
  }
  // Réconciliation du classement après les règlements (idempotent, insensible aux courses).
  try { const f = await reconcileScores(sb); if (f) console.log(`⚖️  Classement réconcilié : ${f} joueur(s).`) }
  catch (e) { console.warn('reconcile erreur:', String(e)) }
}
main().catch(e => { console.error(e); process.exit(0) })
