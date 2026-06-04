// Résultats via API-Football : mappe nos 72 matchs ↔ fixtures (ligue 1, saison
// 2026) et règle les matchs TERMINÉS (settle_match → points + classements).
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant (SUPABASE_SERVICE_ROLE_KEY / API_FOOTBALL_KEY)'); process.exit(1) }

const sb  = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const api = path => fetch(`${API}${path}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())

const GROUPS = {
  A: ['MEX','KOR','ZAF','CZE'], B: ['CAN','SUI','QAT','BIH'], C: ['BRA','MAR','SCO','HAI'],
  D: ['USA','PAR','AUS','TUR'], E: ['GER','ECU','CIV','CUR'], F: ['NED','JPN','SWE','TUN'],
  G: ['BEL','EGY','IRN','NZL'], H: ['ESP','URU','SAU','CPV'], I: ['FRA','SEN','NOR','IRQ'],
  J: ['ARG','DZA','AUT','JOR'], K: ['POR','COL','UZB','COD'], L: ['ENG','CRO','PAN','GHA'],
}
const shortToGroup = {}
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
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
const NAME2SHORT = {}
for (const [short, names] of Object.entries(ALIASES)) names.forEach(n => { NAME2SHORT[norm(n)] = short })

const FINISHED = new Set(['FT', 'AET', 'PEN'])

async function main() {
  // Ids valides connus (table match_schedule) pour valider l'ordre domicile/extérieur
  const sched = await sb('match_schedule?select=match_id')
  const validIds = sched.ok ? new Set((await sched.json()).map(r => r.match_id)) : new Set()
  console.log(`match_schedule : ${validIds.size} ids connus`)

  const data = await api('/fixtures?league=1&season=2026')
  const fixtures = data.response || []
  console.log(`Fixtures API : ${fixtures.length}`)

  let matched = 0, settled = 0
  const unmatched = []
  for (const f of fixtures) {
    const round = f.league?.round || ''
    const mdM = round.match(/(\d+)/)
    const md = mdM ? Number(mdM[1]) : null
    const hs = NAME2SHORT[norm(f.teams?.home?.name)]
    const as = NAME2SHORT[norm(f.teams?.away?.name)]
    if (!round.toLowerCase().includes('group') || !md || !hs || !as) {
      unmatched.push(`${f.teams?.home?.name} vs ${f.teams?.away?.name} [${round}]`)
      continue
    }
    let id = `g${shortToGroup[hs]}-md${md}-${hs.toLowerCase()}-${as.toLowerCase()}`
    if (validIds.size && !validIds.has(id)) {
      const alt = `g${shortToGroup[as]}-md${md}-${as.toLowerCase()}-${hs.toLowerCase()}`
      if (validIds.has(alt)) id = alt
      else { unmatched.push(`${f.teams.home.name} vs ${f.teams.away.name} → ${id} (introuvable)`); continue }
    }
    matched++
    const status = f.fixture?.status?.short
    if (FINISHED.has(status) && f.goals?.home != null && f.goals?.away != null) {
      const r = await sb('rpc/settle_match', { method: 'POST',
        body: JSON.stringify({ p_match_id: id, p_home_score: f.goals.home, p_away_score: f.goals.away }) })
      if (r.ok) settled++
      else console.warn(`  ⚠️ settle ${id}: ${r.status} ${await r.text().catch(() => '')}`)
    }
  }
  console.log(`✅ Mappés : ${matched}/${fixtures.length} · Réglés (terminés) : ${settled}`)
  if (unmatched.length) console.log(`⚠️ Non mappés (${unmatched.length}) :\n - ${unmatched.join('\n - ')}`)
}
main().catch(e => { console.error('Erreur :', e); process.exit(1) })
