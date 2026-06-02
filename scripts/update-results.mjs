// Fetches finished WC 2026 matches from football-data.org and settles points in Supabase.
// Runs via GitHub Actions cron every 5 minutes.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const FOOTBALL_API_KEY     = process.env.FOOTBALL_DATA_API_KEY
const APIFOOTBALL_KEY      = process.env.APIFOOTBALL_KEY   // source de secours (optionnelle)

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
export const API_TEAM_MAP = {
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
  'Spain': 'ESP', 'Uruguay': 'URU', 'Saudi Arabia': 'SAU',
  'Cape Verde': 'CPV', 'Cape Verde Islands': 'CPV',
  'France': 'FRA', 'Senegal': 'SEN', 'Norway': 'NOR', 'Iraq': 'IRQ',
  'Argentina': 'ARG', 'Algeria': 'DZA', 'Austria': 'AUT', 'Jordan': 'JOR',
  'Portugal': 'POR', 'Colombia': 'COL', 'Uzbekistan': 'UZB',
  'DR Congo': 'COD', 'Congo DR': 'COD',
  'England': 'ENG', 'Croatia': 'CRO', 'Panama': 'PAN', 'Ghana': 'GHA',
  'Venezuela': 'VEN',
}

// ─── HOME-AWAY → internal match ID (mirrors wc2026Matches.ts exactly) ────────
export const MATCH_LOOKUP = {
  // Group A
  'MEX-ZAF':'gA-md1-mex-zaf', 'KOR-CZE':'gA-md1-kor-cze',
  'CZE-ZAF':'gA-md2-cze-zaf', 'MEX-KOR':'gA-md2-mex-kor',
  'CZE-MEX':'gA-md3-cze-mex', 'ZAF-KOR':'gA-md3-zaf-kor',
  // Group B
  'CAN-BIH':'gB-md1-can-bih', 'QAT-SUI':'gB-md1-qat-sui',
  'SUI-BIH':'gB-md2-sui-bih', 'CAN-QAT':'gB-md2-can-qat',
  'SUI-CAN':'gB-md3-sui-can', 'BIH-QAT':'gB-md3-bih-qat',
  // Group C
  'BRA-MAR':'gC-md1-bra-mar', 'HAI-SCO':'gC-md1-hai-sco',
  'SCO-MAR':'gC-md2-sco-mar', 'BRA-HAI':'gC-md2-bra-hai',
  'SCO-BRA':'gC-md3-sco-bra', 'MAR-HAI':'gC-md3-mar-hai',
  // Group D
  'USA-PAR':'gD-md1-usa-par', 'AUS-TUR':'gD-md1-aus-tur',
  'USA-AUS':'gD-md2-usa-aus', 'TUR-PAR':'gD-md2-tur-par',
  'TUR-USA':'gD-md3-tur-usa', 'PAR-AUS':'gD-md3-par-aus',
  // Group E
  'GER-CUR':'gE-md1-ger-cur', 'CIV-ECU':'gE-md1-civ-ecu',
  'GER-CIV':'gE-md2-ger-civ', 'ECU-CUR':'gE-md2-ecu-cur',
  'CUR-CIV':'gE-md3-cur-civ', 'ECU-GER':'gE-md3-ecu-ger',
  // Group F
  'NED-JPN':'gF-md1-ned-jpn', 'SWE-TUN':'gF-md1-swe-tun',
  'TUN-JPN':'gF-md2-tun-jpn', 'NED-SWE':'gF-md2-ned-swe',
  'JPN-SWE':'gF-md3-jpn-swe', 'TUN-NED':'gF-md3-tun-ned',
  // Group G
  'BEL-EGY':'gG-md1-bel-egy', 'IRN-NZL':'gG-md1-irn-nzl',
  'BEL-IRN':'gG-md2-bel-irn', 'NZL-EGY':'gG-md2-nzl-egy',
  'EGY-IRN':'gG-md3-egy-irn', 'NZL-BEL':'gG-md3-nzl-bel',
  // Group H
  'ESP-CPV':'gH-md1-esp-cpv', 'SAU-URU':'gH-md1-sau-uru',
  'ESP-SAU':'gH-md2-esp-sau', 'URU-CPV':'gH-md2-uru-cpv',
  'URU-ESP':'gH-md3-uru-esp', 'CPV-SAU':'gH-md3-cpv-sau',
  // Group I
  'FRA-SEN':'gI-md1-fra-sen', 'IRQ-NOR':'gI-md1-irq-nor',
  'FRA-IRQ':'gI-md2-fra-irq', 'NOR-SEN':'gI-md2-nor-sen',
  'NOR-FRA':'gI-md3-nor-fra', 'SEN-IRQ':'gI-md3-sen-irq',
  // Group J
  'ARG-DZA':'gJ-md1-arg-dza', 'AUT-JOR':'gJ-md1-aut-jor',
  'ARG-AUT':'gJ-md2-arg-aut', 'JOR-DZA':'gJ-md2-jor-dza',
  'DZA-AUT':'gJ-md3-dza-aut', 'JOR-ARG':'gJ-md3-jor-arg',
  // Group K
  'POR-COD':'gK-md1-por-cod', 'UZB-COL':'gK-md1-uzb-col',
  'POR-UZB':'gK-md2-por-uzb', 'COL-COD':'gK-md2-col-cod',
  'COL-POR':'gK-md3-col-por', 'COD-UZB':'gK-md3-cod-uzb',
  // Group L
  'ENG-CRO':'gL-md1-eng-cro', 'GHA-PAN':'gL-md1-gha-pan',
  'ENG-GHA':'gL-md2-eng-gha', 'PAN-CRO':'gL-md2-pan-cro',
  'PAN-ENG':'gL-md3-pan-eng', 'CRO-GHA':'gL-md3-cro-gha',
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

  // Source de secours : règle les matchs que la source principale n'a pas réglés.
  try { await settleFromBackup() } catch (e) { console.error('[backup] erreur (ignorée):', e.message) }

  console.log(`Done — ${processed} new result(s) settled.`)
}

// ─── Source de scores de secours (API-Football) — optionnelle ────────────────
// N'agit que si le secret APIFOOTBALL_KEY est défini. Règle les matchs encore
// absents de match_results et gère l'inversion domicile/extérieur (scores
// permutés si l'orientation diffère de wc2026Matches.ts).
async function settleFromBackup() {
  if (!APIFOOTBALL_KEY) return
  const { data: done } = await supabase.from('match_results').select('match_id')
  const doneIds = new Set((done ?? []).map(r => r.match_id))
  const pending = [...new Set(Object.values(MATCH_LOOKUP))].filter(id => !doneIds.has(id))
  if (pending.length === 0) return
  console.log(`[backup] ${pending.length} match(s) non réglé(s) — interrogation API-Football…`)

  const r = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026&status=FT',
    { headers: { 'x-apisports-key': APIFOOTBALL_KEY } })
  if (!r.ok) { console.warn(`[backup] API-Football HTTP ${r.status}`); return }
  const fixtures = (await r.json()).response ?? []

  let n = 0
  for (const f of fixtures) {
    const h = API_TEAM_MAP[f.teams?.home?.name]
    const a = API_TEAM_MAP[f.teams?.away?.name]
    if (!h || !a) { console.warn(`[backup] équipe inconnue: "${f.teams?.home?.name}" / "${f.teams?.away?.name}"`); continue }
    let matchId = MATCH_LOOKUP[`${h}-${a}`]
    let hs = f.goals?.home, as = f.goals?.away
    if (!matchId) { matchId = MATCH_LOOKUP[`${a}-${h}`]; if (matchId) { const t = hs; hs = as; as = t } }
    if (!matchId || doneIds.has(matchId) || hs == null || as == null) continue
    const { error } = await supabase.rpc('settle_match', { p_match_id: matchId, p_home_score: hs, p_away_score: as })
    if (error) { console.error(`[backup] settle ${matchId}:`, error.message); continue }
    doneIds.add(matchId)
    console.log(`[backup] ✓ ${matchId} réglé via secours — ${hs}:${as}`)
    n++
  }
  console.log(`[backup] ${n} match(s) réglé(s) via la source de secours.`)
}

// Ne lance le settlement que si exécuté directement (pas lors d'un import).
import { pathToFileURL } from 'node:url'
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1) })
}
