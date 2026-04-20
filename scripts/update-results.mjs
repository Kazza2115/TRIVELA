// Fetches finished WC 2026 matches from football-data.org and settles points in Supabase.
// Runs via GitHub Actions cron every 30 minutes during the tournament.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FOOTBALL_API_KEY     = process.env.FOOTBALL_DATA_API_KEY

if (!SUPABASE_SERVICE_KEY || !FOOTBALL_API_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or FOOTBALL_DATA_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// football-data.org English team names → our short codes
const API_TEAM_MAP = {
  'Mexico': 'MEX', 'South Korea': 'KOR', 'South Africa': 'ZAF',
  'Czech Republic': 'CZE', 'Czechia': 'CZE',
  'Canada': 'CAN', 'Switzerland': 'SUI', 'Qatar': 'QAT',
  'Bosnia and Herzegovina': 'BIH', 'Bosnia-Herzegovina': 'BIH',
  'Brazil': 'BRA', 'Morocco': 'MAR', 'Scotland': 'SCO', 'Haiti': 'HAI',
  'United States': 'USA', 'USA': 'USA',
  'Paraguay': 'PAR', 'Australia': 'AUS', 'Turkey': 'TUR', 'Türkiye': 'TUR',
  'Germany': 'GER', 'Ecuador': 'ECU',
  "Côte d'Ivoire": 'CIV', 'Ivory Coast': 'CIV', 'Curaçao': 'CUR',
  'Netherlands': 'NED', 'Japan': 'JPN', 'Sweden': 'SWE', 'Tunisia': 'TUN',
  'Belgium': 'BEL', 'Egypt': 'EGY', 'Iran': 'IRN', 'New Zealand': 'NZL',
  'Spain': 'ESP', 'Uruguay': 'URU', 'Saudi Arabia': 'SAU', 'Cape Verde': 'CPV',
  'France': 'FRA', 'Senegal': 'SEN', 'Norway': 'NOR', 'Iraq': 'IRQ',
  'Argentina': 'ARG', 'Algeria': 'DZA', 'Austria': 'AUT', 'Jordan': 'JOR',
  'Portugal': 'POR', 'Colombia': 'COL', 'Uzbekistan': 'UZB',
  'DR Congo': 'COD', 'Congo DR': 'COD',
  'England': 'ENG', 'Croatia': 'CRO', 'Panama': 'PAN', 'Ghana': 'GHA',
  'Venezuela': 'VEN',
}

// Mirror the group draw from wc2026Matches.ts
const GROUPS = {
  A: ['MEX','KOR','ZAF','CZE'], B: ['CAN','SUI','QAT','BIH'],
  C: ['BRA','MAR','SCO','HAI'], D: ['USA','PAR','AUS','TUR'],
  E: ['GER','ECU','CIV','CUR'], F: ['NED','JPN','SWE','TUN'],
  G: ['BEL','EGY','IRN','NZL'], H: ['ESP','URU','SAU','CPV'],
  I: ['FRA','SEN','NOR','IRQ'], J: ['ARG','DZA','AUT','JOR'],
  K: ['POR','COL','UZB','COD'], L: ['ENG','CRO','PAN','GHA'],
}
const MD_MATCHUPS = [[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]]

// Build lookup: "HOME-AWAY" → our internal match_id
const MATCH_LOOKUP = {}
for (const [g, teams] of Object.entries(GROUPS)) {
  for (let mdIdx = 0; mdIdx < 3; mdIdx++) {
    const md = mdIdx + 1
    for (const [hi, ai] of MD_MATCHUPS[mdIdx]) {
      MATCH_LOOKUP[`${teams[hi]}-${teams[ai]}`] = `g${g}-md${md}-${hi}v${ai}`
    }
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] Checking WC 2026 results...`)

  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED&season=2026',
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
  )
  if (!res.ok) {
    console.error('API error:', res.status, await res.text())
    process.exit(1)
  }

  const { matches = [] } = await res.json()
  console.log(`${matches.length} finished matches from API`)

  // Already-settled API match IDs
  const { data: settled } = await supabase.from('match_results').select('api_match_id')
  const settledIds = new Set((settled ?? []).map(r => r.api_match_id).filter(Boolean))

  let processed = 0
  for (const match of matches) {
    if (settledIds.has(match.id)) continue

    const homeShort = API_TEAM_MAP[match.homeTeam.name]
    const awayShort = API_TEAM_MAP[match.awayTeam.name]
    if (!homeShort || !awayShort) {
      console.warn(`Unknown team: "${match.homeTeam.name}" / "${match.awayTeam.name}"`)
      continue
    }

    const matchId = MATCH_LOOKUP[`${homeShort}-${awayShort}`]
    if (!matchId) {
      // Knockout stage — teams are TBD until qualified; skip for now
      console.log(`No match ID for ${homeShort}-${awayShort} (knockout?)`)
      continue
    }

    const homeScore = match.score.fullTime.home
    const awayScore = match.score.fullTime.away
    console.log(`Settling ${matchId}: ${homeShort} ${homeScore}-${awayScore} ${awayShort}`)

    const { error } = await supabase.rpc('settle_match', {
      p_match_id:   matchId,
      p_home_score: homeScore,
      p_away_score: awayScore,
    })
    if (error) { console.error(`Error settling ${matchId}:`, error.message); continue }

    // Tag the result row with the API match ID to avoid reprocessing
    await supabase.from('match_results')
      .update({ api_match_id: match.id })
      .eq('match_id', matchId)

    console.log(`✓ ${matchId} settled — ${homeScore}:${awayScore}`)
    processed++
  }

  console.log(`Done — ${processed} new results settled.`)
}

main().catch(e => { console.error(e); process.exit(1) })
