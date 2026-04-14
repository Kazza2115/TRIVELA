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
function landColor(_numericId: number): string {
  return 'rgba(245,246,248,0.72)'
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

// ─── Ocean labels ─────────────────────────────────────────────────────────
// Placed deep in each ocean basin — far from any coastline.
// South Atlantic chosen (widest stretch) so text doesn't touch land on mobile.
const OCEAN_LABELS: { lon: number; lat: number; name: string; rot: number }[] = [
  { lon: -135, lat:  10, name: 'PACIFIQUE',   rot: -4 },  // E. Pacific deep water
  { lon:  175, lat:   5, name: 'PACIFIQUE',   rot:  4 },  // W. Pacific deep water
  { lon:  -12, lat: -35, name: 'ATLANTIQUE',  rot: -6 },  // South Atlantic (widest)
  { lon:   78, lat: -30, name: 'INDIEN',      rot:  5 },  // Central Indian Ocean
]

interface GlobeProps {
  onNavigate: (section: string) => void
  centerRequest?: { id: number; ts: number } | null
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
export default function Globe({ onNavigate, centerRequest }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
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

  useEffect(() => {
    if (!centerRequest) return
    triggerCenterRef.current(centerRequest.id)
  }, [centerRequest])

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

    // Ocean — soft cartoon gradient, userSpaceOnUse so coords update with zoom
    const sphereGrad = defs.append('radialGradient').attr('id', 'sphere-grad')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('cx', W / 2 - 0.3 * R).attr('cy', H / 2 - 0.4 * R).attr('r', 1.3 * R)
    sphereGrad.append('stop').attr('offset', '0%').attr('stop-color', '#5496C8')
    sphereGrad.append('stop').attr('offset', '55%').attr('stop-color', '#3C74A6')
    sphereGrad.append('stop').attr('offset', '100%').attr('stop-color', '#285880')

    // Subtle vignette on the globe edge (userSpaceOnUse so it tracks zoom)
    const vigGrad = defs.append('radialGradient').attr('id', 'vig-grad')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('cx', W / 2).attr('cy', H / 2).attr('r', R)
    vigGrad.append('stop').attr('offset', '60%').attr('stop-color', 'transparent')
    vigGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0.18)')

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
    const gOceanText = svg.append('g').attr('class', 'g-ocean-text')
    const gVig       = svg.append('g').attr('class', 'g-vig')   // vignette circle

    // Ocean sphere
    const sphereShape = { type: 'Sphere' } as Parameters<typeof geoPath>[0]
    gSphere.append('path').datum(sphereShape).attr('d', geoPath)
      .attr('fill', 'url(#sphere-grad)')
      .attr('stroke', '#1F4666').attr('stroke-width', '1')

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

        // Background countries — deterministic cartoon palette
        gBgCountry.selectAll('.bg-country')
          .data(features.filter((d: any) => !FEATURED[parseInt(d.id)]))
          .join('path')
          .attr('class', 'bg-country')
          .attr('d', geoPath as any)
          .attr('fill', (d: any) => landColor(parseInt(d.id)))
          .attr('stroke', C.bgStroke)
          .attr('stroke-width', '0.4')

        // Featured countries — cartoon colors, no glow
        gFtCountry.selectAll('.ft-country')
          .data(features.filter((d: any) => FEATURED[parseInt(d.id)]))
          .join('path')
          .attr('class', (d: any) => `ft-country ft-featured country-${parseInt(d.id)}`)
          .attr('d', geoPath as any)
          .attr('fill',   (d: any) => FEATURED[parseInt(d.id)].svgFill ?? FEATURED[parseInt(d.id)].color)
          .attr('stroke', 'rgba(0,0,0,0.15)')
          .attr('stroke-width', '0.6')
          .style('cursor', 'pointer')
          .on('click', (_event: MouseEvent, d: any) => {
            const id = parseInt(d.id)
            if (!FEATURED[id]) return
            triggerCenterRef.current(id)
          })

        // Country borders
        gBorders.append('path').datum(countries as any)
          .attr('d', geoPath as any).attr('fill', 'none')
          .attr('stroke', C.border).attr('stroke-width', '0.60')

        // Ocean labels — barely-visible tint, same colour family as the ocean water
        OCEAN_LABELS.forEach(({ lon, lat, name, rot }) => {
          gOceanText.append('text')
            .attr('class', 'ocean-label')
            .attr('text-anchor', 'middle')
            .attr('font-family', "'Bebas Neue', cursive")
            .attr('font-style', 'italic')
            .attr('font-size', Math.min(Math.max(10, R * 0.08), 13))
            .attr('letter-spacing', 4)
            .attr('fill', 'rgba(160,200,230,0.55)')
            .attr('pointer-events', 'none')
            .attr('transform', () => {
              const p = proj([lon, lat])
              return p ? `translate(${p[0]},${p[1]}) rotate(${rot})` : ''
            })
            .text(name)
        })

        setIsLoaded(true)

        if (pendingCenterRef.current !== undefined) {
          triggerCenterRef.current(pendingCenterRef.current)
          pendingCenterRef.current = undefined
        }

        // ── Animation loop ──────────────────────────────────────────
        let prevT = 0
        const animate = (t: number) => {
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
                // Selected: brighten fill + white outline
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

          // Redraw all geo paths
          gSphere.select('path').attr('d', geoPath(sphereShape) ?? '')
          gGrid.select('path').attr('d', geoPath as any)
          gBgCountry.selectAll('.bg-country').attr('d', geoPath as any)
          gFtCountry.selectAll('.ft-country').attr('d', geoPath as any)
          gBorders.select('path').attr('d', geoPath as any)

          // Keep vignette circle in sync with globe radius
          const curR = proj.scale()
          gVig.select('circle').attr('r', curR)

          // Sync userSpaceOnUse gradient coordinates with current zoom radius
          defs.select('#sphere-grad')
            .attr('cx', W / 2 - 0.3 * curR)
            .attr('cy', H / 2 - 0.4 * curR)
            .attr('r',  1.3 * curR)
          defs.select('#vig-grad')
            .attr('cx', W / 2)
            .attr('cy', H / 2)
            .attr('r',  curR)

          // Update ocean labels — move + fade when rotating to back side
          gOceanText.selectAll<SVGTextElement, unknown>('.ocean-label')
            .each(function (_, i) {
              const { lon, lat, rot } = OCEAN_LABELS[i]
              const p = proj([lon, lat])
              // Angular distance from globe center to label position
              const d = d3.geoDistance(
                [lon, lat],
                [-proj.rotate()[0], -proj.rotate()[1]],
              )
              // Wide fade zone — labels dissolve long before the horizon
              const maxD     = Math.PI / 2
              const fadeZone = 0.65  // ~37° — labels gone well before the limb
              const alpha = d < maxD - fadeZone ? 1
                : d < maxD ? (maxD - d) / fadeZone
                : 0
              d3.select(this)
                .attr('transform', p ? `translate(${p[0]},${p[1]}) rotate(${rot})` : '')
                .attr('opacity', alpha * 0.42)
                .attr('font-size', Math.min(Math.max(11, curR * 0.09), 15))
            })

          // ── CRITICAL FIX: update flag overlay every frame ──────────
          // Without this, the flag image drifts when zooming because its
          // SVG x/y/w/h and clip-path were computed at selection time only.
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
            }
          }

          // Keep popup wrapper anchored to country centroid during zoom/pan
          if (selectedRef.current !== null && popupWrapRef.current) {
            const selFeat = featuresRef.current.find(
              (f: any) => parseInt(f.id) === selectedRef.current
            )
            if (selFeat) {
              const c = geoPath.centroid(selFeat as any)
              if (isFinite(c[0]) && isFinite(c[1])) {
                popupWrapRef.current.style.left = c[0] + 'px'
                popupWrapRef.current.style.top  = c[1] + 'px'
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
            onNavigate={onNavigate}
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
