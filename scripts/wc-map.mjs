// Mapping partagé : fixtures API-Football (ligue 1, saison 2026) ↔ nos match_id.

// ── Fenêtres d'activité (protection du quota API) ───────────────────────────
// Un poller ne doit appeler l'API football QUE si un match est dans sa fenêtre.
// Fenêtres exprimées en millisecondes à partir du coup d'envoi (kickoff).
export const LIVE_PREROLL_MS  = 5 * 60 * 1000        // on suit dès 5 min avant le coup d'envoi
export const LIVE_MAX_MS      = 210 * 60 * 1000      // jusqu'à 3 h 30 après (couvre arrêts de jeu LONGS + prolongations + tirs au but)
export const RESULTS_MAX_MS   = 4 * 60 * 60 * 1000   // règlements + buteurs : jusqu'à 4 h après le coup d'envoi
export const SETTLE_GRACE_MS  = 15 * 60 * 1000       // on continue de suivre 15 min APRÈS le règlement (vérif du score final)

/**
 * Vrai si au moins un match du planning est MAINTENANT dans sa fenêtre.
 * @param schedule  lignes match_schedule : [{ match_id, kickoff }]
 * @param prerollMs marge avant le coup d'envoi
 * @param maxMs     durée de la fenêtre après le coup d'envoi
 */
export function anyMatchInWindow(schedule, prerollMs, maxMs, now = Date.now()) {
  return (schedule || []).some(s => {
    const k = Date.parse(s.kickoff)
    return Number.isFinite(k) && now >= k - prerollMs && now <= k + maxMs
  })
}

/**
 * Vrai si AU MOINS un match doit être suivi MAINTENANT :
 *  • pas encore réglé ET dans sa fenêtre [coup d'envoi - preroll ; +maxMs], OU
 *  • réglé depuis MOINS de SETTLE_GRACE_MS (on continue de tourner ~15 min après
 *    la fin pour être SÛR que le match est terminé et re-vérifier le score final).
 * @param settledAt Map ou objet { match_id → settled_at (ms epoch) }
 */
export function shouldTrack(schedule, settledAt, prerollMs, maxMs, now = Date.now()) {
  const at = id => settledAt instanceof Map ? settledAt.get(id) : (settledAt || {})[id]
  return (schedule || []).some(s => {
    const k = Date.parse(s.kickoff)
    if (!Number.isFinite(k)) return false
    const sa = at(s.match_id)
    if (sa != null && Number.isFinite(sa)) return now < sa + SETTLE_GRACE_MS
    return now >= k - prerollMs && now <= k + maxMs
  })
}

// Barème : +5 score exact · +4 bon nul · +3 bon vainqueur · 0 sinon.
export function betPoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 5
  if (realH > realA && predH > predA) return 3
  if (realH < realA && predH < predA) return 3
  if (realH === realA && predH === predA) return 4
  return 0
}

/**
 * Règle un match ENTIÈREMENT via REST (sans la fonction SQL settle_match, peu fiable) :
 *   1) upsert du résultat officiel dans match_results ;
 *   2) calcul + écriture des points de chaque pari (verrouillés) ;
 *   3) recalcul du score total de chaque joueur concerné = somme de SES points
 *      (auto-correcteur : corrige tout score faux/dérivé, idempotent).
 * Idempotent : si le résultat stocké est déjà identique → ne refait rien (changed:false).
 * @param sb  fonction REST : (path, init) => fetch(...) avec la clé service role
 * @returns { changed: boolean }
 */
export async function settleViaRest(sb, matchId, homeScore, awayScore) {
  // Idempotence : résultat déjà identique → rien à faire.
  const ex = await sb(`match_results?match_id=eq.${matchId}&select=home_score,away_score`)
  const exist = ex.ok ? (await ex.json())[0] : null
  if (exist && exist.home_score === homeScore && exist.away_score === awayScore) return { changed: false }

  // 1) Résultat officiel (upsert).
  await sb('match_results?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ match_id: matchId, home_score: homeScore, away_score: awayScore, settled_at: new Date().toISOString() }]),
  })

  // 2) Points de chaque pari sur ce match.
  const br = await sb(`bets?match_id=eq.${matchId}&select=id,user_id,home_score,away_score`)
  const bets = br.ok ? await br.json() : []
  const users = new Set()
  for (const b of bets) {
    const pts = betPoints(b.home_score, b.away_score, homeScore, awayScore)
    await sb(`bets?id=eq.${b.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ points: pts, locked: true }),
    })
    users.add(b.user_id)
  }

  // 3) Score total de chaque joueur concerné = somme de TOUS ses points (auto-correcteur).
  for (const uid of users) {
    const pr = await sb(`bets?user_id=eq.${uid}&select=points`)
    const rows = pr.ok ? await pr.json() : []
    const total = rows.reduce((s, r) => s + (r.points || 0), 0)
    await sb(`profiles?id=eq.${uid}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ score: total }),
    })
  }
  return { changed: true }
}

export const GROUPS = {
  A: ['MEX','KOR','ZAF','CZE'], B: ['CAN','SUI','QAT','BIH'], C: ['BRA','MAR','SCO','HAI'],
  D: ['USA','PAR','AUS','TUR'], E: ['GER','ECU','CIV','CUR'], F: ['NED','JPN','SWE','TUN'],
  G: ['BEL','EGY','IRN','NZL'], H: ['ESP','URU','SAU','CPV'], I: ['FRA','SEN','NOR','IRQ'],
  J: ['ARG','DZA','AUT','JOR'], K: ['POR','COL','UZB','COD'], L: ['ENG','CRO','PAN','GHA'],
}
export const shortToGroup = {}
for (const [g, arr] of Object.entries(GROUPS)) arr.forEach(s => { shortToGroup[s] = g })

const ALIASES = {
  MEX:['Mexico'], KOR:['South Korea','Korea Republic'], ZAF:['South Africa'], CZE:['Czech Republic','Czechia'],
  CAN:['Canada'], SUI:['Switzerland'], QAT:['Qatar'], BIH:['Bosnia & Herzegovina','Bosnia and Herzegovina'],
  BRA:['Brazil'], MAR:['Morocco'], SCO:['Scotland'], HAI:['Haiti'],
  USA:['USA','United States'], PAR:['Paraguay'], AUS:['Australia'], TUR:['Turkey','Turkiye','Türkiye'],
  GER:['Germany'], ECU:['Ecuador'], CIV:['Ivory Coast',"Cote d'Ivoire"], CUR:['Curacao','Curaçao'],
  NED:['Netherlands'], JPN:['Japan'], SWE:['Sweden'], TUN:['Tunisia'],
  BEL:['Belgium'], EGY:['Egypt'], IRN:['Iran'], NZL:['New Zealand'],
  ESP:['Spain'], URU:['Uruguay'], SAU:['Saudi Arabia'], CPV:['Cape Verde','Cape Verde Islands','Cabo Verde'],
  FRA:['France'], SEN:['Senegal'], NOR:['Norway'], IRQ:['Iraq'],
  ARG:['Argentina'], DZA:['Algeria'], AUT:['Austria'], JOR:['Jordan'],
  POR:['Portugal'], COL:['Colombia'], UZB:['Uzbekistan'], COD:['Congo DR','DR Congo','Democratic Republic of Congo','Congo'],
  ENG:['England'], CRO:['Croatia'], PAN:['Panama'], GHA:['Ghana'],
}
export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
const NAME2SHORT = {}
for (const [short, names] of Object.entries(ALIASES)) names.forEach(n => { NAME2SHORT[norm(n)] = short })

export function shortOf(name) { return NAME2SHORT[norm(name)] || null }

// Code court (minuscule) de l'équipe à DOMICILE selon NOTRE match_id de groupe
// (ex. 'gD-md1-usa-par' → 'usa'). null pour l'élimination directe (équipes TBD).
export function appHomeShort(matchId) {
  const m = /^g[A-L]-md\d+-([a-z]+)-[a-z]+$/.exec(matchId || '')
  return m ? m[1] : null
}

/**
 * Normalise une fixture API vers l'orientation de NOTRE match_id.
 * Si l'API place à domicile l'équipe que nous classons à l'extérieur (orientation
 * opposée), on inverse score ET côté des buteurs → score exact et buteurs du bon côté.
 * Renvoie { swapped, homeScore, awayScore, appHomeId } (appHomeId = id API de l'équipe
 * que NOUS considérons à domicile, à passer à scorersFrom/redCardsFrom).
 */
export function orient(matchId, f) {
  const appH = appHomeShort(matchId)
  const apiH = shortOf(f?.teams?.home?.name)
  const swapped = !!(appH && apiH && appH !== apiH.toLowerCase())
  return {
    swapped,
    homeScore: swapped ? (f?.goals?.away ?? 0) : (f?.goals?.home ?? 0),
    awayScore: swapped ? (f?.goals?.home ?? 0) : (f?.goals?.away ?? 0),
    appHomeId: swapped ? f?.teams?.away?.id : f?.teams?.home?.id,
  }
}

/** Renvoie notre match_id pour une fixture de phase de groupes, ou null. */
export function fixtureToMatchId(f, validIds) {
  const round = f.league?.round || ''
  const mdM = round.match(/(\d+)/)
  const md = mdM ? Number(mdM[1]) : null
  const hs = shortOf(f.teams?.home?.name)
  const as = shortOf(f.teams?.away?.name)
  if (!round.toLowerCase().includes('group') || !md || !hs || !as) return null
  const id = `g${shortToGroup[hs]}-md${md}-${hs.toLowerCase()}-${as.toLowerCase()}`
  if (validIds && validIds.size && !validIds.has(id)) {
    const alt = `g${shortToGroup[as]}-md${md}-${as.toLowerCase()}-${hs.toLowerCase()}`
    return validIds.has(alt) ? alt : null
  }
  return id
}

// Rounds à élimination directe (l'ordre = priorité de test des libellés API).
const KO_ROUNDS = [
  { re: /round of 32|1\/16|last 32/i, prefix: 'r32',   n: 16 },
  { re: /round of 16|1\/8|last 16/i,  prefix: 'r16',   n: 8  },
  { re: /quarter/i,                   prefix: 'qf',    n: 4  },
  { re: /semi/i,                      prefix: 'sf',    n: 2  },
  { re: /3rd|third place/i,           prefix: '3rd',   n: 1  },
  { re: /final/i,                     prefix: 'final', n: 1  },
]

/**
 * Construit le mapping FIABLE fixture_id → notre match_id pour TOUTE la compétition
 * (groupes par équipes/journée, élimination directe par tour + ordre chronologique).
 * Renvoie { map: Map<fixtureId, matchId>, unmatched: [...] }.
 */
export function buildFixtureMap(fixtures, validIds) {
  const map = new Map()
  const buckets = {}
  const unmatched = []
  for (const f of (fixtures || [])) {
    const fid = f.fixture?.id
    if (!fid) continue
    const round = f.league?.round || ''
    if (/group/i.test(round)) {
      const id = fixtureToMatchId(f, validIds)
      if (id) map.set(fid, id)
      else unmatched.push(`${f.teams?.home?.name} vs ${f.teams?.away?.name} [${round}]`)
      continue
    }
    const ko = KO_ROUNDS.find(k => k.re.test(round))
    if (!ko) { unmatched.push(`${f.teams?.home?.name} vs ${f.teams?.away?.name} [${round}]`); continue }
    const ts = Date.parse(f.fixture?.date || '') || 0
    ;(buckets[ko.prefix] ||= []).push({ fid, ts })
  }
  for (const ko of KO_ROUNDS) {
    const arr = buckets[ko.prefix]
    if (!arr) continue
    arr.sort((a, b) => a.ts - b.ts)
    arr.forEach((x, i) => map.set(x.fid, ko.n === 1 ? ko.prefix : `${ko.prefix}-${i + 1}`))
  }
  return { map, unmatched }
}
