// ─── WC 2026 — Teams & Match schedule ─────────────────────────────────────
// Official draw: 5 Dec 2024, Miami.
// Times stored in UTC. Display converts to Europe/Zurich (CEST = UTC+2).
// Sources verified April 2026: FIFA.com, NBC Sports, ESPN, Fox Sports, CBS Sports.

export interface Team {
  name: string
  short: string   // 3-letter code
  code: string    // ISO for flagcdn.com
}

export type RoundKey = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | '3rd' | 'final'
export type MatchStatus = 'upcoming' | 'live' | 'completed'

export interface Match {
  id: string
  group: string
  round: RoundKey
  matchday?: 1 | 2 | 3
  home: Team
  away: Team
  date: string   // UTC date, e.g. "11 Juin"
  time: string   // UTC time, e.g. "19:00"
  venue: string
  city: string
  status: MatchStatus
  result?: { home: number; away: number }
}

// ─── Teams ────────────────────────────────────────────────────────────────────
const T: Record<string, Team> = {
  // CONMEBOL
  BRA: { name: 'Brésil',            short: 'BRA', code: 'br' },
  ARG: { name: 'Argentine',         short: 'ARG', code: 'ar' },
  COL: { name: 'Colombie',          short: 'COL', code: 'co' },
  URU: { name: 'Uruguay',           short: 'URU', code: 'uy' },
  ECU: { name: 'Équateur',          short: 'ECU', code: 'ec' },
  PAR: { name: 'Paraguay',          short: 'PAR', code: 'py' },
  // UEFA
  FRA: { name: 'France',            short: 'FRA', code: 'fr' },
  GER: { name: 'Allemagne',         short: 'GER', code: 'de' },
  ESP: { name: 'Espagne',           short: 'ESP', code: 'es' },
  ENG: { name: 'Angleterre',        short: 'ENG', code: 'gb-eng' },
  POR: { name: 'Portugal',          short: 'POR', code: 'pt' },
  NED: { name: 'Pays-Bas',          short: 'NED', code: 'nl' },
  BEL: { name: 'Belgique',          short: 'BEL', code: 'be' },
  SUI: { name: 'Suisse',            short: 'SUI', code: 'ch' },
  CRO: { name: 'Croatie',           short: 'CRO', code: 'hr' },
  AUT: { name: 'Autriche',          short: 'AUT', code: 'at' },
  NOR: { name: 'Norvège',           short: 'NOR', code: 'no' },
  SWE: { name: 'Suède',             short: 'SWE', code: 'se' },
  SCO: { name: 'Écosse',            short: 'SCO', code: 'gb-sct' },
  CZE: { name: 'Tchéquie',          short: 'CZE', code: 'cz' },
  BIH: { name: 'Bosnie-Herzégovine',short: 'BIH', code: 'ba' },
  NIR: { name: 'Irlande du Nord',   short: 'NIR', code: 'gb-nir' },
  // CONCACAF
  USA: { name: 'États-Unis',        short: 'USA', code: 'us' },
  MEX: { name: 'Mexique',           short: 'MEX', code: 'mx' },
  CAN: { name: 'Canada',            short: 'CAN', code: 'ca' },
  PAN: { name: 'Panama',            short: 'PAN', code: 'pa' },
  HAI: { name: 'Haïti',             short: 'HAI', code: 'ht' },
  CUR: { name: 'Curaçao',           short: 'CUR', code: 'cw' },
  // AFC
  JPN: { name: 'Japon',             short: 'JPN', code: 'jp' },
  KOR: { name: 'Corée du Sud',      short: 'KOR', code: 'kr' },
  IRN: { name: 'Iran',              short: 'IRN', code: 'ir' },
  AUS: { name: 'Australie',         short: 'AUS', code: 'au' },
  SAU: { name: 'Arabie Saoudite',   short: 'SAU', code: 'sa' },
  IRQ: { name: 'Irak',              short: 'IRQ', code: 'iq' },
  JOR: { name: 'Jordanie',          short: 'JOR', code: 'jo' },
  UZB: { name: 'Ouzbékistan',       short: 'UZB', code: 'uz' },
  QAT: { name: 'Qatar',             short: 'QAT', code: 'qa' },
  TUR: { name: 'Turquie',           short: 'TUR', code: 'tr' },
  // CAF
  MAR: { name: 'Maroc',             short: 'MAR', code: 'ma' },
  SEN: { name: 'Sénégal',           short: 'SEN', code: 'sn' },
  EGY: { name: 'Égypte',            short: 'EGY', code: 'eg' },
  CIV: { name: "Côte d'Ivoire",     short: 'CIV', code: 'ci' },
  ZAF: { name: 'Afrique du Sud',    short: 'ZAF', code: 'za' },
  DZA: { name: 'Algérie',           short: 'DZA', code: 'dz' },
  COD: { name: 'RD Congo',          short: 'COD', code: 'cd' },
  GHA: { name: 'Ghana',             short: 'GHA', code: 'gh' },
  TUN: { name: 'Tunisie',           short: 'TUN', code: 'tn' },
  // OFC
  NZL: { name: 'Nouvelle-Zélande',  short: 'NZL', code: 'nz' },
  // CPV
  CPV: { name: 'Cap-Vert',          short: 'CPV', code: 'cv' },
}

// ─── Groups (official draw — 5 Dec 2024) ─────────────────────────────────────
export const GROUPS: Record<string, [Team, Team, Team, Team]> = {
  A: [T.MEX, T.KOR, T.ZAF, T.CZE],
  B: [T.CAN, T.SUI, T.QAT, T.BIH],
  C: [T.BRA, T.MAR, T.SCO, T.HAI],
  D: [T.USA, T.PAR, T.AUS, T.TUR],
  E: [T.GER, T.ECU, T.CIV, T.CUR],
  F: [T.NED, T.JPN, T.SWE, T.TUN],
  G: [T.BEL, T.EGY, T.IRN, T.NZL],
  H: [T.ESP, T.URU, T.SAU, T.CPV],
  I: [T.FRA, T.SEN, T.NOR, T.IRQ],
  J: [T.ARG, T.DZA, T.AUT, T.JOR],
  K: [T.POR, T.COL, T.UZB, T.COD],
  L: [T.ENG, T.CRO, T.PAN, T.GHA],
}

// ─── Group stage — 72 matches (hardcoded, verified against official schedule) ─
export const GROUP_MATCHES: Match[] = [

  // ── GROUP A ─────────────────────────────────────────────────────────────────
  // MD1 — 11 juin 3pm ET / 11 jun 10pm ET
  { id:'gA-md1-mex-zaf', group:'A', round:'group', matchday:1, home:T.MEX, away:T.ZAF,
    date:'11 Juin', time:'19:00', venue:'Estadio Azteca',        city:'Mexico City', status:'upcoming' },
  { id:'gA-md1-kor-cze', group:'A', round:'group', matchday:1, home:T.KOR, away:T.CZE,
    date:'12 Juin', time:'02:00', venue:'Estadio Akron',         city:'Guadalajara',  status:'upcoming' },
  // MD2 — 18 juin 12pm ET / 18 jun 9pm ET
  { id:'gA-md2-cze-zaf', group:'A', round:'group', matchday:2, home:T.CZE, away:T.ZAF,
    date:'18 Juin', time:'16:00', venue:'Mercedes-Benz Stadium', city:'Atlanta',      status:'upcoming' },
  { id:'gA-md2-mex-kor', group:'A', round:'group', matchday:2, home:T.MEX, away:T.KOR,
    date:'19 Juin', time:'01:00', venue:'Estadio Akron',         city:'Guadalajara',  status:'upcoming' },
  // MD3 — 24 jun 9pm ET (simultaneous)
  { id:'gA-md3-cze-mex', group:'A', round:'group', matchday:3, home:T.CZE, away:T.MEX,
    date:'25 Juin', time:'01:00', venue:'Estadio Azteca',        city:'Mexico City', status:'upcoming' },
  { id:'gA-md3-zaf-kor', group:'A', round:'group', matchday:3, home:T.ZAF, away:T.KOR,
    date:'25 Juin', time:'01:00', venue:'Estadio BBVA',          city:'Monterrey',   status:'upcoming' },

  // ── GROUP B ─────────────────────────────────────────────────────────────────
  { id:'gB-md1-can-bih', group:'B', round:'group', matchday:1, home:T.CAN, away:T.BIH,
    date:'12 Juin', time:'19:00', venue:'BMO Field',             city:'Toronto',     status:'upcoming' },
  { id:'gB-md1-qat-sui', group:'B', round:'group', matchday:1, home:T.QAT, away:T.SUI,
    date:'13 Juin', time:'19:00', venue:"Levi's Stadium",        city:'San Francisco',status:'upcoming' },
  { id:'gB-md2-sui-bih', group:'B', round:'group', matchday:2, home:T.SUI, away:T.BIH,
    date:'18 Juin', time:'19:00', venue:'SoFi Stadium',          city:'Los Angeles', status:'upcoming' },
  { id:'gB-md2-can-qat', group:'B', round:'group', matchday:2, home:T.CAN, away:T.QAT,
    date:'18 Juin', time:'22:00', venue:'BC Place',              city:'Vancouver',   status:'upcoming' },
  { id:'gB-md3-sui-can', group:'B', round:'group', matchday:3, home:T.SUI, away:T.CAN,
    date:'24 Juin', time:'19:00', venue:'BC Place',              city:'Vancouver',   status:'upcoming' },
  { id:'gB-md3-bih-qat', group:'B', round:'group', matchday:3, home:T.BIH, away:T.QAT,
    date:'24 Juin', time:'19:00', venue:'Lumen Field',           city:'Seattle',     status:'upcoming' },

  // ── GROUP C ─────────────────────────────────────────────────────────────────
  { id:'gC-md1-bra-mar', group:'C', round:'group', matchday:1, home:T.BRA, away:T.MAR,
    date:'13 Juin', time:'22:00', venue:'MetLife Stadium',       city:'New York',    status:'upcoming' },
  { id:'gC-md1-hai-sco', group:'C', round:'group', matchday:1, home:T.HAI, away:T.SCO,
    date:'14 Juin', time:'01:00', venue:'Gillette Stadium',      city:'Boston',      status:'upcoming' },
  { id:'gC-md2-sco-mar', group:'C', round:'group', matchday:2, home:T.SCO, away:T.MAR,
    date:'19 Juin', time:'22:00', venue:'Gillette Stadium',      city:'Boston',      status:'upcoming' },
  { id:'gC-md2-bra-hai', group:'C', round:'group', matchday:2, home:T.BRA, away:T.HAI,
    date:'20 Juin', time:'00:30', venue:'Lincoln Financial Field',city:'Philadelphie',status:'upcoming' },
  { id:'gC-md3-sco-bra', group:'C', round:'group', matchday:3, home:T.SCO, away:T.BRA,
    date:'24 Juin', time:'22:00', venue:'Hard Rock Stadium',     city:'Miami',       status:'upcoming' },
  { id:'gC-md3-mar-hai', group:'C', round:'group', matchday:3, home:T.MAR, away:T.HAI,
    date:'24 Juin', time:'22:00', venue:'Mercedes-Benz Stadium', city:'Atlanta',     status:'upcoming' },

  // ── GROUP D ─────────────────────────────────────────────────────────────────
  { id:'gD-md1-usa-par', group:'D', round:'group', matchday:1, home:T.USA, away:T.PAR,
    date:'13 Juin', time:'01:00', venue:'SoFi Stadium',          city:'Los Angeles', status:'upcoming' },
  { id:'gD-md1-aus-tur', group:'D', round:'group', matchday:1, home:T.AUS, away:T.TUR,
    date:'14 Juin', time:'04:00', venue:'BC Place',              city:'Vancouver',   status:'upcoming' },
  { id:'gD-md2-usa-aus', group:'D', round:'group', matchday:2, home:T.USA, away:T.AUS,
    date:'19 Juin', time:'19:00', venue:'Lumen Field',           city:'Seattle',     status:'upcoming' },
  { id:'gD-md2-tur-par', group:'D', round:'group', matchday:2, home:T.TUR, away:T.PAR,
    date:'20 Juin', time:'03:00', venue:"Levi's Stadium",        city:'San Francisco',status:'upcoming' },
  { id:'gD-md3-tur-usa', group:'D', round:'group', matchday:3, home:T.TUR, away:T.USA,
    date:'26 Juin', time:'02:00', venue:'SoFi Stadium',          city:'Los Angeles', status:'upcoming' },
  { id:'gD-md3-par-aus', group:'D', round:'group', matchday:3, home:T.PAR, away:T.AUS,
    date:'26 Juin', time:'02:00', venue:"Levi's Stadium",        city:'San Francisco',status:'upcoming' },

  // ── GROUP E ─────────────────────────────────────────────────────────────────
  { id:'gE-md1-ger-cur', group:'E', round:'group', matchday:1, home:T.GER, away:T.CUR,
    date:'14 Juin', time:'17:00', venue:'NRG Stadium',           city:'Houston',     status:'upcoming' },
  { id:'gE-md1-civ-ecu', group:'E', round:'group', matchday:1, home:T.CIV, away:T.ECU,
    date:'14 Juin', time:'23:00', venue:'Lincoln Financial Field',city:'Philadelphie',status:'upcoming' },
  { id:'gE-md2-ger-civ', group:'E', round:'group', matchday:2, home:T.GER, away:T.CIV,
    date:'20 Juin', time:'20:00', venue:'BMO Field',             city:'Toronto',     status:'upcoming' },
  { id:'gE-md2-ecu-cur', group:'E', round:'group', matchday:2, home:T.ECU, away:T.CUR,
    date:'21 Juin', time:'00:00', venue:'Arrowhead Stadium',     city:'Kansas City', status:'upcoming' },
  { id:'gE-md3-cur-civ', group:'E', round:'group', matchday:3, home:T.CUR, away:T.CIV,
    date:'25 Juin', time:'20:00', venue:'Lincoln Financial Field',city:'Philadelphie',status:'upcoming' },
  { id:'gE-md3-ecu-ger', group:'E', round:'group', matchday:3, home:T.ECU, away:T.GER,
    date:'25 Juin', time:'20:00', venue:'MetLife Stadium',       city:'New York',    status:'upcoming' },

  // ── GROUP F ─────────────────────────────────────────────────────────────────
  { id:'gF-md1-ned-jpn', group:'F', round:'group', matchday:1, home:T.NED, away:T.JPN,
    date:'14 Juin', time:'20:00', venue:'AT&T Stadium',          city:'Dallas',      status:'upcoming' },
  { id:'gF-md1-swe-tun', group:'F', round:'group', matchday:1, home:T.SWE, away:T.TUN,
    date:'15 Juin', time:'02:00', venue:'Estadio BBVA',          city:'Monterrey',   status:'upcoming' },
  { id:'gF-md2-tun-jpn', group:'F', round:'group', matchday:2, home:T.TUN, away:T.JPN,
    date:'21 Juin', time:'04:00', venue:'Estadio BBVA',          city:'Monterrey',   status:'upcoming' },
  { id:'gF-md2-ned-swe', group:'F', round:'group', matchday:2, home:T.NED, away:T.SWE,
    date:'20 Juin', time:'17:00', venue:'NRG Stadium',           city:'Houston',     status:'upcoming' },
  { id:'gF-md3-jpn-swe', group:'F', round:'group', matchday:3, home:T.JPN, away:T.SWE,
    date:'25 Juin', time:'23:00', venue:'AT&T Stadium',          city:'Dallas',      status:'upcoming' },
  { id:'gF-md3-tun-ned', group:'F', round:'group', matchday:3, home:T.TUN, away:T.NED,
    date:'25 Juin', time:'23:00', venue:'Arrowhead Stadium',     city:'Kansas City', status:'upcoming' },

  // ── GROUP G ─────────────────────────────────────────────────────────────────
  { id:'gG-md1-bel-egy', group:'G', round:'group', matchday:1, home:T.BEL, away:T.EGY,
    date:'15 Juin', time:'19:00', venue:'Lumen Field',           city:'Seattle',     status:'upcoming' },
  { id:'gG-md1-irn-nzl', group:'G', round:'group', matchday:1, home:T.IRN, away:T.NZL,
    date:'16 Juin', time:'01:00', venue:'SoFi Stadium',          city:'Los Angeles', status:'upcoming' },
  { id:'gG-md2-bel-irn', group:'G', round:'group', matchday:2, home:T.BEL, away:T.IRN,
    date:'21 Juin', time:'19:00', venue:'SoFi Stadium',          city:'Los Angeles', status:'upcoming' },
  { id:'gG-md2-nzl-egy', group:'G', round:'group', matchday:2, home:T.NZL, away:T.EGY,
    date:'22 Juin', time:'01:00', venue:'BC Place',              city:'Vancouver',   status:'upcoming' },
  { id:'gG-md3-egy-irn', group:'G', round:'group', matchday:3, home:T.EGY, away:T.IRN,
    date:'27 Juin', time:'03:00', venue:'Lumen Field',           city:'Seattle',     status:'upcoming' },
  { id:'gG-md3-nzl-bel', group:'G', round:'group', matchday:3, home:T.NZL, away:T.BEL,
    date:'27 Juin', time:'03:00', venue:'BC Place',              city:'Vancouver',   status:'upcoming' },

  // ── GROUP H ─────────────────────────────────────────────────────────────────
  { id:'gH-md1-esp-cpv', group:'H', round:'group', matchday:1, home:T.ESP, away:T.CPV,
    date:'15 Juin', time:'16:00', venue:'Mercedes-Benz Stadium', city:'Atlanta',     status:'upcoming' },
  { id:'gH-md1-sau-uru', group:'H', round:'group', matchday:1, home:T.SAU, away:T.URU,
    date:'15 Juin', time:'22:00', venue:'Hard Rock Stadium',     city:'Miami',       status:'upcoming' },
  { id:'gH-md2-esp-sau', group:'H', round:'group', matchday:2, home:T.ESP, away:T.SAU,
    date:'21 Juin', time:'16:00', venue:'Mercedes-Benz Stadium', city:'Atlanta',     status:'upcoming' },
  { id:'gH-md2-uru-cpv', group:'H', round:'group', matchday:2, home:T.URU, away:T.CPV,
    date:'21 Juin', time:'22:00', venue:'Hard Rock Stadium',     city:'Miami',       status:'upcoming' },
  { id:'gH-md3-uru-esp', group:'H', round:'group', matchday:3, home:T.URU, away:T.ESP,
    date:'27 Juin', time:'00:00', venue:'Estadio Akron',         city:'Guadalajara', status:'upcoming' },
  { id:'gH-md3-cpv-sau', group:'H', round:'group', matchday:3, home:T.CPV, away:T.SAU,
    date:'27 Juin', time:'00:00', venue:'NRG Stadium',           city:'Houston',     status:'upcoming' },

  // ── GROUP I ─────────────────────────────────────────────────────────────────
  { id:'gI-md1-fra-sen', group:'I', round:'group', matchday:1, home:T.FRA, away:T.SEN,
    date:'16 Juin', time:'19:00', venue:'MetLife Stadium',       city:'New York',    status:'upcoming' },
  { id:'gI-md1-irq-nor', group:'I', round:'group', matchday:1, home:T.IRQ, away:T.NOR,
    date:'16 Juin', time:'22:00', venue:'Gillette Stadium',      city:'Boston',      status:'upcoming' },
  { id:'gI-md2-fra-irq', group:'I', round:'group', matchday:2, home:T.FRA, away:T.IRQ,
    date:'22 Juin', time:'21:00', venue:'Lincoln Financial Field',city:'Philadelphie',status:'upcoming' },
  { id:'gI-md2-nor-sen', group:'I', round:'group', matchday:2, home:T.NOR, away:T.SEN,
    date:'23 Juin', time:'00:00', venue:'MetLife Stadium',       city:'New York',    status:'upcoming' },
  { id:'gI-md3-nor-fra', group:'I', round:'group', matchday:3, home:T.NOR, away:T.FRA,
    date:'26 Juin', time:'19:00', venue:'Gillette Stadium',      city:'Boston',      status:'upcoming' },
  { id:'gI-md3-sen-irq', group:'I', round:'group', matchday:3, home:T.SEN, away:T.IRQ,
    date:'26 Juin', time:'19:00', venue:'BMO Field',             city:'Toronto',     status:'upcoming' },

  // ── GROUP J ─────────────────────────────────────────────────────────────────
  { id:'gJ-md1-arg-dza', group:'J', round:'group', matchday:1, home:T.ARG, away:T.DZA,
    date:'17 Juin', time:'01:00', venue:'Arrowhead Stadium',     city:'Kansas City', status:'upcoming' },
  { id:'gJ-md1-aut-jor', group:'J', round:'group', matchday:1, home:T.AUT, away:T.JOR,
    date:'17 Juin', time:'04:00', venue:"Levi's Stadium",        city:'San Francisco',status:'upcoming' },
  { id:'gJ-md2-arg-aut', group:'J', round:'group', matchday:2, home:T.ARG, away:T.AUT,
    date:'22 Juin', time:'17:00', venue:'AT&T Stadium',          city:'Dallas',      status:'upcoming' },
  { id:'gJ-md2-jor-dza', group:'J', round:'group', matchday:2, home:T.JOR, away:T.DZA,
    date:'23 Juin', time:'03:00', venue:"Levi's Stadium",        city:'San Francisco',status:'upcoming' },
  { id:'gJ-md3-dza-aut', group:'J', round:'group', matchday:3, home:T.DZA, away:T.AUT,
    date:'28 Juin', time:'02:00', venue:'Arrowhead Stadium',     city:'Kansas City', status:'upcoming' },
  { id:'gJ-md3-jor-arg', group:'J', round:'group', matchday:3, home:T.JOR, away:T.ARG,
    date:'28 Juin', time:'02:00', venue:'AT&T Stadium',          city:'Dallas',      status:'upcoming' },

  // ── GROUP K ─────────────────────────────────────────────────────────────────
  { id:'gK-md1-por-cod', group:'K', round:'group', matchday:1, home:T.POR, away:T.COD,
    date:'17 Juin', time:'17:00', venue:'NRG Stadium',           city:'Houston',     status:'upcoming' },
  { id:'gK-md1-uzb-col', group:'K', round:'group', matchday:1, home:T.UZB, away:T.COL,
    date:'18 Juin', time:'02:00', venue:'Estadio Azteca',        city:'Mexico City', status:'upcoming' },
  { id:'gK-md2-por-uzb', group:'K', round:'group', matchday:2, home:T.POR, away:T.UZB,
    date:'23 Juin', time:'17:00', venue:'NRG Stadium',           city:'Houston',     status:'upcoming' },
  { id:'gK-md2-col-cod', group:'K', round:'group', matchday:2, home:T.COL, away:T.COD,
    date:'24 Juin', time:'02:00', venue:'Estadio Akron',         city:'Guadalajara', status:'upcoming' },
  { id:'gK-md3-col-por', group:'K', round:'group', matchday:3, home:T.COL, away:T.POR,
    date:'27 Juin', time:'23:30', venue:'Hard Rock Stadium',     city:'Miami',       status:'upcoming' },
  { id:'gK-md3-cod-uzb', group:'K', round:'group', matchday:3, home:T.COD, away:T.UZB,
    date:'27 Juin', time:'23:30', venue:'Mercedes-Benz Stadium', city:'Atlanta',     status:'upcoming' },

  // ── GROUP L ─────────────────────────────────────────────────────────────────
  { id:'gL-md1-eng-cro', group:'L', round:'group', matchday:1, home:T.ENG, away:T.CRO,
    date:'17 Juin', time:'20:00', venue:'AT&T Stadium',          city:'Dallas',      status:'upcoming' },
  { id:'gL-md1-gha-pan', group:'L', round:'group', matchday:1, home:T.GHA, away:T.PAN,
    date:'17 Juin', time:'23:00', venue:'BMO Field',             city:'Toronto',     status:'upcoming' },
  { id:'gL-md2-eng-gha', group:'L', round:'group', matchday:2, home:T.ENG, away:T.GHA,
    date:'23 Juin', time:'20:00', venue:'Gillette Stadium',      city:'Boston',      status:'upcoming' },
  { id:'gL-md2-pan-cro', group:'L', round:'group', matchday:2, home:T.PAN, away:T.CRO,
    date:'23 Juin', time:'23:00', venue:'BMO Field',             city:'Toronto',     status:'upcoming' },
  { id:'gL-md3-pan-eng', group:'L', round:'group', matchday:3, home:T.PAN, away:T.ENG,
    date:'27 Juin', time:'21:00', venue:'MetLife Stadium',       city:'New York',    status:'upcoming' },
  { id:'gL-md3-cro-gha', group:'L', round:'group', matchday:3, home:T.CRO, away:T.GHA,
    date:'27 Juin', time:'21:00', venue:'Lincoln Financial Field',city:'Philadelphie',status:'upcoming' },
]

// ─── Knockout stage ───────────────────────────────────────────────────────────
const TBD: Team = { name: 'À déterminer', short: 'TBD', code: 'un' }

export const KNOCKOUT_MATCHES: Match[] = [
  // Round of 32 — 16 matches (28 juin – 3 juil)
  { id:'r32-1',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'28 Juin', time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-2',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'28 Juin', time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-3',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'29 Juin', time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-4',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'29 Juin', time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-5',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'30 Juin', time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-6',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'30 Juin', time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-7',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'1 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-8',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'1 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-9',  group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'2 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-10', group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'2 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-11', group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'3 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-12', group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'3 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-13', group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'4 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-14', group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'4 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-15', group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'5 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r32-16', group:'Tour 32', round:'r32', home:TBD, away:TBD, date:'5 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },

  // Round of 16 — 8 matches (6 – 9 juil)
  { id:'r16-1', group:'8èmes', round:'r16', home:TBD, away:TBD, date:'6 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r16-2', group:'8èmes', round:'r16', home:TBD, away:TBD, date:'6 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r16-3', group:'8èmes', round:'r16', home:TBD, away:TBD, date:'7 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r16-4', group:'8èmes', round:'r16', home:TBD, away:TBD, date:'7 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r16-5', group:'8èmes', round:'r16', home:TBD, away:TBD, date:'8 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r16-6', group:'8èmes', round:'r16', home:TBD, away:TBD, date:'8 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r16-7', group:'8èmes', round:'r16', home:TBD, away:TBD, date:'9 Juil',  time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'r16-8', group:'8èmes', round:'r16', home:TBD, away:TBD, date:'9 Juil',  time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },

  // Quarterfinals — 4 matches (11 – 12 juil)
  { id:'qf-1', group:'Quarts', round:'qf', home:TBD, away:TBD, date:'11 Juil', time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'qf-2', group:'Quarts', round:'qf', home:TBD, away:TBD, date:'11 Juil', time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'qf-3', group:'Quarts', round:'qf', home:TBD, away:TBD, date:'12 Juil', time:'19:00', venue:'À confirmer', city:'—', status:'upcoming' },
  { id:'qf-4', group:'Quarts', round:'qf', home:TBD, away:TBD, date:'12 Juil', time:'22:00', venue:'À confirmer', city:'—', status:'upcoming' },

  // Semifinals — 2 matches (14 – 15 juil)
  { id:'sf-1', group:'Demi-finales', round:'sf', home:TBD, away:TBD,
    date:'15 Juil', time:'00:00', venue:'MetLife Stadium', city:'New York', status:'upcoming' },
  { id:'sf-2', group:'Demi-finales', round:'sf', home:TBD, away:TBD,
    date:'16 Juil', time:'00:00', venue:'AT&T Stadium',    city:'Dallas',   status:'upcoming' },

  // 3rd place (18 juil) + Final (19 juil)
  { id:'3rd', group:'3e place', round:'3rd', home:TBD, away:TBD,
    date:'18 Juil', time:'22:00', venue:'Hard Rock Stadium', city:'Miami',    status:'upcoming' },
  { id:'final', group:'Finale', round:'final', home:TBD, away:TBD,
    date:'19 Juil', time:'20:00', venue:'MetLife Stadium',   city:'New York', status:'upcoming' },
]

export const ALL_MATCHES = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

// ─── Équipes : helpers pour l'éditeur de bracket admin + fusion des qualifiés ──
export const TBD_TEAM = TBD
// Toutes les sélections (hors TBD), triées par nom français pour les listes déroulantes.
export const ALL_TEAMS: Team[] = Object.values(T).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
const TEAM_BY_SHORT: Record<string, Team> = {}
for (const t of Object.values(T)) TEAM_BY_SHORT[t.short] = t
/** Équipe à partir de son code court (ex. 'BRA'), ou null. */
export function teamByShort(short?: string | null): Team | null {
  if (!short) return null
  return TEAM_BY_SHORT[short.toUpperCase()] ?? null
}

export type KnockoutAssign = Record<string, { home_short?: string | null; away_short?: string | null }>
/**
 * Applique des affectations { match_id → {home_short, away_short} } aux matchs à
 * élimination directe : remplace les équipes TBD par les vraies quand elles sont connues.
 * Pur (ne mute pas KNOCKOUT_MATCHES) — renvoie une nouvelle liste.
 */
export function knockoutWithTeams(assign: KnockoutAssign): Match[] {
  return KNOCKOUT_MATCHES.map(m => {
    const a = assign[m.id]
    if (!a) return m
    const home = teamByShort(a.home_short) ?? m.home
    const away = teamByShort(a.away_short) ?? m.away
    if (home === m.home && away === m.away) return m
    return { ...m, home, away }
  })
}

// ─── Helpers temps ──────────────────────────────────────────────────────────
const FR_MONTHS_MAP: Record<string, number> = {
  Jan: 0, Fév: 1, Mar: 2, Avr: 3, Mai: 4, Juin: 5,
  Juil: 6, Aoû: 7, Sep: 8, Oct: 9, Nov: 10, Déc: 11,
}

/** Coup d'envoi d'un match en ms UTC (les dates sont stockées en UTC). */
export function matchKickoffUTC(m: Match): number | null {
  const parts = m.date.split(' ')
  const day = parseInt(parts[0], 10)
  const mon = FR_MONTHS_MAP[parts[1]?.slice(0, 4)] ?? FR_MONTHS_MAP[parts[1]?.slice(0, 3)] ?? -1
  if (isNaN(day) || mon < 0) return null
  const [hh, mm] = m.time.split(':').map(Number)
  return Date.UTC(2026, mon, day, hh, mm, 0)
}

// ─── Couleur "nationale" (drapeau) par sélection ────────────────────────────
const NATION_COLOR: Record<string, string> = {
  FRA: '#0055A4', NIR: '#00843D', ENG: '#CE1124', SCO: '#0065BF', ESP: '#C60B1E',
  BRA: '#009B3A', ARG: '#75AADB', GER: '#000000', DEU: '#111111', POR: '#DA291C',
  NED: '#FF6A00', BEL: '#FDDA24', CRO: '#0093DD', ITA: '#0066B2', USA: '#3C3B6E',
  MEX: '#006847', CAN: '#FF0000', JPN: '#BC002D', KOR: '#003478', AUS: '#FFCD00',
  MAR: '#C1272D', SEN: '#00853F', CIV: '#FF8200', EGY: '#CE1126', RSA: '#007A4D',
  ZAF: '#007A4D', NOR: '#BA0C2F', SWE: '#FECC00', SUI: '#FF0000', CHE: '#FF0000',
  AUT: '#ED2939', TUR: '#E30A17', NZL: '#00247D', URU: '#7B9FD4', COL: '#FCD116',
  ECU: '#FFD100', PAR: '#D52B1E', IRN: '#239F40', KSA: '#006C35', QAT: '#8A1538',
  JOR: '#007A3D', IRQ: '#007A3B', UZB: '#1EB53A', PAN: '#005293', HAI: '#00209F',
  CUW: '#002B7F', TUN: '#E70013', ALG: '#006233', DZA: '#006233', GHA: '#006B3F',
  COD: '#007FFF', CPV: '#003893', CZE: '#11457E', BIH: '#002395',
}
export function teamColor(team: Team): string {
  return NATION_COLOR[team.short] ?? '#C89B3C'
}

/** Matchs dont le coup d'envoi tombe aujourd'hui (calendrier Europe/Zurich). */
export function todaysMatches(now: number = Date.now()): Match[] {
  const dayStr = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' })
  const today = dayStr(now)
  return ALL_MATCHES.filter(m => {
    if (m.home.code === 'un' || m.away.code === 'un') return false   // équipes à déterminer
    const k = matchKickoffUTC(m)
    return k !== null && dayStr(k) === today
  })
}
