import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import CountryPopup from './CountryPopup'

// ─── Featured countries config ─────────────────────────────────────────────
// color is kept for the popup accent; the globe itself is monochrome
export const FEATURED: Record<number, {
  name: string; code: string; color: string
  sectionId: string; sectionName: string; icon: string
}> = {
  76:  { name: 'Brésil',  code: 'br', color: '#009C3B', sectionId: 'packs',      sectionName: 'Mes Packs',   icon: '📦' },
  686: { name: 'Sénégal', code: 'sn', color: '#00A550', sectionId: 'classement', sectionName: 'Classement',  icon: '🏆' },
  756: { name: 'Suisse',  code: 'ch', color: '#FF0000', sectionId: 'album',      sectionName: 'Mon Album',   icon: '📖' },
  392: { name: 'Japon',   code: 'jp', color: '#BC002D', sectionId: 'echange',    sectionName: 'Échange',     icon: '🔄' },
  840: { name: 'USA',     code: 'us', color: '#3C3B6E', sectionId: 'defis',      sectionName: 'Défis',       icon: '⚡' },
}

// ─── Monochrome palette ────────────────────────────────────────────────────
const C = {
  bgFill:   'rgba(200,215,240,0.06)',
  bgStroke: 'rgba(200,215,240,0.13)',
  ftFill:   'rgba(215,232,255,0.13)',
  ftStroke: 'rgba(215,232,255,0.50)',
  grid:     'rgba(140,170,215,0.05)',
  border:   'rgba(190,210,240,0.10)',
}

// ─── Types ─────────────────────────────────────────────────────────────────
interface GlobeProps {
  onNavigate: (section: string) => void
  /** Pass a new object each time to trigger centering (even same country twice) */
  centerRequest?: { id: number; ts: number } | null
}

interface PopupState { countryId: number; x: number; y: number }

interface CenteringState {
  startRot: [number, number]
  targetRot: [number, number]
  startTime: number
  countryId: number
  feature: any
}

// ─── Component ────────────────────────────────────────────────────────────
export default function Globe({ onNavigate, centerRequest }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const [popup,    setPopup]    = useState<PopupState | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // ── D3 / animation refs ────────────────────────────────────────────
  const projRef      = useRef<d3.GeoProjection | null>(null)
  const pathRef      = useRef<d3.GeoPath | null>(null)
  const rafRef       = useRef<number>(0)
  const rotRef       = useRef<[number, number]>([-10, -25])
  const isRotRef     = useRef(true)
  const dragRef      = useRef({ on: false, ox: 0, oy: 0 })
  const popupRef     = useRef<PopupState | null>(null)
  const selectedRef  = useRef<number | null>(null)
  const featuresRef  = useRef<any[]>([])
  const centeringRef = useRef<CenteringState | null>(null)

  // Stable ref to triggerCenter so the main useEffect (dep: []) can call the
  // latest version without needing to re-run.
  const triggerCenterRef = useRef<(id: number) => void>(() => {})

  // Queued request when world hasn't loaded yet
  const pendingCenterRef = useRef<number | undefined>(undefined)

  // ── Sync popup state ↔ refs ────────────────────────────────────────
  const setPopupSync = useCallback((p: PopupState | null) => {
    popupRef.current   = p
    selectedRef.current = p ? p.countryId : null
    setPopup(p)
  }, [])

  // ── Close popup & restore globe ────────────────────────────────────
  const handleClose = useCallback(() => {
    const prev = selectedRef.current
    setPopupSync(null)
    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.select('.g-flags').selectAll('*').remove()
      if (prev !== null) {
        svg.select(`defs #clip-flag-${prev}`).remove()
        svg.select(`.ft-country.country-${prev}`).classed('selected', false)
      }
    }
    isRotRef.current = true
  }, [setPopupSync])

  // ── Trigger smooth centering animation ─────────────────────────────
  const triggerCenter = useCallback((countryId: number) => {
    if (featuresRef.current.length === 0) {
      pendingCenterRef.current = countryId
      return
    }
    const feat = featuresRef.current.find((f: any) => parseInt(f.id) === countryId)
    if (!feat) return

    const [lon, lat] = d3.geoCentroid(feat)
    const targetRot: [number, number] = [-lon, -lat]

    // Close any open popup first
    if (popupRef.current) {
      const prev = selectedRef.current
      setPopupSync(null)
      if (svgRef.current) {
        const svg = d3.select(svgRef.current)
        svg.select('.g-flags').selectAll('*').remove()
        if (prev !== null) {
          svg.select(`defs #clip-flag-${prev}`).remove()
          svg.select(`.ft-country.country-${prev}`).classed('selected', false)
        }
      }
    }

    isRotRef.current  = false
    centeringRef.current = {
      startRot: [...rotRef.current] as [number, number],
      targetRot,
      startTime: performance.now(),
      countryId,
      feature: feat,
    }
  }, [setPopupSync])

  // Keep the ref up-to-date
  triggerCenterRef.current = triggerCenter

  // ── React to centerRequest prop ────────────────────────────────────
  useEffect(() => {
    if (!centerRequest) return
    triggerCenterRef.current(centerRequest.id)
  }, [centerRequest])

  // ── Main D3 setup (runs once) ──────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el || !svgRef.current) return

    const W = el.clientWidth
    const H = el.clientHeight
    const R = Math.min(W, H) * 0.36   // ← smaller globe

    // Projection
    const proj = d3.geoOrthographic()
      .scale(R)
      .translate([W / 2, H / 2])
      .clipAngle(90)
      .rotate(rotRef.current)
    projRef.current = proj

    const geoPath = d3.geoPath(proj)
    pathRef.current = geoPath

    const svg = d3.select(svgRef.current)
      .attr('width', W)
      .attr('height', H)

    svg.selectAll('*').remove()

    // ── Defs ──────────────────────────────────────────────────────────
    const defs = svg.append('defs')

    // Atmosphere gradient
    const atmoGrad = defs.append('radialGradient')
      .attr('id', 'atmo-grad').attr('cx', '50%').attr('cy', '50%').attr('r', '50%')
    atmoGrad.append('stop').attr('offset', '76%').attr('stop-color', 'transparent')
    atmoGrad.append('stop').attr('offset', '89%').attr('stop-color', '#1a4a8a').attr('stop-opacity', '0.28')
    atmoGrad.append('stop').attr('offset', '100%').attr('stop-color', '#050e24').attr('stop-opacity', '0')

    // Ocean sphere gradient
    const sphereGrad = defs.append('radialGradient')
      .attr('id', 'sphere-grad').attr('cx', '34%').attr('cy', '28%').attr('r', '66%')
    sphereGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0d1f3c')
    sphereGrad.append('stop').attr('offset', '100%').attr('stop-color', '#030810')

    // ── Layer groups (back → front) ────────────────────────────────────
    const gAtmo      = svg.append('g').attr('class', 'g-atmo')
    const gSphere    = svg.append('g').attr('class', 'g-sphere')
    const gGrid      = svg.append('g').attr('class', 'g-grid')
    const gBgCountry = svg.append('g').attr('class', 'g-bg-countries')
    const gFtCountry = svg.append('g').attr('class', 'g-ft-countries')
    const gFlags     = svg.append('g').attr('class', 'g-flags')
    const gBorders   = svg.append('g').attr('class', 'g-borders')
    const gAtmoTop   = svg.append('g').attr('class', 'g-atmo-top')

    // Halo
    gAtmo.append('circle')
      .attr('cx', W / 2).attr('cy', H / 2).attr('r', R + 20)
      .attr('fill', 'url(#atmo-grad)')

    // Ocean
    const sphereShape = { type: 'Sphere' } as Parameters<typeof geoPath>[0]
    gSphere.append('path')
      .datum(sphereShape)
      .attr('d', geoPath)
      .attr('fill', 'url(#sphere-grad)')
      .attr('stroke', '#0f1e38')
      .attr('stroke-width', '0.5')

    // Graticule
    gGrid.append('path')
      .datum(d3.geoGraticule().step([20, 20])())
      .attr('d', geoPath)
      .attr('fill', 'none')
      .attr('stroke', C.grid)
      .attr('stroke-width', '0.5')

    // Rim light
    gAtmoTop.append('circle')
      .attr('cx', W / 2).attr('cy', H / 2).attr('r', R + 1)
      .attr('fill', 'none')
      .attr('stroke', '#2a5aaa')
      .attr('stroke-width', '2.5')
      .attr('opacity', '0.16')

    // ── Load world data ────────────────────────────────────────────────
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
      .then(r => r.json())
      .then((world: Topology) => {
        const countries = feature(world, (world as any).objects.countries) as any
        if (!countries.features) return
        const features: any[] = countries.features
        featuresRef.current = features

        // Background countries — monochrome
        gBgCountry.selectAll('.bg-country')
          .data(features)
          .join('path')
          .attr('class', (d: any) =>
            FEATURED[parseInt(d.id)] ? 'hidden-path' : 'bg-country'
          )
          .attr('d', geoPath as any)
          .attr('fill', C.bgFill)
          .attr('stroke', C.bgStroke)
          .attr('stroke-width', '0.4')

        // Featured countries — monochrome + white pulse
        gFtCountry.selectAll('.ft-country')
          .data(features.filter((d: any) => FEATURED[parseInt(d.id)]))
          .join('path')
          .attr('class', (d: any) => `ft-country country-${parseInt(d.id)} pulse-featured`)
          .attr('d', geoPath as any)
          .attr('fill', C.ftFill)
          .attr('stroke', C.ftStroke)
          .attr('stroke-width', '0.9')
          .style('cursor', 'pointer')
          .on('click', (event: MouseEvent, d: any) => {
            const id = parseInt(d.id)
            if (!FEATURED[id]) return
            isRotRef.current = false

            const [mx, my] = d3.pointer(event, svgRef.current)
            const centroid  = geoPath.centroid(d as any)
            const px = isFinite(mx) ? mx : centroid[0]
            const py = isFinite(my) ? my : centroid[1]

            applyFlag(id, d, geoPath, gFlags, defs)
            gFtCountry.select(`.country-${id}`).classed('selected', true)
            setPopupSync({ countryId: id, x: px, y: py })
          })

        // Border mesh
        gBorders.append('path')
          .datum(countries as any)
          .attr('d', geoPath as any)
          .attr('fill', 'none')
          .attr('stroke', C.border)
          .attr('stroke-width', '0.35')

        setIsLoaded(true)

        // Apply any pending center request
        if (pendingCenterRef.current !== undefined) {
          triggerCenterRef.current(pendingCenterRef.current)
          pendingCenterRef.current = undefined
        }

        // ── Animation loop ────────────────────────────────────────────
        let prevT = 0
        const animate = (t: number) => {
          const dt = prevT === 0 ? 0 : Math.min((t - prevT) / 1000, 0.05)
          prevT = t

          // Auto-rotation (paused while popup open or centering)
          if (isRotRef.current && !selectedRef.current && !centeringRef.current) {
            rotRef.current[0] += dt * 5.5
            proj.rotate(rotRef.current)
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

            if (progress >= 1) {
              const { countryId, feature: feat } = centeringRef.current
              centeringRef.current = null

              // Show popup at the now-centered country
              const centroid = geoPath.centroid(feat as any)
              if (isFinite(centroid[0]) && isFinite(centroid[1])) {
                applyFlag(countryId, feat, geoPath, gFlags, defs)
                gFtCountry.select(`.country-${countryId}`).classed('selected', true)
                setPopupSync({ countryId, x: centroid[0], y: centroid[1] })
              }
            }
          }

          // Update all geo-dependent paths
          gSphere.select('path').attr('d', geoPath(sphereShape) ?? '')
          gGrid.select('path').attr('d', geoPath as any)
          gBgCountry.selectAll('.bg-country').attr('d', geoPath as any)
          gFtCountry.selectAll('.ft-country').attr('d', geoPath as any)
          gBorders.select('path').attr('d', geoPath as any)

          rafRef.current = requestAnimationFrame(animate)
        }
        rafRef.current = requestAnimationFrame(animate)
      })

    // ── Drag / touch rotate ────────────────────────────────────────────
    const dragBehavior = d3.drag<SVGSVGElement, unknown>()
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
        proj.rotate(rotRef.current)
      })
      .on('end', () => {
        dragRef.current.on = false
        if (!selectedRef.current) isRotRef.current = true
      })

    svg.call(dragBehavior as any)

    return () => { cancelAnimationFrame(rafRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        style={{ display: 'block', touchAction: 'none', userSelect: 'none', cursor: 'grab' }}
        onMouseDown={() => { if (svgRef.current) svgRef.current.style.cursor = 'grabbing' }}
        onMouseUp={()   => { if (svgRef.current) svgRef.current.style.cursor = 'grab' }}
      />

      {/* Loading */}
      {!isLoaded && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          color: 'var(--text-secondary)',
        }}>
          <div style={{
            width: 30, height: 30,
            border: '2px solid rgba(255,255,255,0.08)',
            borderTopColor: 'rgba(180,210,255,0.55)',
            borderRadius: '50%',
            animation: 'spin 0.75s linear infinite',
          }} />
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
            Chargement…
          </span>
        </div>
      )}

      {/* Country popup */}
      {popup && (
        <CountryPopup
          countryId={popup.countryId}
          x={popup.x}
          y={popup.y}
          onNavigate={onNavigate}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

// ─── Flag overlay helper ───────────────────────────────────────────────────
function applyFlag(
  id: number,
  featureData: any,
  geoPath: d3.GeoPath,
  gFlags: d3.Selection<SVGGElement, unknown, null, undefined>,
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
) {
  gFlags.selectAll('*').remove()
  defs.select(`#clip-flag-${id}`).remove()

  const pathStr = geoPath(featureData as any)
  if (!pathStr) return

  const [[x0, y0], [x1, y1]] = geoPath.bounds(featureData as any)
  const w = Math.max(x1 - x0, 1)
  const h = Math.max(y1 - y0, 1)

  defs.append('clipPath')
    .attr('id', `clip-flag-${id}`)
    .append('path').attr('d', pathStr)

  gFlags.append('image')
    .attr('href', `https://flagcdn.com/w640/${FEATURED[id].code}.png`)
    .attr('x', x0).attr('y', y0)
    .attr('width', w).attr('height', h)
    .attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('clip-path', `url(#clip-flag-${id})`)
    .attr('opacity', 0)
    .transition().duration(550).ease(d3.easeCubicOut)
    .attr('opacity', 0.88)
}
