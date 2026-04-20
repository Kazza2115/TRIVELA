// Fetches finished WC 2026 matches from football-data.org and settles points in Supabase.
// Runs via GitHub Actions cron every 5 minutes.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FOOTBALL_API_KEY     = process.env.FOOTBALL_DATA_API_KEY

if (!SUPABASE_SERVICE_KEY || !FOOTBALL_API_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or FOOTBALL_DATA_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Smart time-window check ──────────────────────────────────────────────────
// Only call the external API during WC 2026 and during match hours (UTC).
// Kickoffs: 18:00 and 21:00 UTC. With extra time + penalties: end by 01:00 UTC.
function isInMatchWindow() {
  const now = new Date()

  // WC 2026: Jun 11 → Jul 20 (UTC, with 1-day buffer)
  const WC_START = Date.UTC(2026, 5, 11)   // June 11
  const WC_END   = Date.UTC(2026, 6, 20)   // July 20
  if (now.getTime() < WC_START || now.getTime() > WC_END) return false

  // Active match hours: 17:30–01:00 UTC
  const h = now.getUTCHours()
  const m = now.getUTCMinutes()
  const t = h * 60 + m
  return t >= 17 * 60 + 30 || t <= 60
}

// ─── football-data.org English names → our short codes ───────────────────────
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

// ─── Group draw → internal match IDs ─────────────────────────────────────────
const GROUPS = {
  A: ['MEX','KOR','ZAF','CZE'], B: ['CAN','SUI','QAT','BIH'],
  C: ['BRA','MAR','SCO','HAI'], D: ['USA','PAR','AUS','TUR'],
  E: ['GER','ECU','CIV','CUR'], F: ['NED','JPN','SWE','TUN'],
  G: ['BEL','EGY','IRN','NZL'], H: ['ESP','URU','SAU','CPV'],
  I: ['FRA','SEN','NOR','IRQ'], J: ['ARG','DZA','AUT','JOR'],
  K: ['POR','COL','UZB','COD'], L: ['ENG','CRO','PAN','GHA'],
}
const MD_MATCHUPS = [[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]]

const MATCH_LOOKUP = {}
for (const [g, teams] of Object.entries(GROUPS)) {
  for (let mdIdx = 0; mdIdx < 3; mdIdx++) {
    const md = mdIdx + 1
    for (const [hi, ai] of MD_MATCHUPS[mdIdx]) {
      MATCH_LOOKUP[`${teams[hi]}-${teams[ai]}`] = `g${g}-md${md}-${hi}v${ai}`
    }
  }
}

// ─── Fetch with retry ─────────────────────────────────────────────────────────
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.ok) return res
      if (res.status === 429) {
        // Rate limited — wait 60s and retry once
        console.warn('Rate limited (429) — waiting 60s...')
        await new Promise(r => setTimeout(r, 60_000))
        continue
      }
      throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    } catch (e) {
      if (i === retries - 1) throw e
      const wait = (i + 1) * 3000
      console.warn(`Attempt ${i + 1} failed: ${e.message} — retrying in ${wait / 1000}s`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const ts = new Date().toISOString()
  console.log(`[${ts}] Checking WC 2026 results...`)

  if (!isInMatchWindow()) {
    console.log('Outside WC 2026 match window — nothing to do.')
    return
  }

  const res = await fetchWithRetry(
    'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED&season=2026',
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
  )
  const { matches = [] } = await res.json()
  console.log(`${matches.length} finished match(es) from API`)

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
      // Knockout stage — teams TBD until qualified
      console.log(`No match ID for ${homeShort}-${awayShort} (knockout TBD)`)
      continue
    }

    const homeScore = match.score.fullTime.home
    const awayScore = match.score.fullTime.away
    if (homeScore === null || awayScore === null) {
      console.warn(`Score not yet available for ${matchId}`)
      continue
    }

    console.log(`Settling ${matchId}: ${homeShort} ${homeScore}-${awayScore} ${awayShort}`)

    const { error } = await supabase.rpc('settle_match', {
      p_match_id:   matchId,
      p_home_score: homeScore,
      p_away_score: awayScore,
    })
    if (error) { console.error(`Error settling ${matchId}:`, error.message); continue }

    // Tag result row with API match ID to avoid reprocessing
    await supabase.from('match_results')
      .update({ api_match_id: match.id })
      .eq('match_id', matchId)

    console.log(`✓ ${matchId} settled — ${homeScore}:${awayScore}`)
    processed++
  }

  console.log(`Done — ${processed} new result(s) settled.`)
}

main().catch(e => { console.error(e); process.exit(1) })
