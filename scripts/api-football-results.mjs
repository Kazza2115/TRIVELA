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

async function main() {
  const sched = await sb('match_schedule?select=match_id')
  const validIds = sched.ok ? new Set((await sched.json()).map(r => r.match_id)) : new Set()

  // Nb de buteurs DÉJÀ enregistrés par match (pour ne re-télécharger que si incomplet).
  const gExisting = await sb('match_goals?select=match_id,scorers')
  const storedCount = new Map()
  if (gExisting.ok) {
    for (const r of await gExisting.json()) {
      storedCount.set(r.match_id, Array.isArray(r.scorers) ? r.scorers.length : 0)
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
      // Persiste les buteurs tant que la liste stockée est incomplète (< score),
      // et SEULEMENT si la nouvelle liste est complète. Auto-répare donc aussi les
      // matchs déjà figés avec une liste vide/partielle suite à un creux API passé.
      const totalGoals = f.goals.home + f.goals.away
      if ((storedCount.get(id) ?? 0) < totalGoals) {
        try {
          const ev = await api(`/fixtures/events?fixture=${f.fixture?.id}`)
          const events = ev?.response
          const scorers = Array.isArray(events) ? scorersFrom(events, f.teams?.home?.id) : []
          if (Array.isArray(events) && scorers.length >= totalGoals) {
            const gr = await sb('match_goals?on_conflict=match_id', {
              method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify([{ match_id: id, scorers, updated_at: new Date().toISOString() }]),
            })
            if (gr.ok) goalsWritten++
          } else {
            console.warn(`  ⏳ buteurs ${id} incomplets (${scorers.length}/${totalGoals}) — réessai au prochain run`)
          }
        } catch (e) { console.warn(`  ⚠️ events ${id}:`, String(e)) }
      }
    }
  }
  console.log(`✅ Mappés : ${matched}/${fixtures.length} · Réglés : ${settled} · Buteurs écrits : ${goalsWritten}`)
  if (unmatched.length) console.log(`⚠️ Non mappés (${unmatched.length}) :\n - ${unmatched.join('\n - ')}`)
}
main().catch(e => { console.error('Erreur :', e); process.exit(1) })
