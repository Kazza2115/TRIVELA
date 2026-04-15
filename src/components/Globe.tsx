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
  CONMEBOL: [0,   155, 58 ],  // Brazil green  #009B3A
  UEFA:     [198, 11,  30 ],  // Spain red     #C60B1E
  CONCACAF: [60,  59,  110],  // USA navy      #3C3B6E
  AFC:      [188, 0,   45 ],  // Japan crimson #BC002D
  CAF:      [252, 221, 9  ],  // Senegal gold  #FCDD09
  OFC:      [6,   182, 212],  // cyan (no featured country)
}

// ─── Qualified teams: ISO numeric ID → { conf, confRank } ───────────────────
// confRank = rank within the confederation (1 = best in that conf).
// England + Scotland both → ISO 826 (United Kingdom in world-atlas topojson).
const QUALIFIED: Record<number, { conf: string; confRank: number }> = {
  //  CONMEBOL — 7 teams, sorted by FIFA rank
  32:  { conf: 'CONMEBOL', confRank: 1 },  // Argentina
  76:  { conf: 'CONMEBOL', confRank: 2 },  // Brazil       ← featured
  170: { conf: 'CONMEBOL', confRank: 3 },  // Colombia
  858: { conf: 'CONMEBOL', confRank: 4 },  // Uruguay
  218: { conf: 'CONMEBOL', confRank: 5 },  // Ecuador
  600: { conf: 'CONMEBOL', confRank: 6 },  // Paraguay
  862: { conf: 'CONMEBOL', confRank: 7 },  // Venezuela
  //  UEFA — 19 teams, sorted by FIFA rank
  250: { conf: 'UEFA',     confRank:  1 },  // France
  724: { conf: 'UEFA',     confRank:  2 },  // Spain        ← featured
  826: { conf: 'UEFA',     confRank:  3 },  // England / Scotland (ISO 826)
  56:  { conf: 'UEFA',     confRank:  4 },  // Belgium
  620: { conf: 'UEFA',     confRank:  5 },  // Portugal
  528: { conf: 'UEFA',     confRank:  6 },  // Netherlands
  380: { conf: 'UEFA',     confRank:  7 },  // Italy
  276: { conf: 'UEFA',     confRank:  8 },  // Germany
  191: { conf: 'UEFA',     confRank:  9 },  // Croatia
  756: { conf: 'UEFA',     confRank: 10 },  // Switzerland
  208: { conf: 'UEFA',     confRank: 11 },  // Denmark
  804: { conf: 'UEFA',     confRank: 12 },  // Ukraine
  40:  { conf: 'UEFA',     confRank: 13 },  // Austria
  792: { conf: 'UEFA',     confRank: 14 },  // Turkey
  688: { conf: 'UEFA',     confRank: 15 },  // Serbia
  578: { conf: 'UEFA',     confRank: 16 },  // Norway
  752: { conf: 'UEFA',     confRank: 17 },  // Sweden
  203: { conf: 'UEFA',     confRank: 18 },  // Czech Republic
  70:  { conf: 'UEFA',     confRank: 19 },  // Bosnia-Herzegovina
  //  CONCACAF — 9 teams
  840: { conf: 'CONCACAF', confRank: 1 },  // USA          ← featured
  484: { conf: 'CONCACAF', confRank: 2 },  // Mexico
  124: { conf: 'CONCACAF', confRank: 3 },  // Canada
  188: { conf: 'CONCACAF', confRank: 4 },  // Costa Rica
  591: { conf: 'CONCACAF', confRank: 5 },  // Panama
  388: { conf: 'CONCACAF', confRank: 6 },  // Jamaica
  340: { conf: 'CONCACAF', confRank: 7 },  // Honduras
  332: { conf: 'CONCACAF', confRank: 8 },  // Haiti
  531: { conf: 'CONCACAF', confRank: 9 },  // Curaçao
  //  AFC — 9 teams
  392: { conf: 'AFC',      confRank: 1 },  // Japan        ← featured
  410: { conf: 'AFC',      confRank: 2 },  // South Korea
  36:  { conf: 'AFC',      confRank: 3 },  // Australia
  364: { conf: 'AFC',      confRank: 4 },  // Iran
  682: { conf: 'AFC',      confRank: 5 },  // Saudi Arabia
  634: { conf: 'AFC',      confRank: 6 },  // Qatar
  400: { conf: 'AFC',      confRank: 7 },  // Jordan
  368: { conf: 'AFC',      confRank: 8 },  // Iraq
  860: { conf: 'AFC',      confRank: 9 },  // Uzbekistan
  //  CAF — 12 teams
  504: { conf: 'CAF',      confRank:  1 },  // Morocco
  686: { conf: 'CAF',      confRank:  2 },  // Senegal      ← featured
  384: { conf: 'CAF',      confRank:  3 },  // Ivory Coast
  818: { conf: 'CAF',      confRank:  4 },  // Egypt
  566: { conf: 'CAF',      confRank:  5 },  // Nigeria
  710: { conf: 'CAF',      confRank:  6 },  // South Africa
  788: { conf: 'CAF',      confRank:  7 },  // Tunisia
  12:  { conf: 'CAF',      confRank:  8 },  // Algeria
  120: { conf: 'CAF',      confRank:  9 },  // Cameroon
  288: { conf: 'CAF',      confRank: 10 },  // Ghana
  180: { conf: 'CAF',      confRank: 11 },  // DR Congo
  132: { conf: 'CAF',      confRank: 12 },  // Cabo Verde
  //  OFC — 1 team
  554: { conf: 'OFC',      confRank: 1 },  // New Zealand
}

// Total teams per confederation (for normalising the rank factor)
const CONF_TOTAL: Record<string, number> = {
  CONMEBOL: 7, UEFA: 19, CONCACAF: 9, AFC: 9, CAF: 12, OFC: 1,
}

function landColor(numericId: number): string {
  const q = QUALIFIED[numericId]
  if (!q) return 'rgba(128,133,142,0.90)'  // non-qualified: medium slate
  const total  = CONF_TOTAL[q.conf]
  // factor 1.0 = #1 in confederation (most vivid), 0.0 = last
  const factor = total > 1 ? 1 - (q.confRank - 1) / (total - 1) : 1
  // Mix 30% (weakest) → 70% (strongest) — blended into dark grey base for richer colors
  const mix    = 0.30 + factor * 0.40
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
}
interface PopupState { countryId: number; x: number; y: number }
interface CenteringState {
  startRot: [number, number]; targetRot: [number, number]
  startTime: number; countryId: number; feature: any
}

function shortestPath(from: number, to: number): number {
  return from + ((to - from + 540) % 360 - 180)
}

// ─── Component ────────────────────────────────────────────────────────────
export default function Globe({ onNavigate, isActive }: GlobeProps) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const svgRef          = useRef<SVGSVGElement>(null)
  const [popup,    setPopup]    = useState<PopupState | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

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

  const setPopupSync = useCallback((p: PopupState | null) => {
    popupRef.current    = p
    selectedRef.current = p ? p.countryId : null
    setPopup(p)
  }, [])

  const handleClose = useCallback(() => {
    const prev = selectedRef.current
    setPopupSync(null)
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.select('.g-flags').selectAll('*').remove()
      if (prev !== null) {
        svg.select(`defs #clip-flag-${prev}`).remove()
        svg.select(`.ft-country.country-${prev}`).classed('selected', false)
          .attr('fill', FEATURED[prev]?.svgFill ?? FEATURED[prev]?.color ?? '')
          .attr('stroke', 'rgba(0,0,0,0.15)')
      }
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

  const triggerCenter = useCallback((countryId: number) => {
    if (featuresRef.current.length === 0) { pendingCenterRef.current = countryId; return }
    const feat = featuresRef.current.find((f: any) => parseInt(f.id) === countryId)
    if (!feat) return
    const [lon, lat] = d3.geoCentroid(feat)
    if (popupRef.current) {
      const prev = selectedRef.current
      setPopupSync(null)
      if (svgRef.current) {
        const svg = d3.select(svgRef.current)
        svg.select('.g-flags').selectAll('*').remove()
        if (prev !== null) {
          svg.select(`defs #clip-flag-${prev}`).remove()
          svg.select(`.ft-country.country-${prev}`).classed('selected', false)
            .attr('fill', FEATURED[prev]?.svgFill ?? FEATURED[prev]?.color ?? '')
            .attr('stroke', 'rgba(0,0,0,0.15)')
        }
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

  triggerCenterRef.current = triggerCenter
  onNavigateRef.current    = onNavigate

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

  useEffect(() => {
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
    const gSphere    = svg.append('g').attr('class', 'g-sphere')
    const gGrid      = svg.append('g').attr('class', 'g-grid')
    const gBgCountry = svg.append('g').attr('class', 'g-bg-countries')
    const gFtCountry = svg.append('g').attr('class', 'g-ft-countries')
    const gFlags     = svg.append('g').attr('class', 'g-flags')
    const gBorders   = svg.append('g').attr('class', 'g-borders')
const gVig       = svg.append('g').attr('class', 'g-vig')   // vignette circle

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

        // Background countries — grouped by color (180+ paths → ~7)
        const colorGroups = new Map<string, any[]>()
        features.filter((d: any) => !FEATURED[parseInt(d.id)]).forEach((feat: any) => {
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

        // Featured countries — vivid flag colors
        gFtCountry.selectAll('.ft-country')
          .data(features.filter((d: any) => FEATURED[parseInt(d.id)]))
          .join('path')
          .attr('class', (d: any) => `ft-country ft-featured country-${parseInt(d.id)}`)
          .attr('d', geoPath as any)
          .attr('fill',   (d: any) => FEATURED[parseInt(d.id)].svgFill ?? FEATURED[parseInt(d.id)].color)
          .attr('stroke', 'rgba(0,0,0,0.30)')
          .attr('stroke-width', '0.7')
          .style('cursor', 'pointer')
          .on('click', (_event: MouseEvent, d: any) => {
            if (diveAnimRef.current) return   // ignore clicks during dive
            const id = parseInt(d.id)
            if (!FEATURED[id]) return
            triggerCenterRef.current(id)
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
              velRef.current   = { x: 0, y: 0 }
              isRotRef.current = true
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
              const { countryId, feature: feat } = centeringRef.current
              centeringRef.current = null
              postZoomAnimRef.current = { start: t, from: 1.14, to: 1.0 }
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
            gFtCountry.selectAll('.ft-country').attr('d', geoPath as any)
            gBorders.select('path').attr('d', geoPath as any)

            // Vignette + gradient sync
            gVig.select('circle').attr('r', curR)
            defs.select('#sphere-grad')
              .attr('cx', W / 2 - 0.3 * curR).attr('cy', H / 2 - 0.4 * curR).attr('r', 1.3 * curR)
            defs.select('#vig-grad')
              .attr('cx', W / 2).attr('cy', H / 2).attr('r', curR)

            // Flag overlay + popup anchor (single feature lookup)
            if (selectedRef.current !== null) {
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
      // If click is on a featured country, triggerCenter handles it
      if (target.classed('ft-featured')) return
      // Otherwise close popup if one is open
      if (selectedRef.current !== null) {
        const prev = selectedRef.current
        popupRef.current = null
        selectedRef.current = null
        setPopup(null)
        gFlags.selectAll('*').remove()
        defs.select(`#clip-flag-${prev}`).remove()
        svg.select(`.ft-country.country-${prev}`).classed('selected', false)
          .attr('fill', FEATURED[prev]?.svgFill ?? FEATURED[prev]?.color ?? '')
          .attr('stroke', 'rgba(0,0,0,0.15)')
        isRotRef.current = true
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    </div>
  )
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
