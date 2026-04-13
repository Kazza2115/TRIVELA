import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import CountryPopup from './CountryPopup'

// ─── Featured countries ────────────────────────────────────────────────────
export const FEATURED: Record<number, {
  name: string; code: string; color: string; pulseClass: string
  sectionId: string; sectionName: string; icon: string
}> = {
  76:  { name:'Brésil',  code:'br', color:'#009C3B', pulseClass:'pulse-brazil',   sectionId:'packs',      sectionName:'Mes Packs',   icon:'📦' },
  686: { name:'Sénégal', code:'sn', color:'#00A550', pulseClass:'pulse-senegal',  sectionId:'classement', sectionName:'Classement',  icon:'🏆' },
  724: { name:'Espagne', code:'es', color:'#C60B1E', pulseClass:'pulse-espagne',  sectionId:'album',      sectionName:'Mon Album',   icon:'📖' },
  392: { name:'Japon',   code:'jp', color:'#BC002D', pulseClass:'pulse-japon',    sectionId:'echange',    sectionName:'Échange',     icon:'🔄' },
  840: { name:'USA',     code:'us', color:'#3C3B6E', pulseClass:'pulse-usa',      sectionId:'paris',      sectionName:'Paris 2026',  icon:'⚡' },
}

// ─── Globe palette ─────────────────────────────────────────────────────────
const C = {
  bgFill:   '#1c2d42',
  bgStroke: 'rgba(80, 130, 200, 0.22)',
  grid:     'rgba(120, 170, 255, 0.04)',
  border:   'rgba(60, 110, 180, 0.18)',
}

interface GlobeProps {
  onNavigate: (section: string) => void
  centerRequest?: { id: number; ts: number } | null
}
interface PopupState { countryId: number; x: number; y: number }
interface CenteringState {
  startRot: [number, number]; targetRot: [number, number]
  startTime: number; countryId: number; feature: any
}

// ─── Helpers ──────────────────────────────────────────────────────────────
/** Returns the equivalent of `to` that is within 180° of `from` (shortest arc). */
function shortestPath(from: number, to: number): number {
  return from + ((to - from + 540) % 360 - 180)
}

// ─── Component ────────────────────────────────────────────────────────────
export default function Globe({ onNavigate, centerRequest }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const [popup,    setPopup]    = useState<PopupState | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

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
        }
      }
    }
    isRotRef.current      = false
    velRef.current        = { x: 0, y: 0 }
    postZoomAnimRef.current = null
    centeringRef.current  = {
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
    const R = Math.min(W, H) * 0.26   // ← compact globe
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

    // Soft atmosphere halo
    const atmoGrad = defs.append('radialGradient').attr('id','atmo-grad')
      .attr('cx','50%').attr('cy','50%').attr('r','50%')
    atmoGrad.append('stop').attr('offset','74%').attr('stop-color','transparent')
    atmoGrad.append('stop').attr('offset','88%').attr('stop-color','#2a5cb8').attr('stop-opacity','.18')
    atmoGrad.append('stop').attr('offset','97%').attr('stop-color','#5090e0').attr('stop-opacity','.06')
    atmoGrad.append('stop').attr('offset','100%').attr('stop-color','transparent')

    // Ocean sphere
    const sphereGrad = defs.append('radialGradient').attr('id','sphere-grad')
      .attr('cx','32%').attr('cy','26%').attr('r','65%')
    sphereGrad.append('stop').attr('offset','0%').attr('stop-color','#3d82da')
    sphereGrad.append('stop').attr('offset','60%').attr('stop-color','#1f52a2')
    sphereGrad.append('stop').attr('offset','100%').attr('stop-color','#0e2c5e')

    // Gold rim glow filter
    const rimFilter = defs.append('filter').attr('id','rim-glow').attr('x','-20%').attr('y','-20%').attr('width','140%').attr('height','140%')
    rimFilter.append('feGaussianBlur').attr('in','SourceGraphic').attr('stdDeviation','2').attr('result','blur')

    // ── Layer groups ──────────────────────────────────────────────────
    const gAtmo      = svg.append('g').attr('class','g-atmo')
    const gSphere    = svg.append('g').attr('class','g-sphere')
    const gGrid      = svg.append('g').attr('class','g-grid')
    const gBgCountry = svg.append('g').attr('class','g-bg-countries')
    const gFtCountry = svg.append('g').attr('class','g-ft-countries')
    const gFlags     = svg.append('g').attr('class','g-flags')
    const gBorders   = svg.append('g').attr('class','g-borders')
    const gRim       = svg.append('g').attr('class','g-rim')

    // Atmosphere halo
    gAtmo.append('circle').attr('cx',W/2).attr('cy',H/2).attr('r',R+32)
      .attr('fill','url(#atmo-grad)')

    // Ocean
    const sphereShape = { type:'Sphere' } as Parameters<typeof geoPath>[0]
    gSphere.append('path').datum(sphereShape).attr('d',geoPath)
      .attr('fill','url(#sphere-grad)').attr('stroke','rgba(30,80,170,0.45)').attr('stroke-width','0.6')

    // Graticule — barely visible
    gGrid.append('path').datum(d3.geoGraticule().step([30,30])())
      .attr('d',geoPath).attr('fill','none').attr('stroke',C.grid).attr('stroke-width','0.5')

    // Clean gold rim
    gRim.append('circle').attr('cx',W/2).attr('cy',H/2).attr('r',R+1)
      .attr('fill','none').attr('stroke','#C89B3C').attr('stroke-width','0.8').attr('opacity','.18')

    // ── Load world data ────────────────────────────────────────────────
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
      .then(r => r.json())
      .then((world: Topology) => {
        const countries = feature(world, (world as any).objects.countries) as any
        if (!countries.features) return
        const features: any[] = countries.features
        featuresRef.current = features

        // ── Background countries (non-featured only — FIX: no bleed-through) ──
        gBgCountry.selectAll('.bg-country')
          .data(features.filter((d: any) => !FEATURED[parseInt(d.id)]))
          .join('path')
          .attr('class', 'bg-country')
          .attr('d', geoPath as any)
          .attr('fill', C.bgFill)
          .attr('stroke', C.bgStroke)
          .attr('stroke-width', '0.5')

        // ── Featured countries (national colour + glow pulse) ──────────
        gFtCountry.selectAll('.ft-country')
          .data(features.filter((d: any) => FEATURED[parseInt(d.id)]))
          .join('path')
          .attr('class', (d: any) => {
            const id = parseInt(d.id)
            return `ft-country country-${id} ${FEATURED[id].pulseClass}`
          })
          .attr('d', geoPath as any)
          .attr('fill',   (d: any) => FEATURED[parseInt(d.id)].color)
          .attr('stroke', (d: any) => FEATURED[parseInt(d.id)].color)
          .attr('stroke-width', '0.8')
          .style('cursor', 'pointer')
          .on('click', (_event: MouseEvent, d: any) => {
            const id = parseInt(d.id)
            if (!FEATURED[id]) return
            triggerCenterRef.current(id)
          })

        // Border mesh
        gBorders.append('path').datum(countries as any)
          .attr('d', geoPath as any).attr('fill','none')
          .attr('stroke', C.border).attr('stroke-width','0.4')

        setIsLoaded(true)

        if (pendingCenterRef.current !== undefined) {
          triggerCenterRef.current(pendingCenterRef.current)
          pendingCenterRef.current = undefined
        }

        // ── Animation loop ────────────────────────────────────────────
        let prevT = 0
        const animate = (t: number) => {
          const dt = prevT === 0 ? 0 : Math.min((t - prevT) / 1000, 0.05)
          prevT = t

          if (!selectedRef.current && !centeringRef.current && !dragRef.current.on) {
            const { x: vx, y: vy } = velRef.current
            if (isRotRef.current) {
              rotRef.current[0] += dt * 4
              proj.rotate(rotRef.current)
            } else if (Math.abs(vx) > 0.003 || Math.abs(vy) > 0.003) {
              rotRef.current[0] += vx
              rotRef.current[1]  = Math.max(-80, Math.min(80, rotRef.current[1] - vy))
              velRef.current = { x: vx * 0.92, y: vy * 0.92 }
              proj.rotate(rotRef.current)
            } else {
              velRef.current   = { x: 0, y: 0 }
              isRotRef.current = true
            }
          }

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
                gFtCountry.select(`.country-${countryId}`).classed('selected', true)
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

          gSphere.select('path').attr('d', geoPath(sphereShape) ?? '')
          gGrid.select('path').attr('d', geoPath as any)
          gBgCountry.selectAll('.bg-country').attr('d', geoPath as any)
          gFtCountry.selectAll('.ft-country').attr('d', geoPath as any)
          gBorders.select('path').attr('d', geoPath as any)

          // Keep atmosphere and rim circles in sync with the current scale
          const curR = proj.scale()
          gAtmo.select('circle').attr('r', curR + 32)
          gRim.select('circle').attr('r', curR + 1)

          // Keep popup wrapper anchored to country centroid during zoom / pan
          if (selectedRef.current !== null && popupWrapRef.current) {
            const selFeat = featuresRef.current.find((f: any) => parseInt(f.id) === selectedRef.current)
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

    // ── Drag / touch ───────────────────────────────────────────────────
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
        velRef.current.x   = velRef.current.x * 0.4 + dx * 0.28 * 0.6
        velRef.current.y   = velRef.current.y * 0.4 + dy * 0.28 * 0.6
        proj.rotate(rotRef.current)
      })
      .on('end', () => {
        dragRef.current.on = false
        // Inertia in animate loop decelerates and flips isRotRef back to true
      })

    svg.call(dragBehavior as any)

    // ── Zoom: scroll wheel ─────────────────────────────────────────────
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      postZoomAnimRef.current = null
      const factor = e.deltaY > 0 ? 0.92 : 1.08
      zoomRef.current = Math.max(0.4, Math.min(3.5, zoomRef.current * factor))
      proj.scale(R * zoomRef.current)
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    // ── Zoom: pinch gesture ────────────────────────────────────────────
    let lastPinchDist = 0
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDist = Math.hypot(dx, dy)
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.hypot(dx, dy)
        if (lastPinchDist > 0) {
          postZoomAnimRef.current = null
          const factor = dist / lastPinchDist
          zoomRef.current = Math.max(0.4, Math.min(3.5, zoomRef.current * factor))
          proj.scale(R * zoomRef.current)
        }
        lastPinchDist = dist
      }
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })

    return () => {
      cancelAnimationFrame(rafRef.current)
      el.removeEventListener('wheel',      onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} style={{ width:'100%', height:'100%', position:'relative' }}>
      <svg
        ref={svgRef}
        style={{
          display: 'block', touchAction: 'none', userSelect: 'none', cursor: 'grab',
          filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.18)) drop-shadow(0 4px 12px rgba(0,0,0,0.10))',
        }}
        onMouseDown={() => { if (svgRef.current) svgRef.current.style.cursor = 'grabbing' }}
        onMouseUp={()   => { if (svgRef.current) svgRef.current.style.cursor = 'grab' }}
      />

      {/* Zoom controls */}
      {isLoaded && (
        <div style={{
          position: 'absolute', right: 14, bottom: 14,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {['+', '−'].map((label, i) => (
            <button
              key={label}
              onClick={() => {
                if (!projRef.current || !baseRRef.current) return
                postZoomAnimRef.current = null
                zoomRef.current = i === 0
                  ? Math.min(3.5, zoomRef.current * 1.3)
                  : Math.max(0.4, zoomRef.current / 1.3)
                projRef.current.scale(baseRRef.current * zoomRef.current)
              }}
              style={{
                width: 32, height: 32,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                fontSize: 18, fontWeight: 300, color: '#1C1C1E',
                cursor: 'pointer', lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity 0.12s',
              }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {!isLoaded && (
        <div style={{
          position:'absolute', inset:0,
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14,
        }}>
          <div style={{
            width:28, height:28,
            border:'2px solid rgba(200,155,60,.25)',
            borderTopColor:'#C89B3C',
            borderRadius:'50%',
            animation:'spin 0.75s linear infinite',
          }}/>
          <span style={{ fontSize:10, letterSpacing:2, color:'#AEAEB2', textTransform:'uppercase', fontWeight:600 }}>
            Chargement…
          </span>
        </div>
      )}

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
  gFlags: d3.Selection<SVGGElement,unknown,null,undefined>,
  defs:   d3.Selection<SVGDefsElement,unknown,null,undefined>,
) {
  gFlags.selectAll('*').remove()
  defs.select(`#clip-flag-${id}`).remove()
  const pathStr = geoPath(featureData as any)
  if (!pathStr) return
  const [[x0,y0],[x1,y1]] = geoPath.bounds(featureData as any)
  defs.append('clipPath').attr('id',`clip-flag-${id}`)
    .append('path').attr('d',pathStr)
  gFlags.append('image')
    .attr('href',`https://flagcdn.com/w640/${FEATURED[id].code}.png`)
    .attr('x',x0).attr('y',y0)
    .attr('width',Math.max(x1-x0,1)).attr('height',Math.max(y1-y0,1))
    .attr('preserveAspectRatio','xMidYMid slice')
    .attr('clip-path',`url(#clip-flag-${id})`)
    .attr('opacity',0)
    .transition().duration(500).ease(d3.easeCubicOut)
    .attr('opacity',1)
}
