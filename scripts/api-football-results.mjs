// Résultats via API-Football : règle les matchs de groupe TERMINÉS
// (settle_match → points + classements). Mapping partagé via wc-map.mjs.
import { fixtureToMatchId } from './wc-map.mjs'

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

  // Matchs dont les buteurs sont déjà enregistrés (pour ne pas les re-télécharger).
  const gExisting = await sb('match_goals?select=match_id')
  const haveGoals = gExisting.ok ? new Set((await gExisting.json()).map(r => r.match_id)) : new Set()

  const data = await api('/fixtures?league=1&season=2026')
  const fixtures = data.response || []
  let matched = 0, settled = 0, goalsWritten = 0
  const unmatched = []
  for (const f of fixtures) {
    const id = fixtureToMatchId(f, validIds)
    if (!id) { unmatched.push(`${f.teams?.home?.name} vs ${f.teams?.away?.name} [${f.league?.round}]`); continue }
    matched++
    const status = f.fixture?.status?.short
    if (FINISHED.has(status) && f.goals?.home != null && f.goals?.away != null) {
      const r = await sb('rpc/settle_match', { method: 'POST',
        body: JSON.stringify({ p_match_id: id, p_home_score: f.goals.home, p_away_score: f.goals.away }) })
      if (r.ok) settled++
      else console.warn(`  ⚠️ settle ${id}: ${r.status} ${await r.text().catch(() => '')}`)
      // Persiste les buteurs une seule fois par match terminé.
      if (!haveGoals.has(id) && (f.goals.home + f.goals.away) > 0) {
        try {
          const ev = await api(`/fixtures/events?fixture=${f.fixture?.id}`)
          const scorers = scorersFrom(ev.response, f.teams?.home?.id)
          const gr = await sb('match_goals?on_conflict=match_id', {
            method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify([{ match_id: id, scorers, updated_at: new Date().toISOString() }]),
          })
          if (gr.ok) goalsWritten++
        } catch (e) { console.warn(`  ⚠️ events ${id}:`, String(e)) }
      }
    }
  }
  console.log(`✅ Mappés : ${matched}/${fixtures.length} · Réglés : ${settled} · Buteurs écrits : ${goalsWritten}`)
  if (unmatched.length) console.log(`⚠️ Non mappés (${unmatched.length}) :\n - ${unmatched.join('\n - ')}`)

  // Match test : règle l'amical France (team 2) du 8 juin quand terminé.
  try {
    const d = await api('/fixtures?team=2&date=2026-06-08')
    const f = (d.response || [])[0]
    const st = f?.fixture?.status?.short
    if (f && FINISHED.has(st) && f.goals?.home != null && f.goals?.away != null) {
      const r = await sb('rpc/settle_match', { method: 'POST',
        body: JSON.stringify({ p_match_id: 'fr-nir', p_home_score: f.goals.home, p_away_score: f.goals.away }) })
      console.log(`Amical France réglé (${f.goals.home}-${f.goals.away}) :`, r.status)
      if (!haveGoals.has('fr-nir') && (f.goals.home + f.goals.away) > 0) {
        const ev = await api(`/fixtures/events?fixture=${f.fixture?.id}`)
        const scorers = scorersFrom(ev.response, f.teams?.home?.id)
        await sb('match_goals?on_conflict=match_id', {
          method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ match_id: 'fr-nir', scorers, updated_at: new Date().toISOString() }]),
        })
      }
    }
  } catch (e) { console.warn('amical:', String(e)) }
}
main().catch(e => { console.error('Erreur :', e); process.exit(1) })
