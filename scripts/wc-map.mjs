// Mapping partagé : fixtures API-Football (ligue 1, saison 2026) ↔ nos match_id.

// ── Fenêtres d'activité (protection du quota API) ───────────────────────────
// Un poller ne doit appeler l'API football QUE si un match est dans sa fenêtre.
// Fenêtres exprimées en millisecondes à partir du coup d'envoi (kickoff).
export const LIVE_PREROLL_MS  = 5 * 60 * 1000        // on suit dès 5 min avant le coup d'envoi
export const LIVE_MAX_MS      = 150 * 60 * 1000      // jusqu'à 150 min après (prolongations + tab)
export const RESULTS_MAX_MS   = 4 * 60 * 60 * 1000   // règlements + buteurs : jusqu'à 4 h après le coup d'envoi

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
