import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import CountryPopup from './CountryPopup'
import Fireworks from './Fireworks'
import { matchKickoffUTC, teamColor, teamByShort, KNOCKOUT_MATCHES } from '../data/wc2026Matches'
import type { Match, Team } from '../data/wc2026Matches'
import { getBets, getLive, getResults, subscribeToLive, getKnockoutTeams, getWorldChampion } from '../services/auth'
import type { UserProfile } from '../services/auth'
import { COMPETITIONS } from '../data/continentStats'

// ─── Featured countries — vivid national flag colours ─────────────────────
// svgFill overrides the SVG path fill (allows gradients).
// color is used everywhere else (popup, CSS borders, brighten()).
export const FEATURED: Record<number, {
  name: string; code: string; color: string; svgFill?: string
  conf: string; icon: string
}> = {
  686: { name:'Sénégal', code:'sn', color:'#FCDD09',                              conf:'CAF',      icon:'🏆' },
  392: { name:'Japon',   code:'jp', color:'#BC002D', svgFill:'url(#japan-grad)', conf:'AFC',      icon:'🌏' },
  840: { name:'USA',     code:'us', color:'#3C3B6E',                              conf:'CONCACAF', icon:'⚡' },
}

/** All non-featured countries: paper-white so continents are clearly readable. */

// ─── Confederation palette — matches each featured country's flag color ──────
const CONF_COLOR: Record<string, [number, number, number]> = {
  CONMEBOL: [0,   155, 58 ],  // Brazil green   #009B3A
  UEFA:     [198, 11,  30 ],  // Spain red       #C60B1E
  CONCACAF: [60,  59,  110],  // USA navy        #3C3B6E
  AFC:      [240, 125, 15 ],  // saffron orange  #F07D0F
  CAF:      [252, 221, 9  ],  // Senegal gold    #FCDD09
  OFC:      [6,   182, 212],  // cyan            #06B6D4
}

// ─── Qualified teams: ISO numeric ID → { conf, fifaRank } ───────────────────
// fifaRank = FIFA World Ranking (global, lower = better).
// England + Scotland both → ISO 826 (United Kingdom in world-atlas topojson).
const QUALIFIED: Record<number, { conf: string; fifaRank: number }> = {
  //  CONMEBOL — 6 teams
  32:  { conf: 'CONMEBOL', fifaRank:   1 },  // Argentina
  76:  { conf: 'CONMEBOL', fifaRank:   5 },  // Brazil       ← featured
  170: { conf: 'CONMEBOL', fifaRank:   9 },  // Colombia
  858: { conf: 'CONMEBOL', fifaRank:  20 },  // Uruguay
  218: { conf: 'CONMEBOL', fifaRank:  46 },  // Ecuador
  600: { conf: 'CONMEBOL', fifaRank:  62 },  // Paraguay
  //  UEFA — 15 teams (England + Scotland share ISO 826)
  250: { conf: 'UEFA',     fifaRank:   2 },  // France
  724: { conf: 'UEFA',     fifaRank:   3 },  // Spain        ← featured
  826: { conf: 'UEFA',     fifaRank:   4 },  // England / Scotland
  56:  { conf: 'UEFA',     fifaRank:   7 },  // Belgium
  620: { conf: 'UEFA',     fifaRank:   6 },  // Portugal
  528: { conf: 'UEFA',     fifaRank:   8 },  // Netherlands
  276: { conf: 'UEFA',     fifaRank:  12 },  // Germany
  191: { conf: 'UEFA',     fifaRank:  11 },  // Croatia
  756: { conf: 'UEFA',     fifaRank:  17 },  // Switzerland
  40:  { conf: 'UEFA',     fifaRank:  25 },  // Austria
  792: { conf: 'UEFA',     fifaRank:  30 },  // Turkey
  578: { conf: 'UEFA',     fifaRank:  38 },  // Norway
  752: { conf: 'UEFA',     fifaRank:  33 },  // Sweden
  203: { conf: 'UEFA',     fifaRank:  37 },  // Czech Republic
  70:  { conf: 'UEFA',     fifaRank:  68 },  // Bosnia-Herzegovina
  //  CONCACAF — 6 teams (incl. 3 hosts)
  840: { conf: 'CONCACAF', fifaRank:  14 },  // USA          ← featured + host
  484: { conf: 'CONCACAF', fifaRank:  18 },  // Mexico       host
  124: { conf: 'CONCACAF', fifaRank:  43 },  // Canada       host
  591: { conf: 'CONCACAF', fifaRank:  64 },  // Panama
  332: { conf: 'CONCACAF', fifaRank:  99 },  // Haiti
  531: { conf: 'CONCACAF', fifaRank: 128 },  // Curaçao
  //  AFC — 9 teams
  392: { conf: 'AFC',      fifaRank:  15 },  // Japan        ← featured
  410: { conf: 'AFC',      fifaRank:  22 },  // South Korea
  36:  { conf: 'AFC',      fifaRank:  23 },  // Australia
  364: { conf: 'AFC',      fifaRank:  21 },  // Iran
  682: { conf: 'AFC',      fifaRank:  57 },  // Saudi Arabia
  634: { conf: 'AFC',      fifaRank:  67 },  // Qatar
  400: { conf: 'AFC',      fifaRank:  89 },  // Jordan
  368: { conf: 'AFC',      fifaRank:  75 },  // Iraq
  860: { conf: 'AFC',      fifaRank:  76 },  // Uzbekistan
  //  CAF — 10 teams
  504: { conf: 'CAF',      fifaRank:  13 },  // Morocco
  686: { conf: 'CAF',      fifaRank:  19 },  // Senegal      ← featured
  384: { conf: 'CAF',      fifaRank:  60 },  // Ivory Coast
  818: { conf: 'CAF',      fifaRank:  40 },  // Egypt
  710: { conf: 'CAF',      fifaRank:  56 },  // South Africa
  788: { conf: 'CAF',      fifaRank:  43 },  // Tunisia
  12:  { conf: 'CAF',      fifaRank:  48 },  // Algeria
  288: { conf: 'CAF',      fifaRank:  65 },  // Ghana
  180: { conf: 'CAF',      fifaRank:  61 },  // DR Congo
  132: { conf: 'CAF',      fifaRank:  54 },  // Cape Verde
  //  OFC — 1 team
  554: { conf: 'OFC',      fifaRank:  96 },  // New Zealand
}

// ISO-2 flag codes for all qualifying countries (for flagcdn.com)
const FLAG_CODE: Record<number, string> = {
  // CONMEBOL (6)
  32: 'ar', 76: 'br', 170: 'co', 858: 'uy', 218: 'ec', 600: 'py',
  // UEFA (15)
  250: 'fr', 724: 'es', 826: 'gb-eng', 56: 'be', 620: 'pt', 528: 'nl',
  276: 'de', 191: 'hr', 756: 'ch', 40: 'at', 792: 'tr', 578: 'no',
  752: 'se', 203: 'cz', 70: 'ba',
  // CONCACAF (6)
  840: 'us', 484: 'mx', 124: 'ca', 591: 'pa', 332: 'ht', 531: 'cw',
  // AFC (9)
  392: 'jp', 410: 'kr', 36: 'au', 364: 'ir', 682: 'sa', 634: 'qa',
  400: 'jo', 368: 'iq', 860: 'uz',
  // CAF (10)
  504: 'ma', 686: 'sn', 384: 'ci', 818: 'eg', 710: 'za',
  788: 'tn', 12: 'dz', 288: 'gh', 180: 'cd', 132: 'cv',
  // OFC (1)
  554: 'nz',
  // Non-qualified — ghost flag for UEFA continent flicker
  380: 'it',  // Italy
}

// ISO-2 (flagcdn) → identifiant topojson, pour retrouver le centroïde d'un pays.
const CODE_TO_ID: Record<string, number> = {}
Object.entries(FLAG_CODE).forEach(([id, code]) => { CODE_TO_ID[code] = parseInt(id) })
// Les nations britanniques partagent le Royaume-Uni (826) dans le world-atlas.
CODE_TO_ID['gb-eng'] = 826; CODE_TO_ID['gb-sct'] = 826
CODE_TO_ID['gb-nir'] = 826; CODE_TO_ID['gb-wls'] = 826

// Position précise [lon, lat] pour les sélections sans pays propre dans le
// world-atlas (le RU est une seule forme → centroïde en Angleterre). On force
// donc le drapeau sur le bon territoire.
const TEAM_LL: Record<string, [number, number]> = {
  'gb-nir': [-6.7, 54.7],   // Irlande du Nord
  'gb-sct': [-4.2, 56.8],   // Écosse
  'gb-wls': [-3.8, 52.3],   // Pays de Galles
  'gb-eng': [-1.3, 52.6],   // Angleterre
  'cw': [-68.99, 12.17],    // Curaçao (île trop petite pour la géométrie du globe)
  'cv': [-23.61, 15.12],    // Cap-Vert (idem)
}

interface MatchFlag {
  code: string         // code drapeau flagcdn (ex. 'fr', 'gb-nir')
  color: string        // couleur nationale (contour)
  ll: [number, number] // centroïde [lon, lat] du pays
}
interface MatchArc {
  match: Match
  flags: [MatchFlag, MatchFlag]  // [domicile, extérieur]
}

// Italy — didn't qualify; gets a special "struggling to light up" flicker
const ITALY_ID = 380

// Geographic center of each confederation [lon, lat]
const CONF_CENTER: Record<string, [number, number]> = {
  CONMEBOL: [-58, -15],
  UEFA:     [ 15,  50],
  CONCACAF: [-90,  18],
  CAF:      [ 20,   5],
  AFC:      [ 80,  30],
  OFC:      [170, -25],
}

// Affiche KO → affiche du tour suivant (le vainqueur y est reporté). Sert à déduire le
// perdant d'un match nul réglé aux tirs au but (T.A.B.), que le score seul ne révèle pas.
const KO_NEXT_SLOT: Record<string, string> = {
  'r32-1': 'r16-1', 'r32-2': 'r16-1', 'r32-3': 'r16-2', 'r32-4': 'r16-2',
  'r32-5': 'r16-3', 'r32-6': 'r16-3', 'r32-7': 'r16-4', 'r32-8': 'r16-4',
  'r32-9': 'r16-5', 'r32-10': 'r16-5', 'r32-11': 'r16-6', 'r32-12': 'r16-6',
  'r32-13': 'r16-7', 'r32-14': 'r16-7', 'r32-15': 'r16-8', 'r32-16': 'r16-8',
  'r16-1': 'qf-1', 'r16-2': 'qf-1', 'r16-3': 'qf-2', 'r16-4': 'qf-2',
  'r16-5': 'qf-3', 'r16-6': 'qf-3', 'r16-7': 'qf-4', 'r16-8': 'qf-4',
  'qf-1': 'sf-1', 'qf-2': 'sf-1', 'qf-3': 'sf-2', 'qf-4': 'sf-2',
  'sf-1': 'final', 'sf-2': 'final',
}

// FIFA rank range across all qualified countries (for global normalisation)
const _fifaRanks   = Object.values(QUALIFIED).map(q => q.fifaRank)
const FIFA_RANK_MIN = Math.min(..._fifaRanks)   // 1  (Argentina)
const FIFA_RANK_MAX = Math.max(..._fifaRanks)   // 128 (Curaçao)

function landColor(numericId: number): string {
  const q = QUALIFIED[numericId]
  if (!q) return 'rgba(128,133,142,0.90)'  // non-qualified: medium slate
  // factor 1.0 = best FIFA rank (most vivid), 0.0 = worst rank (most dim)
  const factor = (FIFA_RANK_MAX - q.fifaRank) / (FIFA_RANK_MAX - FIFA_RANK_MIN)
  // Mix range 20% (rank 128) → 85% (rank 1) — wide spread for clear visual gradient
  const mix    = 0.20 + factor * 0.65
  const [r, g, b] = CONF_COLOR[q.conf]
  const wr = Math.round(90  * (1 - mix) + r * mix)
  const wg = Math.round(95  * (1 - mix) + g * mix)
  const wb = Math.round(105 * (1 - mix) + b * mix)
  return `rgba(${wr},${wg},${wb},0.95)`
}

/** Slightly brighten a hex color for the selected state. Skips url() fills. */
// Couleur d'un pays « éteint » (éliminé) sur le globe.
const OUT_FILL = '#222B38'

function brighten(hex: string, amount = 0.13): string {
  if (hex.startsWith('url(')) return hex
  const c = d3.hsl(hex)
  c.l = Math.min(1, c.l + amount)
  return c.formatHex()
}


// ─── Globe palette ─────────────────────────────────────────────────────────
const C = {
  border:   'rgba(45, 62, 82, 0.48)',   // softer navy — visible but not harsh
  bgStroke: 'rgba(45, 62, 82, 0.22)',   // lighter for individual country fills
  grid:     'rgba(255, 255, 255, 0.07)',
}


interface GlobeProps {
  onNavigate: (section: string) => void
  onSelectContinent: (conf: string) => void
  isActive?: boolean
  continentRequest?: { conf: string; ts: number } | null
  onContinentShown?: () => void
  currentUser?: UserProfile | null
}
interface PopupState { countryId: number; x: number; y: number }
interface CenteringState {
  startRot: [number, number]; targetRot: [number, number]
  startTime: number; countryId?: number; feature?: any; conf?: string
  fromNav?: boolean
}

function shortestPath(from: number, to: number): number {
  return from + ((to - from + 540) % 360 - 180)
}

// ─── Component ────────────────────────────────────────────────────────────
export default function Globe({ onNavigate, onSelectContinent, isActive, continentRequest, onContinentShown, currentUser }: GlobeProps) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const svgRef          = useRef<SVGSVGElement>(null)
  const [matchCard,     setMatchCard]     = useState<Match | null>(null)
  const matchArcsRef    = useRef<MatchArc[]>([])
  const todayByCountryRef = useRef<Map<number, Match>>(new Map())
  const arcScoreRef     = useRef<Map<string, { h: number; a: number }>>(new Map())   // matchId → { home, away } (final ou live)
  const matchFinalRef   = useRef<Map<string, { h: number; a: number }>>(new Map())   // résultats FINAUX seuls (→ gagnant/perdant)
  const matchLiveStatusRef = useRef<Map<string, string>>(new Map())                  // matchId → statut live (en jeu ?)
  const koTeamsRef      = useRef<Record<string, { home_short: string | null; away_short: string | null }>>({})  // bracket
  const koSigRef        = useRef<string>('')                         // signature du bracket (rebuild si change)
  const renderMarkersRef = useRef<() => void>(() => {})              // (re)dessine les affiches du globe
  const countryFxRef    = useRef<Map<number, 'out' | 'normal'>>(new Map())  // dernier état peint par pays
  const eliminatedRef   = useRef<Set<number>>(new Set())                     // pays éliminés (éteints)
  const outAnimUntilRef = useRef<Map<number, number>>(new Map())             // fin d'anim d'extinction par pays
  const openMatchCardRef  = useRef<(m: Match) => void>(() => {})
  const [popup,              setPopup]              = useState<PopupState | null>(null)
  const [isLoaded,           setIsLoaded]           = useState(false)
  const [champion,           setChampion]           = useState<string | null>(null)   // pays champion du monde
  const [continentPopup,     setContinentPopup]     = useState<{ conf: string } | null>(null)
  const [continentPopupVis,  setContinentPopupVis]  = useState(false)
  // true once the container has valid pixel dimensions — guards D3 init
  const [ready,    setReady]    = useState(false)

  const projRef           = useRef<d3.GeoProjection | null>(null)
  const pathRef           = useRef<d3.GeoPath | null>(null)
  const rafRef            = useRef<number>(0)
  const rotRef            = useRef<[number, number]>([-10, -25])
  const isRotRef          = useRef(true)
  const dragRef           = useRef({ on: false, ox: 0, oy: 0 })
  const popupRef          = useRef<PopupState | null>(null)
  const selectedRef       = useRef<number | null>(null)
  const featuresRef       = useRef<any[]>([])
  const centeringRef      = useRef<CenteringState | null>(null)
  const pendingCenterRef  = useRef<number | undefined>(undefined)
  const triggerCenterRef  = useRef<(id: number) => void>(() => {})
  const zoomRef           = useRef(1)
  const baseRRef          = useRef(0)
  const velRef            = useRef({ x: 0, y: 0 })
  const postZoomAnimRef   = useRef<{ start: number; from: number; to: number } | null>(null)
  const popupWrapRef      = useRef<HTMLDivElement | null>(null)
  // Dive animation — set when Explorer is clicked; drives D3 projection zoom
  const diveAnimRef       = useRef<{ start: number; target: string; fromScale: number } | null>(null)
  const onNavigateRef     = useRef(onNavigate)
  const onSelectContinentRef   = useRef(onSelectContinent)
  const continentCountriesRef  = useRef<number[]>([])
  const onContinentShownRef    = useRef(onContinentShown)
  const triggerContinentRef    = useRef<(conf: string) => void>(() => {})

  const setPopupSync = useCallback((p: PopupState | null) => {
    popupRef.current    = p
    selectedRef.current = p ? p.countryId : null
    setPopup(p)
  }, [])

  const handleClose = useCallback(() => {
    const prev = selectedRef.current
    const continentPrev = continentCountriesRef.current.slice()
    setPopupSync(null)
    continentCountriesRef.current = []
    setContinentPopup(null)
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.select('.g-flags').selectAll('*').remove()
      if (prev !== null) {
        svg.select(`defs #clip-flag-${prev}`).remove()
        // Restore featured country to its normal fill — sauf s'il est éliminé (reste éteint).
        if (FEATURED[prev]) {
          const elim = eliminatedRef.current.has(prev)
          svg.select(`.ft-country.country-${prev}`)
            .classed('selected', false)
            .attr('fill', elim ? OUT_FILL : landColor(prev))
            .attr('opacity', elim ? 0.55 : 1)
            .attr('stroke', C.bgStroke)
            .attr('stroke-width', '0.5')
        }
      }
      continentPrev.forEach(id => svg.select(`defs #clip-flag-${id}`).remove())
    }
    isRotRef.current = true
  }, [setPopupSync])

  // Close popup + reset zoom when the globe is hidden (user navigated away)
  useEffect(() => {
    if (isActive === false) {
      handleClose()
      setMatchCard(null)
      if (projRef.current && baseRRef.current > 0) {
        projRef.current.scale(baseRRef.current)
      }
      zoomRef.current         = 1
      postZoomAnimRef.current = null
      diveAnimRef.current     = null
    }
  }, [isActive, handleClose])

  // Drive the slide-up transition: mount invisible → tiny delay → visible
  useEffect(() => {
    if (!continentPopup) { setContinentPopupVis(false); return }
    const t = setTimeout(() => setContinentPopupVis(true), 80)
    return () => clearTimeout(t)
  }, [continentPopup])

  useEffect(() => {
    if (!continentRequest) return
    const center = CONF_CENTER[continentRequest.conf]
    if (!center) return
    const [lon, lat] = center
    // Clear any existing display
    if (popupRef.current || continentCountriesRef.current.length > 0) handleClose()
    isRotRef.current        = false
    velRef.current          = { x: 0, y: 0 }
    postZoomAnimRef.current = null
    centeringRef.current    = {
      startRot:  [...rotRef.current] as [number, number],
      targetRot: [shortestPath(rotRef.current[0], -lon), Math.max(-80, Math.min(80, -lat))],
      startTime: performance.now(),
      conf:      continentRequest.conf,
      fromNav:   true,
    }
  }, [continentRequest, handleClose])

  const triggerCenter = useCallback((countryId: number) => {
    if (featuresRef.current.length === 0) { pendingCenterRef.current = countryId; return }
    const feat = featuresRef.current.find((f: any) => parseInt(f.id) === countryId)
    if (!feat) return
    const [lon, lat] = d3.geoCentroid(feat)
    if (popupRef.current || continentCountriesRef.current.length > 0) {
      const prev = selectedRef.current
      const continentPrev = continentCountriesRef.current.slice()
      setPopupSync(null)
      continentCountriesRef.current = []
      if (svgRef.current) {
        const svg = d3.select(svgRef.current)
        svg.select('.g-flags').selectAll('*').remove()
        if (prev !== null) {
          svg.select(`defs #clip-flag-${prev}`).remove()
          svg.select(`.ft-country.country-${prev}`).classed('selected', false)
            .attr('fill', FEATURED[prev]?.svgFill ?? FEATURED[prev]?.color ?? '')
            .attr('stroke', 'rgba(0,0,0,0.15)')
        }
        continentPrev.forEach(id => {
          svg.select(`defs #clip-flag-${id}`).remove()
          if (FEATURED[id]) {
            svg.select(`.ft-country.country-${id}`).classed('selected', false)
              .attr('fill', FEATURED[id].svgFill ?? FEATURED[id].color)
              .attr('stroke', 'rgba(0,0,0,0.15)')
          }
        })
      }
    }
    isRotRef.current        = false
    velRef.current          = { x: 0, y: 0 }
    postZoomAnimRef.current = null
    centeringRef.current    = {
      startRot:  [...rotRef.current] as [number, number],
      targetRot: [shortestPath(rotRef.current[0], -lon), Math.max(-80, Math.min(80, -lat))],
      startTime: performance.now(),
      countryId, feature: feat,
    }
  }, [setPopupSync])

  // Trigger continent centering from a direct globe click (no auto-navigate)
  const triggerContinentForConf = useCallback((conf: string) => {
    const center = CONF_CENTER[conf]
    if (!center) return
    const [lon, lat] = center
    if (popupRef.current || continentCountriesRef.current.length > 0) handleClose()
    isRotRef.current        = false
    velRef.current          = { x: 0, y: 0 }
    postZoomAnimRef.current = null
    centeringRef.current    = {
      startRot:  [...rotRef.current] as [number, number],
      targetRot: [shortestPath(rotRef.current[0], -lon), Math.max(-80, Math.min(80, -lat))],
      startTime: performance.now(),
      conf,
      fromNav: false,
    }
  }, [handleClose])

  triggerCenterRef.current     = triggerCenter
  triggerContinentRef.current  = triggerContinentForConf
  onNavigateRef.current        = onNavigate
  onSelectContinentRef.current = onSelectContinent
  onContinentShownRef.current  = onContinentShown
  openMatchCardRef.current     = (m: Match) => {
    handleClose()
    // Allume les deux pays du match (même effet que le continent, réduit à 2 pays)
    const ids = [...new Set([CODE_TO_ID[m.home.code], CODE_TO_ID[m.away.code]]
      .filter((x): x is number => typeof x === 'number'))]
    if (svgRef.current && pathRef.current && featuresRef.current.length && ids.length) {
      const svg = d3.select(svgRef.current)
      applyContinent(ids, featuresRef.current, pathRef.current,
        svg.select('.g-flags') as any, svg.select('defs') as any, eliminatedRef.current)
      continentCountriesRef.current = ids
      isRotRef.current = false
      velRef.current   = { x: 0, y: 0 }
    }
    setMatchCard(m)
  }

  // When Explorer is clicked: hide the React popup card but keep selectedRef + SVG flag,
  // then run the D3 projection zoom. navigate is called after the animation.
  const diveFromPopup = useCallback((conf: string) => {
    popupRef.current = null
    setPopup(null)
    postZoomAnimRef.current = null
    // Capture the current scale so the animation starts from exactly where the
    // user is — avoids the de-zoom glitch when they had already pinched in.
    const fromScale = projRef.current?.scale() ?? baseRRef.current
    diveAnimRef.current = { start: performance.now(), target: conf, fromScale }
  }, [])

  // Scores des matchs du jour pour l'étiquette d'arc (résultat final prioritaire, sinon live).
  // Anti-flicker : on FUSIONNE (on ne supprime jamais un score déjà connu) → un sondage
  // momentanément vide ne fait plus « sauter » le score vers « VS ». + temps réel.
  useEffect(() => {
    let on = true
    const load = async () => {
      try {
        const [liveRows, results] = await Promise.all([getLive(), getResults()])
        if (!on) return
        const next = new Map(arcScoreRef.current)
        for (const l of liveRows) next.set(l.matchId, { h: l.homeScore, a: l.awayScore })
        for (const r of results)  next.set(r.matchId, { h: r.homeScore, a: r.awayScore })  // final = prioritaire
        arcScoreRef.current = next
        // Pour la mise en scène (feu / hologramme / extinction) : résultats FINAUX et statut live.
        const finals = new Map<string, { h: number; a: number }>()
        for (const r of results) finals.set(r.matchId, { h: r.homeScore, a: r.awayScore })
        matchFinalRef.current = finals
        const liveStatus = new Map<string, string>()
        for (const l of liveRows) liveStatus.set(l.matchId, l.status)
        matchLiveStatusRef.current = liveStatus
      } catch { /* ignore */ }
    }
    load()
    const unsub = subscribeToLive(load)   // mise à jour dès qu'un score change
    const iv = setInterval(load, 12000)   // filet de sécurité
    return () => { on = false; unsub(); clearInterval(iv) }
  }, [])

  // Bracket (affectations d'équipes des phases éliminatoires) → savoir qui est encore en lice.
  useEffect(() => {
    let on = true
    const load = () => getKnockoutTeams().then(rows => {
      if (!on) return
      const sig = JSON.stringify(rows)
      if (sig === koSigRef.current) return       // inchangé → on ne reconstruit pas
      koSigRef.current = sig
      koTeamsRef.current = rows
      renderMarkersRef.current()                  // re-dessine les affiches avec les vraies équipes
    }).catch(() => {})
    load()
    const iv = setInterval(load, 60000)
    return () => { on = false; clearInterval(iv) }
  }, [])

  // Champion du monde (vainqueur de la finale) → feux d'artifice + bandeau. N'affecte PAS
  // le rendu D3 du globe (overlay HTML pur) → aucune incidence sur la stabilité.
  useEffect(() => {
    let on = true
    const load = () => getWorldChampion().then(c => { if (on) setChampion(c) }).catch(() => {})
    load()
    const iv = setInterval(load, 120000)
    return () => { on = false; clearInterval(iv) }
  }, [])

  // Wait for the container to have real pixel dimensions before initialising D3.
  // Root cause of the "tiny globe" bug: on iOS Safari (and occasionally Chrome)
  // the flex layout hasn't resolved yet when the first useEffect fires.
  // clientWidth/clientHeight can return a non-zero but wrong small value (e.g. 15 px
  // height), passing the old ">= 10" guard and initialising D3 with R ≈ 4 px.
  //
  // Fix:
  //  1. getBoundingClientRect() — more reliable than clientWidth/clientHeight
  //  2. threshold of 100 px — rules out transient partial-layout snapshots
  //  3. double requestAnimationFrame — defers until the browser has completed
  //     at least 2 paint frames, by which time flex layout is always settled
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let rafId: number
    let ro: ResizeObserver | null = null

    const check = () => {
      const { width, height } = el.getBoundingClientRect()
      return width >= 100 && height >= 100
    }

    const tryInit = () => {
      if (check()) { setReady(true); return }
      // Still not ready — wait for the first resize that gives real dimensions
      ro = new ResizeObserver(() => {
        if (check()) { ro!.disconnect(); ro = null; setReady(true) }
      })
      ro.observe(el)
    }

    // Two RAF frames: first waits for paint, second for layout to fully settle
    rafId = requestAnimationFrame(() => { rafId = requestAnimationFrame(tryInit) })

    return () => { cancelAnimationFrame(rafId); ro?.disconnect() }
  }, [])

  useEffect(() => {
    if (!ready) return
    const el = containerRef.current
    if (!el || !svgRef.current) return

    const W = el.clientWidth
    const H = el.clientHeight
    const R = Math.min(W, H) * 0.26
    baseRRef.current = R

    const proj = d3.geoOrthographic()
      .scale(R)
      .translate([W / 2, H / 2])
      .clipAngle(90)
      .rotate(rotRef.current)
    projRef.current = proj

    const geoPath = d3.geoPath(proj)
    pathRef.current = geoPath

    const svg = d3.select(svgRef.current).attr('width', W).attr('height', H)
    svg.selectAll('*').remove()
    // Le SVG est reconstruit à neuf (pays sans la classe « éteint ») → on vide le cache des
    // états peints, sinon paintCountries croit que rien n'a changé et ne ré-applique pas le gris.
    countryFxRef.current.clear()

    // ── Defs ──────────────────────────────────────────────────────────
    const defs = svg.append('defs')

    // Faisceau d'hologramme (gagnant projeté) — dégradé vertical cyan qui s'estompe vers le haut.
    const beamGrad = defs.append('linearGradient').attr('id', 'holo-beam-grad')
      .attr('x1', '0').attr('y1', '1').attr('x2', '0').attr('y2', '0')   // bas → haut
    beamGrad.append('stop').attr('offset', '0%').attr('stop-color', '#7FE9FF').attr('stop-opacity', 0.55)
    beamGrad.append('stop').attr('offset', '100%').attr('stop-color', '#7FE9FF').attr('stop-opacity', 0)

    // Ocean — deep dark gradient
    const sphereGrad = defs.append('radialGradient').attr('id', 'sphere-grad')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('cx', W / 2 - 0.3 * R).attr('cy', H / 2 - 0.4 * R).attr('r', 1.3 * R)
    sphereGrad.append('stop').attr('offset', '0%').attr('stop-color', '#1E5A8A')
    sphereGrad.append('stop').attr('offset', '55%').attr('stop-color', '#0F3860')
    sphereGrad.append('stop').attr('offset', '100%').attr('stop-color', '#061A38')

    // Vignette — strong edge darkening for depth
    const vigGrad = defs.append('radialGradient').attr('id', 'vig-grad')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('cx', W / 2).attr('cy', H / 2).attr('r', R)
    vigGrad.append('stop').attr('offset', '48%').attr('stop-color', 'transparent')
    vigGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0.52)')


// Japan flag gradient — white centre (sun) → crimson edges
    const japanGrad = defs.append('radialGradient').attr('id', 'japan-grad')
      .attr('gradientUnits', 'objectBoundingBox')
      .attr('cx', '50%').attr('cy', '50%').attr('r', '80%')
    japanGrad.append('stop').attr('offset', '0%').attr('stop-color', '#FAFAFA')
    japanGrad.append('stop').attr('offset', '45%').attr('stop-color', '#F0B0B0')
    japanGrad.append('stop').attr('offset', '100%').attr('stop-color', '#BC002D')

    // ── Layer groups ──────────────────────────────────────────────────
    const gSphere      = svg.append('g').attr('class', 'g-sphere')
    const gGrid        = svg.append('g').attr('class', 'g-grid')
    const gBgCountry   = svg.append('g').attr('class', 'g-bg-countries')
    const gStruggle    = svg.append('g').attr('class', 'g-struggle')      // Italy flicker
    const gQualCountry = svg.append('g').attr('class', 'g-qual-countries')
    const gFtCountry  = svg.append('g').attr('class', 'g-ft-countries')
    // Drapeaux (continent / pays) — décoratifs : laissent passer le clic vers les pays
    const gFlags      = svg.append('g').attr('class', 'g-flags').attr('pointer-events', 'none')
    const gBorders    = svg.append('g').attr('class', 'g-borders')
    const gVig        = svg.append('g').attr('class', 'g-vig')   // vignette circle
    // Marqueurs des matchs du jour — au-dessus de tout, sans bloquer les clics
    const gArcs       = svg.append('g').attr('class', 'g-arcs').attr('pointer-events', 'none')

    // Ocean sphere
    const sphereShape = { type: 'Sphere' } as Parameters<typeof geoPath>[0]
    gSphere.append('path').datum(sphereShape).attr('d', geoPath)
      .attr('fill', 'url(#sphere-grad)')
      .attr('stroke', '#061020').attr('stroke-width', '1.2')

    // Graticule — very subtle white lines, no glow
    gGrid.append('path').datum(d3.geoGraticule().step([30, 30])())
      .attr('d', geoPath).attr('fill', 'none')
      .attr('stroke', C.grid).attr('stroke-width', '0.5')

    // Vignette overlay (darkens the edges of the globe softly)
    gVig.append('circle').attr('cx', W / 2).attr('cy', H / 2).attr('r', R)
      .attr('fill', 'url(#vig-grad)').attr('pointer-events', 'none')

    // ── Load world data (fichier local embarqué, repli CDN) ──────────
    const MAP_LOCAL = `${import.meta.env.BASE_URL}countries-110m.json`
    const MAP_CDN = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json'
    fetch(MAP_LOCAL)
      .then(r => { if (!r.ok) throw new Error('local map'); return r.json() })
      .catch(() => fetch(MAP_CDN).then(r => r.json()))
      .then((world: Topology) => {
        const countries = feature(world, (world as any).objects.countries) as any
        if (!countries.features) return
        const features: any[] = countries.features
        featuresRef.current = features

        // Background countries — only non-qualified merged by color (performance)
        // Italy (380) is excluded here and rendered separately with its flicker animation.
        const qualifiedIds = new Set(Object.keys(QUALIFIED).map(Number))
        const colorGroups  = new Map<string, any[]>()
        features
          .filter((d: any) => {
            const id = parseInt(d.id)
            return !FEATURED[id] && !qualifiedIds.has(id) && id !== ITALY_ID
          })
          .forEach((feat: any) => {
            const color = landColor(parseInt(feat.id))
            if (!colorGroups.has(color)) colorGroups.set(color, [])
            colorGroups.get(color)!.push(feat)
          })
        gBgCountry.selectAll('path')
          .data([...colorGroups.entries()].map(([color, feats]) => ({
            color,
            geom: { type: 'FeatureCollection' as const, features: feats },
          })))
          .join('path')
          .attr('fill', (d: any) => d.color)
          .attr('stroke', C.bgStroke)
          .attr('stroke-width', '0.5')
          .attr('d', (d: any) => geoPath(d.geom as any) ?? '')

        // Italy — non-qualified but rendered individually for the flicker animation.
        // getLargestPolygon keeps only the mainland (drops Sardinia/Sicily from bbox calc).
        const italyFeat = features.find((f: any) => parseInt(f.id) === ITALY_ID)
        if (italyFeat) {
          gStruggle.append('path')
            .datum(getLargestPolygon(italyFeat))
            .attr('class', 'italy-struggle')
            .attr('d', geoPath as any)
            .attr('fill', 'rgba(118,98,104,0.88)')
            .attr('stroke', C.bgStroke)
            .attr('stroke-width', '0.5')
        }

        // Qualified non-FEATURED countries — individually rendered so each is clickable.
        // Use getLargestPolygon so countries like France don't bleed their overseas
        // territories (French Guiana, Martinique…) into other continents.
        gQualCountry.selectAll('.qual-country')
          .data(features
            .filter((d: any) => {
              const id = parseInt(d.id)
              return qualifiedIds.has(id) && !FEATURED[id]
            })
            .map((feat: any) => getLargestPolygon(feat))
          )
          .join('path')
          .attr('class', (d: any) => `qual-country country-${parseInt(d.id)}`)
          .attr('d', geoPath as any)
          .attr('fill',   (d: any) => landColor(parseInt(d.id)))
          .attr('stroke', C.bgStroke)
          .attr('stroke-width', '0.5')
          .style('cursor', 'pointer')
          .on('click', (_event: MouseEvent, d: any) => {
            if (diveAnimRef.current) return
            const id   = parseInt(d.id)
            const todayM = todayByCountryRef.current.get(id)
            if (todayM) { openMatchCardRef.current(todayM); return }
            const conf = QUALIFIED[id]?.conf
            if (conf) triggerContinentRef.current(conf)
          })

        // Featured countries — vivid flag colors, click → continent mode.
        // getLargestPolygon keeps only the mainland (avoids USA showing Alaska/Hawaii).
        gFtCountry.selectAll('.ft-country')
          .data(features
            .filter((d: any) => FEATURED[parseInt(d.id)])
            .map((feat: any) => getLargestPolygon(feat))
          )
          .join('path')
          .attr('class', (d: any) => `ft-country ft-featured country-${parseInt(d.id)}`)
          .attr('d', geoPath as any)
          .attr('fill',   (d: any) => landColor(parseInt(d.id)))
          .attr('stroke', C.bgStroke)
          .attr('stroke-width', '0.5')
          .style('cursor', 'pointer')
          .on('click', (_event: MouseEvent, d: any) => {
            if (diveAnimRef.current) return
            const id   = parseInt(d.id)
            const todayM = todayByCountryRef.current.get(id)
            if (todayM) { openMatchCardRef.current(todayM); return }
            const conf = QUALIFIED[id]?.conf
            if (conf) triggerContinentRef.current(conf)
          })

        // Country borders
        gBorders.append('path').datum(countries as any)
          .attr('d', geoPath as any).attr('fill', 'none')
          .attr('stroke', C.border).attr('stroke-width', '0.60')

        // ── Matchs du jour : drapeaux plantés (surélevés) sur les pays ──
        const centroidOf = (id: number): [number, number] | null => {
          const f = features.find((x: any) => parseInt(x.id) === id)
          if (!f) return null
          const c = d3.geoCentroid(getLargestPolygon(f) as any)
          return (isFinite(c[0]) && isFinite(c[1])) ? [c[0], c[1]] : null
        }
        const FLAG_W = 18, FLAG_H = 12, POLE_H = 15
        const HOLO_LIFT = POLE_H + FLAG_H + 40   // gagnant projeté HAUT (grand hologramme)

        // Affiches montrées sur le globe : UNIQUEMENT les matchs éliminatoires du jour, avec
        // les vraies équipes injectées depuis le bracket (knockout_teams). Les matchs de poules
        // ne sont plus affichés.
        const resolveKoMatches = (): Match[] => {
          const ko = koTeamsRef.current
          // Jour courant (Europe/Zurich). On part de KNOCKOUT_MATCHES (pas de todaysMatches,
          // qui exclut les affiches TBD AVANT qu'on injecte les équipes du bracket).
          const dayStr = (ms: number) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' })
          const today = dayStr(Date.now())
          return KNOCKOUT_MATCHES
            .map(m => {
              const a = ko[m.id]
              return a ? { ...m, home: teamByShort(a.home_short) ?? m.home, away: teamByShort(a.away_short) ?? m.away } : m
            })
            .filter(m => {
              if (m.home.code === 'un' || m.away.code === 'un') return false   // équipes connues
              const k = matchKickoffUTC(m)
              return k != null && dayStr(k) === today                          // affiche DU JOUR
            })
        }

        // (Re)construit drapeaux + arcs. Rappelé quand le bracket se charge (équipes connues).
        const renderMatchMarkers = () => {
          gArcs.selectAll('*').remove()
          const arcs: MatchArc[] = []
          const byCountry = new Map<number, Match>()
          resolveKoMatches().forEach(m => {
            const hId = CODE_TO_ID[m.home.code], aId = CODE_TO_ID[m.away.code]
            // Coordonnée forcée (nations UK, petites îles) sinon centroïde du pays.
            const hc = TEAM_LL[m.home.code] ?? (hId != null ? centroidOf(hId) : null)
            const ac = TEAM_LL[m.away.code] ?? (aId != null ? centroidOf(aId) : null)
            if (!hc || !ac) return
            arcs.push({ match: m, flags: [
              { code: m.home.code, color: teamColor(m.home), ll: hc },
              { code: m.away.code, color: teamColor(m.away), ll: ac },
            ] })
            if (hId != null) byCountry.set(hId, m)
            if (aId != null) byCountry.set(aId, m)
          })
          matchArcsRef.current     = arcs
          todayByCountryRef.current = byCountry

          arcs.forEach((arc, i) => {
            arc.flags.forEach((fl, s) => {
              gArcs.append('ellipse').attr('class', `mflag-shadow m-${i}-${s}`)
                .attr('fill', 'rgba(0,0,0,0.4)')
              gArcs.append('line').attr('class', `mflag-pole m-${i}-${s}`)
                .attr('stroke', '#000000').attr('stroke-width', 1.6).attr('stroke-linecap', 'round')
                .style('filter', 'drop-shadow(0 0 1.2px rgba(255,255,255,0.6))')
              gArcs.append('image').attr('class', `mflag-img m-${i}-${s}`)
                .attr('href', `https://flagcdn.com/w160/${fl.code}.png`)
                .attr('preserveAspectRatio', 'none')
                .style('filter', 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))')
              gArcs.append('rect').attr('class', `mflag-edge m-${i}-${s}`)
                .attr('fill', 'none').attr('stroke', fl.color).attr('stroke-width', 1.2).attr('rx', 1)

              // ── Gagnant PROJETÉ (hologramme) — faisceau + drapeau flottant, au-dessus de tout ──
              const holo = gArcs.append('g').attr('class', `mholo m-${i}-${s}`)
                .attr('opacity', 0).style('pointer-events', 'none')
              holo.append('ellipse').attr('cx', 0).attr('cy', 0).attr('rx', 7).attr('ry', 2.4)
                .attr('fill', '#7FE9FF').attr('opacity', 0.25)
              holo.append('path').attr('d',
                `M-2.5,0 L${(-FLAG_W * 1.15).toFixed(1)},${-HOLO_LIFT} L${(FLAG_W * 1.15).toFixed(1)},${-HOLO_LIFT} L2.5,0 Z`)
                .attr('fill', 'url(#holo-beam-grad)')
              const holoAnim = holo.append('g').attr('class', 'globe-holo-anim')
              const HW = FLAG_W * 2.1, HH = FLAG_H * 2.1   // grand drapeau projeté
              holoAnim.append('image').attr('class', 'globe-holo-flicker')
                .attr('href', `https://flagcdn.com/w160/${fl.code}.png`).attr('preserveAspectRatio', 'none')
                .attr('x', -HW / 2).attr('y', -HOLO_LIFT - HH).attr('width', HW).attr('height', HH)
                .style('filter', 'drop-shadow(0 0 5px #7FE9FF) drop-shadow(0 0 10px rgba(127,233,255,0.6))')
                .attr('opacity', 0.9)
            })
            // Lien de match entre les deux pays + petit "VS"
            gArcs.append('line').attr('class', `mflag-link arc-${i}`)
              .attr('stroke', '#C89B3C').attr('stroke-width', 1.5).attr('stroke-dasharray', '3 3').attr('stroke-linecap', 'round')
            gArcs.append('text').attr('class', `mflag-vs arc-${i}`)
              .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
              .attr('font-size', 9).attr('font-weight', 800).attr('letter-spacing', 0.5)
              .attr('fill', '#FFE9B0').attr('stroke', 'rgba(0,0,0,0.85)').attr('stroke-width', 2.4)
              .style('paint-order', 'stroke').text('VS')
          })
        }
        renderMatchMarkers()
        renderMarkersRef.current = renderMatchMarkers

        const updateArcs = (_t: number) => {
          const list = matchArcsRef.current
          if (!list.length) return
          const rot = rotRef.current
          const center: [number, number] = [-rot[0], -rot[1]]
          const nowMs = Date.now()
          const allKos = list.map(a => matchKickoffUTC(a.match) ?? Infinity)
          list.forEach((arc, i) => {
            // État du match → hologramme du vainqueur (le feu autour des pays a été retiré).
            const ko = matchKickoffUTC(arc.match)
            const final = matchFinalRef.current.get(arc.match.id)
            const finished = !!final
            // Gagnant : 0 = domicile (flags[0]), 1 = extérieur (flags[1]), -1 = nul / indéterminé.
            const winnerSide = !final ? -1 : (final.h > final.a ? 0 : final.a > final.h ? 1 : -1)
            // Hologramme du gagnant « jusqu'au prochain match du jour » : tant qu'aucun match
            // dont le coup d'envoi est postérieur n'a encore démarré.
            const nextKo = Math.min(Infinity, ...allKos.filter(k => ko != null && k > ko))
            const holoActive = finished && winnerSide >= 0 && nowMs < nextKo
            // Position écran (et visibilité) de chaque drapeau
            const tops: ([number, number] | null)[] = []
            arc.flags.forEach((fl, s) => {
              const sh   = gArcs.select(`.mflag-shadow.m-${i}-${s}`)
              const pole = gArcs.select(`.mflag-pole.m-${i}-${s}`)
              const img  = gArcs.select(`.mflag-img.m-${i}-${s}`)
              const edge = gArcs.select(`.mflag-edge.m-${i}-${s}`)
              const holo  = gArcs.select(`.mholo.m-${i}-${s}`)
              const p = proj(fl.ll)
              const visible = !!p && d3.geoDistance(center, fl.ll) < Math.PI / 2 - 0.02
              if (!visible || !p) {
                sh.attr('opacity', 0); pole.attr('opacity', 0); img.attr('opacity', 0); edge.attr('opacity', 0)
                holo.attr('opacity', 0)
                tops.push(null); return
              }
              const [x, y] = p
              const fx = x - FLAG_W / 2
              const fy = y - POLE_H - FLAG_H
              sh.attr('cx', x).attr('cy', y + 1).attr('rx', 3.5).attr('ry', 1.6).attr('opacity', 0.4)
              pole.attr('x1', x).attr('y1', y).attr('x2', x).attr('y2', y - POLE_H).attr('opacity', 1)
              img.attr('x', fx).attr('y', fy).attr('width', FLAG_W).attr('height', FLAG_H).attr('opacity', 1)
              edge.attr('x', fx).attr('y', fy).attr('width', FLAG_W).attr('height', FLAG_H).attr('opacity', 0.9)
              // Gagnant projeté en hologramme (jusqu'au prochain match du jour).
              holo.attr('transform', `translate(${x},${y})`).attr('opacity', holoActive && s === winnerSide ? 1 : 0)
              tops.push([x, y - POLE_H - FLAG_H / 2])   // centre du drapeau
            })
            // Lien + "VS" si les deux drapeaux sont visibles
            const link = gArcs.select(`.mflag-link.arc-${i}`)
            const vs   = gArcs.select(`.mflag-vs.arc-${i}`)
            if (tops[0] && tops[1]) {
              const [a, b] = [tops[0], tops[1]]
              link.attr('x1', a[0]).attr('y1', a[1]).attr('x2', b[0]).attr('y2', b[1]).attr('opacity', 0.8)
              // Affiche le score (final ou live) si connu, sinon "VS". a = drapeau DOMICILE
              // (flags[0]), b = drapeau EXTÉRIEUR (flags[1]). On oriente le score selon la
              // position ÉCRAN des drapeaux : le nombre de gauche correspond au drapeau de
              // gauche → plus d'ambiguïté (ex. Australie 2-0 ne se lit plus « 2 pour la Turquie »).
              const sc = arcScoreRef.current.get(arc.match.id)
              const label = sc ? (a[0] <= b[0] ? `${sc.h}-${sc.a}` : `${sc.a}-${sc.h}`) : 'VS'
              vs.text(label)
                .attr('x', (a[0] + b[0]) / 2).attr('y', (a[1] + b[1]) / 2).attr('opacity', 1)
            } else {
              link.attr('opacity', 0); vs.attr('opacity', 0)
            }
          })
        }

        // ── Mise en scène des pays : feu (match en cours), éteint (éliminé/perdant) ──
        // L'intérieur du pays s'embrase pendant son match ; les éliminés (poules ou KO) et
        // les perdants restent éteints. Diff d'état → on ne repeint qu'au changement (n'écrase
        // pas les surbrillances au survol). Le scintillement/extinction est géré en CSS.
        const idOfShort = (s?: string | null): number | undefined => {
          if (!s) return undefined
          const t = teamByShort(s)
          return t ? CODE_TO_ID[t.code] : undefined
        }
        const paintCountries = () => {
          const ko = koTeamsRef.current
          const koIds = Object.keys(ko)
          if (!koIds.length) return   // bracket pas encore chargé → on ne touche à rien
          const reached = new Set<number>()   // pays ayant atteint les éliminatoires
          const losers  = new Set<number>()   // perdants d'une affiche KO déjà jouée
          for (const mid of koIds) {
            if (!/^(r32|r16|qf|sf|final|3rd)/.test(mid)) continue
            const row = ko[mid]
            const hid = idOfShort(row.home_short), aid = idOfShort(row.away_short)
            if (hid != null) reached.add(hid)
            if (aid != null) reached.add(aid)
            const fin = matchFinalRef.current.get(mid)
            if (fin) {
              if (fin.h > fin.a && aid != null) losers.add(aid)
              else if (fin.a > fin.h && hid != null) losers.add(hid)
              else if (fin.h === fin.a) {
                // Nul → T.A.B. : le perdant est l'équipe de l'affiche absente du tour suivant.
                const nx = ko[KO_NEXT_SLOT[mid]]
                const mine = new Set([row.home_short, row.away_short].filter(Boolean).map(s => s!.toUpperCase()))
                let q: string | null = null
                if (nx) for (const t of [nx.home_short, nx.away_short]) if (t && mine.has(t.toUpperCase())) q = t.toUpperCase()
                if (q) {
                  const qid = idOfShort(q)
                  if (qid === hid && aid != null) losers.add(aid)
                  else if (qid === aid && hid != null) losers.add(hid)
                }
              }
            }
          }
          // Pays éliminés (sortis en poules ou perdants KO) → ÉTEINTS en gris sombre. À la première
          // extinction : transition animée (cascade). Ensuite : maintien direct (robuste) une fois
          // l'anim finie. Couleur directe (pas de filtre CSS, peu fiable sur un <path> SVG).
          const nowMs = Date.now()
          let outI = 0
          qualifiedIds.forEach(id => {
            const out = !(reached.has(id) && !losers.has(id))
            const sel = svg.selectAll(`.country-${id}`)
            if (sel.empty()) return
            const prev = countryFxRef.current.get(id)
            if (out) {
              eliminatedRef.current.add(id)
              if (prev !== 'out') {
                countryFxRef.current.set(id, 'out')
                const delay = (outI++ % 16) * 45                       // cascade d'extinction
                outAnimUntilRef.current.set(id, nowMs + delay + 850)
                sel.interrupt().transition().delay(delay).duration(800).ease(d3.easeCubicInOut)
                  .attr('fill', OUT_FILL).attr('opacity', 0.55)
              } else if ((outAnimUntilRef.current.get(id) ?? 0) < nowMs) {
                sel.attr('fill', OUT_FILL).attr('opacity', 0.55)       // maintien (anim terminée)
              }
            } else {
              eliminatedRef.current.delete(id)
              if (prev === 'out') {
                countryFxRef.current.set(id, 'normal')
                sel.interrupt().attr('fill', landColor(id)).attr('opacity', 1)
              }
            }
          })
        }
        paintCountries()

setIsLoaded(true)

        if (pendingCenterRef.current !== undefined) {
          triggerCenterRef.current(pendingCenterRef.current)
          pendingCenterRef.current = undefined
        }

        // ── Animation loop ──────────────────────────────────────────
        let prevT = 0
        let paintTick = 0
        let prevR0 = NaN, prevR1 = NaN, prevProjScale = NaN
        const animate = (t: number) => {
          // Dive animation: D3 projection zoom triggered by clicking Explorer in the popup.
          // Redraws at native resolution every frame — no CSS scale, no blur artifacts.
          if (diveAnimRef.current) {
            const { start, target, fromScale } = diveAnimRef.current
            const elapsed   = t - start
            const progress  = Math.min(elapsed / 520, 1)
            // Always zoom 3.2× from wherever the user was — no reset, no stutter
            const endScale  = fromScale * 3.2
            const diveR     = fromScale + (endScale - fromScale) * d3.easeCubicIn(progress)
            proj.scale(diveR)
            gSphere.select('path').attr('d', geoPath(sphereShape) ?? '')
            gGrid.select('path').attr('d', geoPath as any)
            gBgCountry.selectAll('path').attr('d', (d: any) => geoPath(d.geom as any) ?? '')
            gStruggle.select('.italy-struggle').attr('d', geoPath as any)
            gQualCountry.selectAll('.qual-country').attr('d', geoPath as any)
            gFtCountry.selectAll('.ft-country').attr('d', geoPath as any)
            gBorders.select('path').attr('d', geoPath as any)
            gVig.select('circle').attr('r', diveR)
            defs.select('#sphere-grad')
              .attr('cx', W / 2 - 0.3 * diveR).attr('cy', H / 2 - 0.4 * diveR).attr('r', 1.3 * diveR)
            defs.select('#vig-grad').attr('cx', W / 2).attr('cy', H / 2).attr('r', diveR)
            if (selectedRef.current !== null) {
              const selFeat = featuresRef.current.find((f: any) => parseInt(f.id) === selectedRef.current)
              if (selFeat) {
                const pathStr = geoPath(selFeat as any)
                if (pathStr) {
                  const [[fx0, fy0], [fx1, fy1]] = geoPath.bounds(selFeat as any)
                  gFlags.select('image').attr('x', fx0).attr('y', fy0)
                    .attr('width',  Math.max(fx1 - fx0, 1))
                    .attr('height', Math.max(fy1 - fy0, 1))
                  defs.select(`#clip-flag-${selectedRef.current} path`).attr('d', pathStr)
                }
              }
            }
            if (progress >= 1) {
              diveAnimRef.current = null
              onSelectContinentRef.current(target)
            }
            rafRef.current = requestAnimationFrame(animate)
            return
          }

          const dt = prevT === 0 ? 0 : Math.min((t - prevT) / 1000, 0.05)
          prevT = t

          // Auto-rotate / inertia
          if (!selectedRef.current && !centeringRef.current && !dragRef.current.on) {
            const { x: vx, y: vy } = velRef.current
            if (isRotRef.current) {
              rotRef.current[0] += dt * 4
              proj.rotate(rotRef.current)
            } else if (Math.abs(vx) > 0.003 || Math.abs(vy) > 0.003) {
              rotRef.current[0] += vx
              rotRef.current[1]  = Math.max(-80, Math.min(80, rotRef.current[1] - vy))
              velRef.current     = { x: vx * 0.92, y: vy * 0.92 }
              proj.rotate(rotRef.current)
            } else {
              velRef.current = { x: 0, y: 0 }
              // Don't resume auto-rotation while a continent or country is displayed
              if (continentCountriesRef.current.length === 0 && selectedRef.current === null) {
                isRotRef.current = true
              }
            }
          }

          // Centering animation
          if (centeringRef.current) {
            const elapsed  = t - centeringRef.current.startTime
            const progress = Math.min(elapsed / 850, 1)
            const ease     = d3.easeCubicInOut(progress)
            const { startRot, targetRot } = centeringRef.current
            rotRef.current = [
              startRot[0] + (targetRot[0] - startRot[0]) * ease,
              startRot[1] + (targetRot[1] - startRot[1]) * ease,
            ] as [number, number]
            proj.rotate(rotRef.current)

            // Zoom curve: pull back → zoom in
            const zf = progress < 0.45
              ? 1 - 0.08 * d3.easeCubicOut(progress / 0.45)
              : 0.92 + 0.22 * d3.easeCubicInOut((progress - 0.45) / 0.55)
            proj.scale(R * zoomRef.current * zf)

            if (progress >= 1) {
              const { countryId, feature: feat, conf, fromNav } = centeringRef.current
              centeringRef.current = null
              postZoomAnimRef.current = { start: t, from: 1.14, to: 1.0 }
              if (conf) {
                // Continent mode: show all qualifying flags for this confederation
                const ids = Object.entries(QUALIFIED)
                  .filter(([, q]) => q.conf === conf)
                  .map(([id]) => parseInt(id))
                // UEFA: also inject Italy so the RAF loop tracks its ghost flag position
                if (conf === 'UEFA') ids.push(ITALY_ID)
                continentCountriesRef.current = ids
                applyContinent(ids, featuresRef.current, geoPath, gFlags, defs, eliminatedRef.current)
                setContinentPopup({ conf })
                // Only auto-navigate when triggered from a nav bar click
                if (fromNav) onContinentShownRef.current?.()
              } else if (countryId !== undefined && feat) {
                // Country mode: show popup
                const centroid = geoPath.centroid(feat as any)
                if (isFinite(centroid[0]) && isFinite(centroid[1])) {
                  applyFlag(countryId, feat, geoPath, gFlags, defs)
                  gFtCountry.select(`.country-${countryId}`)
                    .classed('selected', true)
                    .attr('fill', brighten(FEATURED[countryId].color))
                    .attr('stroke', 'rgba(255,255,255,0.28)')
                    .attr('stroke-width', '1.5')
                  setPopupSync({ countryId, x: centroid[0], y: centroid[1] })
                }
              }
            }
          }

          // Post-centering zoom ease-back
          if (postZoomAnimRef.current && !centeringRef.current) {
            const { start, from, to } = postZoomAnimRef.current
            const prog = Math.min((t - start) / 700, 1)
            const zf   = from + (to - from) * d3.easeCubicOut(prog)
            proj.scale(R * zoomRef.current * zf)
            if (prog >= 1) {
              postZoomAnimRef.current = null
              proj.scale(R * zoomRef.current)
            }
          }

          // Dirty flag — only update SVG when projection actually changed
          const curR = proj.scale()
          const [r0, r1] = rotRef.current
          if (r0 !== prevR0 || r1 !== prevR1 || curR !== prevProjScale) {
            prevR0 = r0; prevR1 = r1; prevProjScale = curR

            // Redraw all geo paths
            gSphere.select('path').attr('d', geoPath(sphereShape) ?? '')
            gGrid.select('path').attr('d', geoPath as any)
            gBgCountry.selectAll('path').attr('d', (d: any) => geoPath(d.geom as any) ?? '')
            gStruggle.select('.italy-struggle').attr('d', geoPath as any)
            gQualCountry.selectAll('.qual-country').attr('d', geoPath as any)
            gFtCountry.selectAll('.ft-country').attr('d', geoPath as any)
            gBorders.select('path').attr('d', geoPath as any)

            // Vignette + gradient sync
            gVig.select('circle').attr('r', curR)
            defs.select('#sphere-grad')
              .attr('cx', W / 2 - 0.3 * curR).attr('cy', H / 2 - 0.4 * curR).attr('r', 1.3 * curR)
            defs.select('#vig-grad')
              .attr('cx', W / 2).attr('cy', H / 2).attr('r', curR)

            // Flag overlay + popup anchor
            // Continent mode: update all confederation flags
            if (continentCountriesRef.current.length > 0) {
              continentCountriesRef.current.forEach(id => {
                const selFeat = featuresRef.current.find((f: any) => parseInt(f.id) === id)
                if (!selFeat) return
                const mainFeat = getLargestPolygon(selFeat)
                const pathStr = geoPath(mainFeat as any)
                if (!pathStr) return
                const [[fx0, fy0], [fx1, fy1]] = geoPath.bounds(mainFeat as any)
                if (!isFinite(fx0) || !isFinite(fy0)) return   // country on back hemisphere
                gFlags.select(`image[clip-path="url(#clip-flag-${id})"]`)
                  .attr('x', fx0).attr('y', fy0)
                  .attr('width',  Math.max(fx1 - fx0, 1))
                  .attr('height', Math.max(fy1 - fy0, 1))
                defs.select(`#clip-flag-${id} path`).attr('d', pathStr)
              })
            } else if (selectedRef.current !== null) {
              // Single-country mode
              const selFeat = featuresRef.current.find(
                (f: any) => parseInt(f.id) === selectedRef.current
              )
              if (selFeat) {
                const pathStr = geoPath(selFeat as any)
                if (pathStr) {
                  const [[fx0, fy0], [fx1, fy1]] = geoPath.bounds(selFeat as any)
                  gFlags.select('image')
                    .attr('x', fx0).attr('y', fy0)
                    .attr('width',  Math.max(fx1 - fx0, 1))
                    .attr('height', Math.max(fy1 - fy0, 1))
                  defs.select(`#clip-flag-${selectedRef.current} path`).attr('d', pathStr)
                }
                const c = geoPath.centroid(selFeat as any)
                if (isFinite(c[0]) && isFinite(c[1]) && popupWrapRef.current) {
                  popupWrapRef.current.style.left = c[0] + 'px'
                  popupWrapRef.current.style.top  = c[1] + 'px'
                }
              }
            }
          }

          updateArcs(t)
          if (++paintTick % 40 === 0) paintCountries()   // états feu/éteint (~0.7 s) — CSS gère l'anim
          rafRef.current = requestAnimationFrame(animate)
        }
        rafRef.current = requestAnimationFrame(animate)
      })
      .catch(err => console.error('Carte du monde indisponible :', err))

    // ── Click-outside-to-close — click on ocean/non-featured area ──
    svg.on('click', (event: MouseEvent) => {
      const target = d3.select(event.target as Element)
      // Clicks on any qualified country are handled by their own click listeners
      if (target.classed('ft-featured') || target.classed('qual-country')) return
      setMatchCard(null)
      // Close continent mode or single-country popup
      if (continentCountriesRef.current.length > 0 || selectedRef.current !== null) {
        handleClose()
      }
    })

    // ── Drag (mouse-only — touch handled by explicit touch listeners below) ──
    const dragBehavior = d3.drag<SVGSVGElement, unknown>()
      .filter((event: Event) => event instanceof MouseEvent)
      .on('start', (event) => {
        if (selectedRef.current || centeringRef.current) return
        isRotRef.current = false
        dragRef.current  = { on: true, ox: event.x, oy: event.y }
      })
      .on('drag', (event) => {
        if (!dragRef.current.on || selectedRef.current || centeringRef.current) return
        const dx = event.x - dragRef.current.ox
        const dy = event.y - dragRef.current.oy
        dragRef.current.ox = event.x
        dragRef.current.oy = event.y
        rotRef.current[0] += dx * 0.28
        rotRef.current[1]  = Math.max(-80, Math.min(80, rotRef.current[1] - dy * 0.28))
        velRef.current.x   = velRef.current.x * 0.4 + dx * 0.28 * 0.6
        velRef.current.y   = velRef.current.y * 0.4 + dy * 0.28 * 0.6
        proj.rotate(rotRef.current)
      })
      .on('end', () => { dragRef.current.on = false })

    svg.call(dragBehavior as any)

    // ── Wheel zoom ──────────────────────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      postZoomAnimRef.current = null
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      zoomRef.current = Math.max(0.4, Math.min(3.5, zoomRef.current * factor))
      proj.scale(R * zoomRef.current)
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    // ── Touch: pinch-to-zoom + single-finger drag ───────────────────────
    let lastPinchDist = 0
    let lastTouchX    = 0
    let lastTouchY    = 0
    let singleTouchOn = false

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && !selectedRef.current && !centeringRef.current) {
        lastTouchX    = e.touches[0].clientX
        lastTouchY    = e.touches[0].clientY
        singleTouchOn = true
        isRotRef.current = false
        velRef.current   = { x: 0, y: 0 }
      } else if (e.touches.length === 2) {
        singleTouchOn = false
        velRef.current = { x: 0, y: 0 }   // kill drag inertia before pinch
        lastPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        singleTouchOn = false
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        )
        if (lastPinchDist > 0) {
          postZoomAnimRef.current = null
          zoomRef.current = Math.max(0.4, Math.min(3.5, zoomRef.current * dist / lastPinchDist))
          proj.scale(R * zoomRef.current)
        }
        lastPinchDist = dist
      } else if (e.touches.length === 1 && singleTouchOn) {
        e.preventDefault()
        const dx = e.touches[0].clientX - lastTouchX
        const dy = e.touches[0].clientY - lastTouchY
        lastTouchX = e.touches[0].clientX
        lastTouchY = e.touches[0].clientY
        rotRef.current[0] += dx * 0.28
        rotRef.current[1]  = Math.max(-80, Math.min(80, rotRef.current[1] - dy * 0.28))
        velRef.current.x   = velRef.current.x * 0.4 + dx * 0.28 * 0.6
        velRef.current.y   = velRef.current.y * 0.4 + dy * 0.28 * 0.6
        proj.rotate(rotRef.current)
      }
    }
    const onTouchEnd = () => { singleTouchOn = false; lastPinchDist = 0 }

    el.addEventListener('touchstart', onTouchStart, { passive: true  })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true  })

    return () => {
      cancelAnimationFrame(rafRef.current)
      el.removeEventListener('wheel',      onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        style={{
          display: 'block', touchAction: 'none', userSelect: 'none', cursor: 'grab',
        }}
        onMouseDown={() => { if (svgRef.current) svgRef.current.style.cursor = 'grabbing' }}
        onMouseUp={()   => { if (svgRef.current) svgRef.current.style.cursor = 'grab' }}
      />

      {/* 🏆 Champion du monde : feux d'artifice CSS + bandeau (overlay HTML, hors D3) */}
      {champion && isLoaded && (() => {
        const champTeam = teamByShort(champion)
        return (
          <>
            <Fireworks active style={{ zIndex: 6 }} />
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 8, zIndex: 7, pointerEvents: 'none',
              padding: '7px 14px', borderRadius: 999,
              background: 'linear-gradient(135deg, rgba(20,14,0,0.82), rgba(40,28,0,0.72))',
              border: '1px solid rgba(255,215,94,0.55)', boxShadow: '0 0 18px rgba(255,215,94,0.3)',
              fontFamily: "'Bebas Neue', cursive", fontSize: 15, letterSpacing: 1.4, color: '#FFE9B0',
              whiteSpace: 'nowrap',
            }}>
              🏆 {champTeam && (
                <img src={`https://flagcdn.com/w40/${champTeam.code}.png`} alt=""
                  style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover' }} />
              )}
              {champTeam?.name ?? champion} · Champion du monde 2026
            </div>
          </>
        )
      })()}

      {/* Loading spinner */}
      {!isLoaded && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
        }}>
          <div style={{
            width: 28, height: 28,
            border: '2px solid rgba(200,155,60,.25)',
            borderTopColor: '#C89B3C', borderRadius: '50%',
            animation: 'spin 0.75s linear infinite',
          }} />
          <span style={{ fontSize: 10, letterSpacing: 2, color: '#AEAEB2', textTransform: 'uppercase', fontWeight: 600 }}>
            Chargement…
          </span>
        </div>
      )}

      {/* Country popup — wrapper div anchored to centroid each frame */}
      {popup && (
        <div
          ref={popupWrapRef}
          style={{ position: 'absolute', left: popup.x, top: popup.y, pointerEvents: 'none' }}
        >
          <CountryPopup
            countryId={popup.countryId}
            onNavigate={diveFromPopup}
            onClose={handleClose}
          />
        </div>
      )}

      {/* Continent popup — compact card, slides up from bottom */}
      {continentPopup && COMPETITIONS[continentPopup.conf] && (() => {
        const comp = COMPETITIONS[continentPopup.conf]
        const [r, g, b] = CONF_COLOR[continentPopup.conf] ?? [200, 155, 60]
        const confHex   = `rgb(${r},${g},${b})`
        return (
          <div style={{
            position: 'absolute',
            bottom: 104,
            left: '50%',
            transform: continentPopupVis
              ? 'translateX(-50%) translateY(0) scale(1)'
              : 'translateX(-50%) translateY(24px) scale(0.94)',
            opacity: continentPopupVis ? 1 : 0,
            transition: 'opacity 0.38s cubic-bezier(0.34,1.15,0.64,1), transform 0.38s cubic-bezier(0.34,1.15,0.64,1)',
            zIndex: 60,
            pointerEvents: continentPopupVis ? 'auto' : 'none',
          }}>
            <div style={{
              position: 'relative',
              background: 'rgba(8,18,38,0.90)',
              border: `1.5px solid rgba(${r},${g},${b},0.40)`,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.25)',
              backdropFilter: 'blur(24px)',
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px 14px 18px',
              whiteSpace: 'nowrap',
            }}>
              {/* Color accent strip at top */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                background: `linear-gradient(90deg, ${confHex}, rgba(${r},${g},${b},0.45))`,
              }} />

              {/* Icon + labels */}
              <span style={{ fontSize: 24, lineHeight: 1 }}>{comp.emoji}</span>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.8,
                  color: `rgba(${r},${g},${b},0.85)`, textTransform: 'uppercase', marginBottom: 2,
                }}>
                  {comp.region}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  {comp.competition}
                </div>
              </div>

              {/* CTA button */}
              <button
                onClick={() => {
                  setContinentPopup(null)
                  onSelectContinentRef.current(continentPopup.conf)
                }}
                onPointerDown={e => (e.currentTarget.style.opacity = '0.75')}
                onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
                style={{
                  padding: '10px 18px',
                  background: `linear-gradient(135deg, ${confHex}, rgba(${r},${g},${b},0.72))`,
                  border: 'none', borderRadius: 12,
                  color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  boxShadow: `0 4px 14px rgba(${r},${g},${b},0.35)`,
                  transition: 'opacity 0.12s',
                  flexShrink: 0,
                }}
              >
                Explorer →
              </button>
            </div>
          </div>
        )
      })()}

      {/* Carte d'avant-match — match du jour cliqué sur le globe */}
      {matchCard && (
        <MatchPreCard
          match={matchCard}
          currentUser={currentUser}
          onClose={() => { handleClose(); setMatchCard(null) }}
          onNavigate={(s) => { handleClose(); setMatchCard(null); onNavigateRef.current(s) }}
        />
      )}
    </div>
  )
}

// ─── Carte d'avant-match (match du jour) ────────────────────────────────────
function MatchPreCard({ match, currentUser, onClose, onNavigate }: {
  match: Match
  currentUser?: UserProfile | null
  onClose: () => void
  onNavigate: (section: string) => void
}) {
  const [prono, setProno] = useState<{ home: number; away: number } | null>(null)
  const [live,  setLive]  = useState<{ home: number; away: number; status: string; elapsed: number | null } | null>(() => {
    try {
      const o = JSON.parse(localStorage.getItem('trivela-live') || '{}')
      const l = o[match.id]
      return l ? { home: l.homeScore, away: l.awayScore, status: l.status, elapsed: l.elapsed } : null
    } catch { return null }
  })
  const [vis,   setVis]   = useState(false)
  const [result, setResult] = useState<{ home: number; away: number } | null>(null)

  useEffect(() => { const t = setTimeout(() => setVis(true), 60); return () => clearTimeout(t) }, [])
  useEffect(() => {
    let on = true
    if (currentUser) {
      getBets(currentUser.id).then(bs => {
        if (!on) return
        const b = bs.find(x => x.matchId === match.id)
        if (b) setProno({ home: b.homeScore, away: b.awayScore })
      }).catch(() => {})
    }
    // Résultat final (le match est terminé → on ne le montre plus "en direct")
    getResults().then(rs => {
      if (!on) return
      const r = rs.find(x => x.matchId === match.id)
      if (r) setResult({ home: r.homeScore, away: r.awayScore })
    }).catch(() => {})
    const poll = () => getLive().then(arr => {
      if (!on) return
      const l = arr.find(x => x.matchId === match.id)
      if (l) setLive({ home: l.homeScore, away: l.awayScore, status: l.status, elapsed: l.elapsed })
    }).catch(() => {})
    poll()
    const iv = setInterval(poll, 15000)   // suit le score live tant que la carte est ouverte
    return () => { on = false; clearInterval(iv) }
  }, [match.id, currentUser])

  const kickoff = matchKickoffUTC(match)
  const time = kickoff != null
    ? new Date(kickoff).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })
    : match.time
  // En direct = données API en jeu OU dans le créneau horaire — mais JAMAIS si le
  // match a déjà un résultat final (sinon il resterait "en direct / VS").
  const finished = result != null
  const now = Date.now()
  const inWindow = kickoff != null && now >= kickoff && now < kickoff + 135 * 60 * 1000
  const isLive = !finished && ((!!live && ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(live.status)) || inWindow)
  const stage = match.round === 'group'
    ? (match.group === 'Amical' ? 'Match amical' : `Groupe ${match.group}`)
    : match.group
  const hc = teamColor(match.home), ac = teamColor(match.away)

  const TeamCol = ({ t }: { t: Team }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
      <img src={`https://flagcdn.com/w80/${t.code}.png`} alt={t.name}
        style={{ width: 46, height: 31, objectFit: 'cover', borderRadius: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }} />
      <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 17, letterSpacing: 1, color: '#fff' }}>
        {t.short}
      </span>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', bottom: 104, left: '50%',
      transform: vis ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(24px) scale(0.94)',
      opacity: vis ? 1 : 0,
      transition: 'opacity 0.34s cubic-bezier(0.34,1.15,0.64,1), transform 0.34s cubic-bezier(0.34,1.15,0.64,1)',
      zIndex: 60, width: 'min(92vw, 360px)',
    }}>
      <div style={{
        position: 'relative', background: 'rgba(8,18,38,0.92)',
        border: isLive ? '1.5px solid rgba(220,38,38,0.7)' : '1.5px solid rgba(255,255,255,0.12)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: isLive ? '0 12px 40px rgba(220,38,38,0.4)' : '0 12px 40px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(24px)', padding: '16px 18px 18px',
        animation: isLive ? 'livePulse 1.6s ease-in-out infinite' : undefined,
      }}>
        {/* Bandeau couleurs des deux pays */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${hc}, ${ac})` }} />

        {/* Fermer */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 8,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', lineHeight: 1,
        }}>✕</button>

        <div style={{
          textAlign: 'center', fontSize: 9, fontWeight: 800, letterSpacing: 1.6,
          color: isLive ? '#ff5a5a' : 'rgba(200,155,60,0.95)', textTransform: 'uppercase', marginBottom: 12,
        }}>
          {isLive
            ? `● EN DIRECT${live?.elapsed != null ? ` · ${live.elapsed}'` : ''}`
            : finished ? `Terminé · ${stage}` : `Aujourd'hui · ${stage}`}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TeamCol t={match.home} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
            {isLive ? (
              <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 30, color: '#ff5a5a', lineHeight: 1 }}>
                {live?.home ?? 0}<span style={{ opacity: 0.5, margin: '0 4px' }}>:</span>{live?.away ?? 0}
              </div>
            ) : finished ? (
              <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 30, color: '#fff', lineHeight: 1 }}>
                {result!.home}<span style={{ opacity: 0.5, margin: '0 4px' }}>:</span>{result!.away}
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: '#fff', lineHeight: 1 }}>{time}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5, marginTop: 2 }}>GVA</div>
              </>
            )}
          </div>
          <TeamCol t={match.away} />
        </div>

        <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 12 }}>
          {match.venue} · {match.city}
        </div>

        {/* Prono */}
        <div style={{
          marginTop: 12, padding: '9px 12px', borderRadius: 12,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
            {prono
              ? <>Ton prono <b style={{ color: '#fff' }}>{prono.home}–{prono.away}</b></>
              : currentUser ? 'Pas encore de prono' : 'Connecte-toi pour parier'}
          </span>
          <button onClick={() => onNavigate('paris')} style={{
            padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#C89B3C,#E8D080)', color: '#0D0800', fontSize: 12, fontWeight: 800,
            flexShrink: 0,
          }}>
            {prono ? 'Modifier' : 'Parier'} →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Continent flag overlay — show all qualifying country flags at once ───────

/**
 * For countries like France (includes French Guiana), USA (includes Alaska),
 * Norway (includes Svalbard), etc., world-atlas returns a MultiPolygon.
 * We extract the largest polygon (by outer-ring point count) so the flag
 * is clipped to and positioned over the mainland rather than a bounding box
 * that spans the whole globe.
 */
function getLargestPolygon(feat: any): any {
  if (feat?.geometry?.type !== 'MultiPolygon') return feat
  const rings: number[][][][] = feat.geometry.coordinates
  let maxLen = 0, maxIdx = 0
  rings.forEach((poly, i) => {
    const len = poly[0]?.length ?? 0
    if (len > maxLen) { maxLen = len; maxIdx = i }
  })
  return { ...feat, geometry: { type: 'Polygon', coordinates: rings[maxIdx] } }
}

function applyContinent(
  countryIds: number[],
  features: any[],
  geoPath: d3.GeoPath,
  gFlags: d3.Selection<SVGGElement, unknown, null, undefined>,
  defs:   d3.Selection<SVGDefsElement, unknown, null, undefined>,
  dimIds?: Set<number>,   // pays éliminés → drapeau qui reste sombre (ne s'allume pas)
) {
  gFlags.selectAll('*').remove()
  countryIds.forEach(id => defs.select(`#clip-flag-${id}`).remove())

  countryIds.forEach((id, i) => {
    const code = FLAG_CODE[id]
    if (!code) return
    const feat = features.find((f: any) => parseInt(f.id) === id)
    if (!feat) return
    const mainFeat = getLargestPolygon(feat)   // use mainland only (fixes France, USA, …)
    const pathStr = geoPath(mainFeat as any)
    if (!pathStr) return
    const [[x0, y0], [x1, y1]] = geoPath.bounds(mainFeat as any)
    if (!isFinite(x0) || !isFinite(y0) || x1 - x0 < 1 || y1 - y0 < 1) return

    defs.append('clipPath').attr('id', `clip-flag-${id}`)
      .append('path').attr('d', pathStr)

    const img = gFlags.append('image')
      .attr('href', `https://flagcdn.com/w640/${code}.png`)
      .attr('x', x0).attr('y', y0)
      .attr('width',  Math.max(x1 - x0, 1))
      .attr('height', Math.max(y1 - y0, 1))
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .attr('clip-path', `url(#clip-flag-${id})`)
      .attr('opacity', 0)

    if (id === ITALY_ID) {
      // Italy didn't qualify — its flag tries to appear last then flickers out
      const italyDelay = i * 50 + 500   // well after all qualifiers are visible
      img
        .transition().delay(italyDelay).duration(600).ease(d3.easeCubicOut)
        .attr('opacity', 0.85)                                   // monte
        .transition().duration(160).attr('opacity', 0.08)        // coupe
        .transition().duration(230).attr('opacity', 0.72)        // scintille
        .transition().duration(130).attr('opacity', 0.04)        // presque mort
        .transition().duration(350).attr('opacity', 0.58)        // dernier souffle
        .transition().duration(520).ease(d3.easeCubicIn)
        .attr('opacity', 0.00)                                   // éteint
    } else {
      // Pays éliminé → drapeau qui reste très sombre (il ne « s'allume » pas) ; sinon plein éclat.
      const targetOp = dimIds && dimIds.has(id) ? 0.16 : 0.92
      img
        .transition().delay(i * 50).duration(500).ease(d3.easeCubicOut)
        .attr('opacity', targetOp)
    }
  })
}

// ─── Flag overlay ─────────────────────────────────────────────────────────
function applyFlag(
  id: number, featureData: any, geoPath: d3.GeoPath,
  gFlags: d3.Selection<SVGGElement, unknown, null, undefined>,
  defs:   d3.Selection<SVGDefsElement, unknown, null, undefined>,
) {
  gFlags.selectAll('*').remove()
  defs.select(`#clip-flag-${id}`).remove()
  const pathStr = geoPath(featureData as any)
  if (!pathStr) return
  const [[x0, y0], [x1, y1]] = geoPath.bounds(featureData as any)
  defs.append('clipPath').attr('id', `clip-flag-${id}`)
    .append('path').attr('d', pathStr)
  gFlags.append('image')
    .attr('href', `https://flagcdn.com/w640/${FEATURED[id].code}.png`)
    .attr('x', x0).attr('y', y0)
    .attr('width', Math.max(x1 - x0, 1)).attr('height', Math.max(y1 - y0, 1))
    .attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('clip-path', `url(#clip-flag-${id})`)
    .attr('opacity', 0)
    .transition().duration(450).ease(d3.easeCubicOut)
    .attr('opacity', 1)
}
