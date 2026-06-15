// Tendance « mondiale » : récupère les cotes bookmakers (Match Winner) via
// API-Football pour les matchs À VENIR, les convertit en probabilités implicites
// dé-viggées (moyenne de tous les bookmakers) et les stocke dans match_odds.
// Quota-friendly : ne traite que les matchs dont le coup d'envoi est dans la
// fenêtre [maintenant, +N jours] et pas encore commencés. Cron toutes les 12 h.
import { buildFixtureMap, orient } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
const FORCE    = process.env.FORCE === '1'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant'); process.exit(1) }

const sb  = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const api   = path => fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Fenêtre : on ne cherche les cotes que pour les matchs à venir dans les LOOKAHEAD jours.
const LOOKAHEAD_MS = 8 * 24 * 60 * 60 * 1000

// WC 2026 : Jun 1 → Jul 20 (cotes pré-match). Hors fenêtre : rien à faire.
function inSeason() {
  const now = Date.now()
  return now >= Date.UTC(2026, 5, 1) && now <= Date.UTC(2026, 6, 20)
}

/**
 * Probabilités dé-viggées moyennes à partir des bookmakers d'un fixture.
 * Pour chaque bookmaker : p = 1/cote, normalisé (retire la marge), puis moyenne.
 * @returns { home, draw, away, n } en fractions (somme ≈ 1), ou null si aucune cote.
 */
function impliedProbs(bookmakers) {
  let sh = 0, sd = 0, sa = 0, n = 0
  for (const bk of (bookmakers || [])) {
    const bet = (bk.bets || []).find(b => Number(b.id) === 1 || /match winner/i.test(b.name || ''))
    if (!bet) continue
    let oh = 0, od = 0, oa = 0
    for (const v of (bet.values || [])) {
      const odd = parseFloat(v.odd)
      if (!Number.isFinite(odd) || odd <= 1) continue
      if (/^home$/i.test(v.value) || v.value === '1') oh = odd
      else if (/^draw$/i.test(v.value) || /^x$/i.test(v.value)) od = odd
      else if (/^away$/i.test(v.value) || v.value === '2') oa = odd
    }
    if (oh <= 0 || od <= 0 || oa <= 0) continue
    const ph = 1 / oh, pd = 1 / od, pa = 1 / oa
    const s = ph + pd + pa
    if (s <= 0) continue
    sh += ph / s; sd += pd / s; sa += pa / s; n++
  }
  if (n === 0) return null
  return { home: sh / n, draw: sd / n, away: sa / n, n }
}

// Convertit des fractions (home/draw/away) en pourcentages entiers de somme 100.
function toPercents({ home, draw, away }) {
  let h = Math.round(home * 100)
  let a = Math.round(away * 100)
  let d = 100 - h - a
  if (d < 0) { // arrondi : on retire du plus grand des deux extrêmes
    if (h >= a) h += d; else a += d
    d = 0
  }
  return { home_pct: h, draw_pct: d, away_pct: a }
}

async function main() {
  if (!inSeason() && !FORCE) {
    console.log('⏸️  Hors saison WC 2026 — aucune requête odds.')
    return
  }

  // Sonde : si la table match_odds n'existe pas encore (db-trends.sql non exécuté),
  // on sort AVANT tout appel API football (zéro quota gaspillé).
  const probe = await sb('match_odds?select=match_id&limit=1')
  if (!probe.ok) {
    console.log('⚠️  Table match_odds absente — exécuter db-trends.sql dans Supabase. Abandon.')
    return
  }

  const sched = await sb('match_schedule?select=match_id,kickoff')
  const schedRows = sched.ok ? await sched.json() : []
  const validIds = new Set(schedRows.map(r => r.match_id))
  const kickoff = new Map(schedRows.map(r => [r.match_id, Date.parse(r.kickoff)]))

  const now = Date.now()
  // Matchs cibles : coup d'envoi à venir (ou tout à venir si FORCE), dans la fenêtre.
  const targets = new Set(
    schedRows
      .map(r => r.match_id)
      .filter(id => {
        const k = kickoff.get(id)
        if (!Number.isFinite(k) || k <= now) return false
        return FORCE || k - now <= LOOKAHEAD_MS
      })
  )
  if (targets.size === 0) {
    console.log('Aucun match à venir dans la fenêtre — rien à faire.')
    return
  }
  console.log(`${targets.size} match(s) à venir à coter.`)

  // Mapping fixture_id API → notre match_id (toute la compétition).
  let fxByMatch = new Map()   // notre match_id → fixture API complète
  try {
    const allRes = await api('/fixtures?league=1&season=2026')
    const allFixtures = allRes.response || []
    const { map } = buildFixtureMap(allFixtures, validIds)
    const fxById = new Map(allFixtures.map(f => [f.fixture?.id, f]))
    for (const [fid, mid] of map) {
      if (targets.has(mid)) fxByMatch.set(mid, fxById.get(fid))
    }
    console.log(`Fixtures mappées pour cibles : ${fxByMatch.size}/${targets.size}`)
  } catch (e) { console.warn('build map erreur:', String(e)); return }

  const rows = []
  for (const [mid, f] of fxByMatch) {
    const fid = f?.fixture?.id
    if (!fid) continue
    try {
      const res = await api(`/odds?fixture=${fid}&bet=1`)
      const entry = res?.response?.[0]
      const probs = impliedProbs(entry?.bookmakers)
      if (!probs) { console.log(`  • ${mid} : pas de cotes (fixture ${fid})`); await sleep(300); continue }
      // Réoriente vers NOTRE domicile/extérieur (l'API peut inverser les équipes).
      const swapped = orient(mid, f).swapped
      const oriented = swapped ? { home: probs.away, draw: probs.draw, away: probs.home } : probs
      const pct = toPercents(oriented)
      rows.push({
        match_id: mid, ...pct, bookmakers: probs.n, updated_at: new Date().toISOString(),
      })
      console.log(`  ✓ ${mid} : ${pct.home_pct}/${pct.draw_pct}/${pct.away_pct} (${probs.n} bookmakers${swapped ? ', inversé' : ''})`)
    } catch (e) { console.warn(`  ⚠️ odds ${mid}:`, String(e)) }
    await sleep(400)   // throttle quota
  }

  if (rows.length) {
    await sb('match_odds?on_conflict=match_id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
  }
  console.log(`Terminé — ${rows.length} cote(s) mise(s) à jour.`)
}

main().catch(e => { console.error(e); process.exit(0) })
