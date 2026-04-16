import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import CountryPopup from './CountryPopup'

// ─── Featured countries — vivid national flag colours ─────────────────────
// svgFill overrides the SVG path fill (allows gradients).
// color is used everywhere else (popup, CSS borders, brighten()).
export const FEATURED: Record<number, {
  name: string; code: string; color: string; svgFill?: string
  sectionId: string; sectionName: string; icon: string
}> = {
  76:  { name:'Brésil',  code:'br', color:'#009B3A',                              sectionId:'packs',      sectionName:'Mes Packs',   icon:'📦' },
  686: { name:'Sénégal', code:'sn', color:'#FCDD09',                              sectionId:'classement', sectionName:'Classement',  icon:'🏆' },
  724: { name:'Espagne', code:'es', color:'#C60B1E',                              sectionId:'album',      sectionName:'Mon Album',   icon:'📖' },
  392: { name:'Japon',   code:'jp', color:'#BC002D', svgFill:'url(#japan-grad)', sectionId:'echange',    sectionName:'Échange',     icon:'🔄' },
  840: { name:'USA',     code:'us', color:'#3C3B6E',                              sectionId:'paris',      sectionName:'Paris 2026',  icon:'⚡' },
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

// Which app section each confederation links to (only confs with a section)
const CONF_SECTION: Record<string, { sectionId: string; sectionName: string; icon: string }> = {
  CONMEBOL: { sectionId: 'packs',      sectionName: 'Mes Packs',   icon: '📦' },
  UEFA:     { sectionId: 'album',      sectionName: 'Mon Album',   icon: '📖' },
  CONCACAF: { sectionId: 'paris',      sectionName: 'Paris 2026',  icon: '⚡' },
  CAF:      { sectionId: 'classement', sectionName: 'Classement',  icon: '🏆' },
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
  isActive?: boolean
  continentRequest?: { conf: string; ts: number } | null
  onContinentShown?: () => void
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
export default function Globe({ onNavigate, isActive, continentRequest, onContinentShown }: GlobeProps) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const svgRef          = useRef<SVGSVGElement>(null)
  const [popup,              setPopup]              = useState<PopupState | null>(null)
  const [isLoaded,           setIsLoaded]           = useState(false)
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
      if (prev !== null) svg.select(`defs #clip-flag-${prev}`).remove()
      continentPrev.forEach(id => svg.select(`defs #clip-flag-${id}`).remove())
    }
    isRotRef.current = true
  }, [setPopupSync])

  // Close popup + reset zoom when the globe is hidden (user navigated away)
  useEffect(() => {
    if (isActive === false) {
      handleClose()
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
  onContinentShownRef.current  = onContinentShown

  // When Explorer is clicked: hide the React popup card but keep selectedRef + SVG flag,
  // then run the D3 projection zoom. navigate is called after the animation.
  const diveFromPopup = useCallback((sectionId: string) => {
    popupRef.current = null
    setPopup(null)
    postZoomAnimRef.current = null
    // Capture the current scale so the animation starts from exactly where the
    // user is — avoids the de-zoom glitch when they had already pinched in.
    const fromScale = projRef.current?.scale() ?? baseRRef.current
    diveAnimRef.current = { start: performance.now(), target: sectionId, fromScale }
  }, [])

  // Wait for the container to have real pixel dimensions before initialising D3.
  // On some mobile browsers (iOS Safari) the flex layout is not finalised at
  // mount time, so clientWidth/Height read as 0 → globe appears tiny at top-left.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (el.clientWidth >= 10 && el.clientHeight >= 10) { setReady(true); return }
    const ro = new ResizeObserver(() => {
      if (el.clientWidth >= 10 && el.clientHeight >= 10) { ro.disconnect(); setReady(true) }
    })
    ro.observe(el)
    return () => ro.disconnect()
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

    // ── Defs ──────────────────────────────────────────────────────────
    const defs = svg.append('defs')

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
    const gFlags      = svg.append('g').attr('class', 'g-flags')
    const gBorders    = svg.append('g').attr('class', 'g-borders')
    const gVig        = svg.append('g').attr('class', 'g-vig')   // vignette circle

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

    // ── Load world data ──────────────────────────────────────────────
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
      .then(r => r.json())
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
            const conf = QUALIFIED[id]?.conf
            if (conf) triggerContinentRef.current(conf)
          })

        // Country borders
        gBorders.append('path').datum(countries as any)
          .attr('d', geoPath as any).attr('fill', 'none')
          .attr('stroke', C.border).attr('stroke-width', '0.60')

setIsLoaded(true)

        if (pendingCenterRef.current !== undefined) {
          triggerCenterRef.current(pendingCenterRef.current)
          pendingCenterRef.current = undefined
        }

        // ── Animation loop ──────────────────────────────────────────
        let prevT = 0
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
              onNavigateRef.current(target)
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
                continentCountriesRef.current = ids
                applyContinent(conf, ids, featuresRef.current, geoPath, gFlags, defs)
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

          rafRef.current = requestAnimationFrame(animate)
        }
        rafRef.current = requestAnimationFrame(animate)
      })

    // ── Click-outside-to-close — click on ocean/non-featured area ──
    svg.on('click', (event: MouseEvent) => {
      const target = d3.select(event.target as Element)
      // Clicks on any qualified country are handled by their own click listeners
      if (target.classed('ft-featured') || target.classed('qual-country')) return
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
      {continentPopup && CONF_SECTION[continentPopup.conf] && (() => {
        const sec  = CONF_SECTION[continentPopup.conf]
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
              <span style={{ fontSize: 24, lineHeight: 1 }}>{sec.icon}</span>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.8,
                  color: `rgba(${r},${g},${b},0.85)`, textTransform: 'uppercase', marginBottom: 2,
                }}>
                  {continentPopup.conf}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                  {sec.sectionName}
                </div>
              </div>

              {/* CTA button */}
              <button
                onClick={() => {
                  setContinentPopup(null)
                  onNavigateRef.current(sec.sectionId)
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
  _conf: string,
  countryIds: number[],
  features: any[],
  geoPath: d3.GeoPath,
  gFlags: d3.Selection<SVGGElement, unknown, null, undefined>,
  defs:   d3.Selection<SVGDefsElement, unknown, null, undefined>,
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
    if (x1 - x0 < 1 || y1 - y0 < 1) return

    defs.append('clipPath').attr('id', `clip-flag-${id}`)
      .append('path').attr('d', pathStr)

    gFlags.append('image')
      .attr('href', `https://flagcdn.com/w640/${code}.png`)
      .attr('x', x0).attr('y', y0)
      .attr('width',  Math.max(x1 - x0, 1))
      .attr('height', Math.max(y1 - y0, 1))
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .attr('clip-path', `url(#clip-flag-${id})`)
      .attr('opacity', 0)
      .transition().delay(i * 50).duration(500).ease(d3.easeCubicOut)
      .attr('opacity', 0.92)
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
