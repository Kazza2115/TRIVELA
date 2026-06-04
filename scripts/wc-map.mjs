// Mapping partagé : fixtures API-Football (ligue 1, saison 2026) ↔ nos match_id.
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
