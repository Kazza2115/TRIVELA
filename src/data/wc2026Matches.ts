// ─── WC 2026 — Teams & Match schedule ─────────────────────────────────────
// Groups are indicative; official draw results will replace these values.

export interface Team {
  name: string
  short: string   // 3-letter abbreviation
  code: string    // ISO code for flagcdn.com
}

export type RoundKey = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final'
export type MatchStatus = 'upcoming' | 'live' | 'completed'

export interface Match {
  id: string
  group: string      // 'A'..'L' for group stage; round name for knockout
  round: RoundKey
  matchday?: 1 | 2 | 3
  home: Team
  away: Team
  date: string       // e.g. "12 Juin"
  time: string       // e.g. "21:00"
  venue: string
  city: string
  status: MatchStatus
  result?: { home: number; away: number }
}

// ─── Team registry ────────────────────────────────────────────────────────
const T: Record<string, Team> = {
  // CONMEBOL
  BRA: { name: 'Brésil',       short: 'BRA', code: 'br' },
  ARG: { name: 'Argentine',    short: 'ARG', code: 'ar' },
  COL: { name: 'Colombie',     short: 'COL', code: 'co' },
  URU: { name: 'Uruguay',      short: 'URU', code: 'uy' },
  ECU: { name: 'Équateur',     short: 'ECU', code: 'ec' },
  VEN: { name: 'Venezuela',    short: 'VEN', code: 've' },
  // UEFA
  FRA: { name: 'France',       short: 'FRA', code: 'fr' },
  GER: { name: 'Allemagne',    short: 'GER', code: 'de' },
  ESP: { name: 'Espagne',      short: 'ESP', code: 'es' },
  ENG: { name: 'Angleterre',   short: 'ENG', code: 'gb-eng' },
  POR: { name: 'Portugal',     short: 'POR', code: 'pt' },
  NED: { name: 'Pays-Bas',     short: 'NED', code: 'nl' },
  ITA: { name: 'Italie',       short: 'ITA', code: 'it' },
  BEL: { name: 'Belgique',     short: 'BEL', code: 'be' },
  SUI: { name: 'Suisse',       short: 'SUI', code: 'ch' },
  CRO: { name: 'Croatie',      short: 'CRO', code: 'hr' },
  DEN: { name: 'Danemark',     short: 'DEN', code: 'dk' },
  AUT: { name: 'Autriche',     short: 'AUT', code: 'at' },
  SRB: { name: 'Serbie',       short: 'SRB', code: 'rs' },
  TUR: { name: 'Turquie',      short: 'TUR', code: 'tr' },
  SCO: { name: 'Écosse',       short: 'SCO', code: 'gb-sct' },
  UKR: { name: 'Ukraine',      short: 'UKR', code: 'ua' },
  // CONCACAF
  USA: { name: 'États-Unis',   short: 'USA', code: 'us' },
  MEX: { name: 'Mexique',      short: 'MEX', code: 'mx' },
  CAN: { name: 'Canada',       short: 'CAN', code: 'ca' },
  PAN: { name: 'Panama',       short: 'PAN', code: 'pa' },
  CRC: { name: 'Costa Rica',   short: 'CRC', code: 'cr' },
  JAM: { name: 'Jamaïque',     short: 'JAM', code: 'jm' },
  HON: { name: 'Honduras',     short: 'HON', code: 'hn' },
  // AFC
  JPN: { name: 'Japon',        short: 'JPN', code: 'jp' },
  KOR: { name: 'Corée du Sud', short: 'KOR', code: 'kr' },
  IRN: { name: 'Iran',         short: 'IRN', code: 'ir' },
  AUS: { name: 'Australie',    short: 'AUS', code: 'au' },
  SAU: { name: 'Arabie Saoudite', short: 'SAU', code: 'sa' },
  IRQ: { name: 'Irak',         short: 'IRQ', code: 'iq' },
  JOR: { name: 'Jordanie',     short: 'JOR', code: 'jo' },
  UZB: { name: 'Ouzbékistan',  short: 'UZB', code: 'uz' },
  QAT: { name: 'Qatar',        short: 'QAT', code: 'qa' },
  // CAF
  MAR: { name: 'Maroc',        short: 'MAR', code: 'ma' },
  SEN: { name: 'Sénégal',      short: 'SEN', code: 'sn' },
  EGY: { name: 'Égypte',       short: 'EGY', code: 'eg' },
  NGA: { name: 'Nigeria',      short: 'NGA', code: 'ng' },
  CIV: { name: "Côte d'Ivoire", short: 'CIV', code: 'ci' },
  ZAF: { name: 'Afrique du Sud', short: 'ZAF', code: 'za' },
  CMR: { name: 'Cameroun',     short: 'CMR', code: 'cm' },
  DZA: { name: 'Algérie',      short: 'DZA', code: 'dz' },
  COD: { name: 'RD Congo',     short: 'COD', code: 'cd' },
  // OFC
  NZL: { name: 'Nouvelle-Zélande', short: 'NZL', code: 'nz' },
}

// ─── Groups ────────────────────────────────────────────────────────────────
export const GROUPS: Record<string, [Team, Team, Team, Team]> = {
  A: [T.BRA, T.SUI, T.CIV, T.JOR],
  B: [T.FRA, T.CRO, T.NGA, T.AUS],
  C: [T.GER, T.MEX, T.ZAF, T.UZB],
  D: [T.ESP, T.JPN, T.EGY, T.HON],
  E: [T.ENG, T.COL, T.IRN, T.NZL],
  F: [T.POR, T.NED, T.SEN, T.QAT],
  G: [T.ARG, T.BEL, T.CMR, T.CRC],
  H: [T.ITA, T.USA, T.COD, T.ECU],
  I: [T.SRB, T.DEN, T.SAU, T.JAM],
  J: [T.AUT, T.TUR, T.DZA, T.PAN],
  K: [T.KOR, T.SCO, T.URU, T.VEN],
  L: [T.CAN, T.UKR, T.MAR, T.IRQ],
}

// ─── Build group-stage matches ─────────────────────────────────────────────
// Matchday 1: 1v2, 3v4 | Matchday 2: 1v3, 2v4 | Matchday 3: 1v4, 2v3
const MD_MATCHUPS: Array<[[number, number], [number, number]]> = [
  [[0, 1], [2, 3]],   // MD1
  [[0, 2], [1, 3]],   // MD2
  [[0, 3], [1, 2]],   // MD3
]

// Approximate dates: MD1 Jun 12-15, MD2 Jun 18-22, MD3 Jun 26-28
const DATE_OFFSETS: Record<number, string[]> = {
  1: ['12 Juin','12 Juin','13 Juin','13 Juin','14 Juin','14 Juin',
      '15 Juin','15 Juin','15 Juin','15 Juin','16 Juin','16 Juin'],
  2: ['18 Juin','18 Juin','19 Juin','19 Juin','20 Juin','20 Juin',
      '21 Juin','21 Juin','21 Juin','21 Juin','22 Juin','22 Juin'],
  3: ['26 Juin','26 Juin','26 Juin','26 Juin','27 Juin','27 Juin',
      '27 Juin','27 Juin','28 Juin','28 Juin','28 Juin','28 Juin'],
}

const VENUES = [
  { venue: 'MetLife Stadium',       city: 'New York'      },
  { venue: 'SoFi Stadium',          city: 'Los Angeles'   },
  { venue: 'AT&T Stadium',          city: 'Dallas'        },
  { venue: "Levi's Stadium",        city: 'San Francisco' },
  { venue: 'Arrowhead Stadium',     city: 'Kansas City'   },
  { venue: 'Mercedes-Benz Stadium', city: 'Atlanta'       },
  { venue: 'Hard Rock Stadium',     city: 'Miami'         },
  { venue: 'Gillette Stadium',      city: 'Boston'        },
  { venue: 'Lumen Field',           city: 'Seattle'       },
  { venue: 'BC Place',              city: 'Vancouver'     },
  { venue: 'Estadio Azteca',        city: 'Mexico City'   },
  { venue: 'Estadio BBVA',          city: 'Monterrey'     },
]

function buildGroupMatches(): Match[] {
  const matches: Match[] = []
  const groupKeys = Object.keys(GROUPS)   // A..L (12 groups)

  groupKeys.forEach((g, gi) => {
    const teams = GROUPS[g]
    MD_MATCHUPS.forEach((matchups, mdIdx) => {
      const md = (mdIdx + 1) as 1 | 2 | 3
      matchups.forEach(([hi, ai], pairIdx) => {
        const slot = gi  // 0..11
        const dateStr = DATE_OFFSETS[md][slot]
        const venue   = VENUES[slot % VENUES.length]
        const time    = pairIdx === 0 ? '18:00' : '21:00'
        matches.push({
          id: `g${g}-md${md}-${hi}v${ai}`,
          group: g,
          round: 'group',
          matchday: md,
          home: teams[hi],
          away: teams[ai],
          date: dateStr,
          time,
          ...venue,
          status: 'upcoming',
        })
      })
    })
  })

  return matches
}

// ─── Knockout skeleton (teams TBD) ────────────────────────────────────────
const TBD: Team = { name: 'À déterminer', short: 'TBD', code: 'un' }

function buildKnockoutMatches(): Match[] {
  const ko: Match[] = []

  // Round of 32 — 16 matches  (2 Jul – 4 Jul)
  for (let i = 1; i <= 16; i++) {
    ko.push({
      id: `r32-${i}`, group: 'Huitièmes', round: 'r32',
      home: TBD, away: TBD,
      date: i <= 8 ? '2 Juil' : '3 Juil', time: i % 2 === 0 ? '21:00' : '18:00',
      venue: 'À confirmer', city: '—',
      status: 'upcoming',
    })
  }

  // Round of 16 — 8 matches  (6 Jul – 8 Jul)
  for (let i = 1; i <= 8; i++) {
    ko.push({
      id: `r16-${i}`, group: 'Quarts', round: 'r16',
      home: TBD, away: TBD,
      date: i <= 4 ? '6 Juil' : '7 Juil', time: i % 2 === 0 ? '21:00' : '18:00',
      venue: 'À confirmer', city: '—',
      status: 'upcoming',
    })
  }

  // QF — 4 matches (10 Jul)
  for (let i = 1; i <= 4; i++) {
    ko.push({
      id: `qf-${i}`, group: 'Demi-finales', round: 'qf',
      home: TBD, away: TBD,
      date: '10 Juil', time: i % 2 === 0 ? '21:00' : '18:00',
      venue: 'À confirmer', city: '—',
      status: 'upcoming',
    })
  }

  // SF — 2 matches (14 Jul)
  for (let i = 1; i <= 2; i++) {
    ko.push({
      id: `sf-${i}`, group: 'Demi-finales', round: 'sf',
      home: TBD, away: TBD,
      date: '14 Juil', time: i === 1 ? '18:00' : '21:00',
      venue: 'MetLife Stadium', city: 'New York',
      status: 'upcoming',
    })
  }

  // 3rd place (17 Jul) + Final (19 Jul)
  ko.push({
    id: '3rd', group: '3e place', round: '3rd',
    home: TBD, away: TBD,
    date: '17 Juil', time: '21:00',
    venue: 'Hard Rock Stadium', city: 'Miami',
    status: 'upcoming',
  })
  ko.push({
    id: 'final', group: 'Finale', round: 'final',
    home: TBD, away: TBD,
    date: '19 Juil', time: '21:00',
    venue: 'MetLife Stadium', city: 'New York',
    status: 'upcoming',
  })

  return ko
}

// ─── Exported match list ───────────────────────────────────────────────────
export const GROUP_MATCHES   = buildGroupMatches()
export const KNOCKOUT_MATCHES = buildKnockoutMatches()
export const ALL_MATCHES     = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]
