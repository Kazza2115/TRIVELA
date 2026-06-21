// Ponctuel : audit du classement. À retirer.
import { buildFixtureMap, orient, betPoints } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, { ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) } })
const api = p => fetch(`${API}${p}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const jget = async p => { const r = await sb(p); return r.ok ? r.json() : [] }
const FINISHED = new Set(['FT', 'AET', 'PEN'])

// ── 1) Résultats stockés vs API (détecte score inversé/faux) ──
const sr = {}
for (const r of await jget('match_results?select=match_id,home_score,away_score')) sr[r.match_id] = { h: r.home_score, a: r.away_score }
console.log(`Matchs réglés : ${Object.keys(sr).length}`)
const all = (await api('/fixtures?league=1&season=2026')).response || []
const validIds = new Set((await jget('match_schedule?select=match_id')).map(r => r.match_id))
const { map } = buildFixtureMap(all, validIds)
const fxById = new Map(all.map(f => [f.fixture?.id, f]))
const midToFid = new Map([...map.entries()].map(([fid, mid]) => [mid, fid]))
let resWrong = 0
for (const [mid, st] of Object.entries(sr)) {
  const f = fxById.get(midToFid.get(mid))
  if (!f || !FINISHED.has(f.fixture?.status?.short)) continue
  const o = orient(mid, f)
  if (o.homeScore !== st.h || o.awayScore !== st.a) { resWrong++; console.log(`  ⚠️ RÉSULTAT ${mid} : stocké ${st.h}-${st.a} ≠ API ${o.homeScore}-${o.awayScore}`) }
}
console.log(`→ Résultats incohérents avec l'API : ${resWrong}`)

// ── 2) Points des paris vs barème ──
const bets = await jget('bets?select=user_id,match_id,home_score,away_score,points,locked&limit=5000')
let ptsWrong = 0
for (const b of bets) {
  const r = sr[b.match_id]
  if (!r) { if (b.points != null) { ptsWrong++; if (ptsWrong <= 15) console.log(`  ⚠️ POINTS ${b.match_id} (non réglé) a des points=${b.points}`) } continue }
  const exp = betPoints(b.home_score, b.away_score, r.h, r.a)
  if (b.points !== exp) { ptsWrong++; if (ptsWrong <= 15) console.log(`  ⚠️ POINTS ${b.match_id} u=${b.user_id.slice(0,8)} : ${b.home_score}-${b.away_score} stocké ${b.points} ≠ attendu ${exp}`) }
}
console.log(`→ Paris mal pointés : ${ptsWrong}`)

// ── 3) Score profil vs somme des points ──
const sums = {}
for (const b of bets) sums[b.user_id] = (sums[b.user_id] || 0) + (b.points || 0)
const profiles = await jget('profiles?select=id,pseudo,score')
let drift = 0
for (const p of profiles) { const s = sums[p.id] || 0; if (s !== p.score) { drift++; if (drift <= 20) console.log(`  ⚠️ DRIFT ${p.pseudo} : score affiché ${p.score} ≠ somme points ${s}`) } }
console.log(`→ Profils dont score ≠ somme des points : ${drift}`)

// ── 4) Classement actuel ──
console.log('\n🏆 Classement (top 15) :')
profiles.sort((a, b) => b.score - a.score).slice(0, 15).forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.pseudo} — ${p.score} (somme réelle ${sums[p.id] || 0})`))
