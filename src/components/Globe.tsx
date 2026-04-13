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
  756: { name:'Suisse',  code:'ch', color:'#D00020', pulseClass:'pulse-suisse',   sectionId:'album',      sectionName:'Mon Album',   icon:'📖' },
  392: { name:'Japon',   code:'jp', color:'#BC002D', pulseClass:'pulse-japon',    sectionId:'echange',    sectionName:'Échange',     icon:'🔄' },
  840: { name:'USA',     code:'us', color:'#3C3B6E', pulseClass:'pulse-usa',      sectionId:'defis',      sectionName:'Défis',       icon:'⚡' },
}

// ─── Globe palette ─────────────────────────────────────────────────────────
const C = {
  bgFill:   'rgba(18, 28, 55, 0.78)',
  bgStroke: 'rgba(60, 100, 180, 0.28)',
  grid:     'rgba(100, 140, 220, 0.05)',
  border:   'rgba(50, 80, 150, 0.22)',
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
    isRotRef.current = false
    centeringRef.current = {
      startRot: [...rotRef.current] as [number, number],
      targetRot: [-lon, -lat],
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
    atmoGrad.append('stop').attr('offset','72%').attr('stop-color','transparent')
    atmoGrad.append('stop').attr('offset','86%').attr('stop-color','#1a3a7a').attr('stop-opacity','.28')
    atmoGrad.append('stop').attr('offset','96%').attr('stop-color','#3a60c0').attr('stop-opacity','.08')
    atmoGrad.append('stop').attr('offset','100%').attr('stop-color','transparent')

    // Ocean sphere
    const sphereGrad = defs.append('radialGradient').attr('id','sphere-grad')
      .attr('cx','32%').attr('cy','26%').attr('r','65%')
    sphereGrad.append('stop').attr('offset','0%').attr('stop-color','#112244')
    sphereGrad.append('stop').attr('offset','60%').attr('stop-color','#08142e')
    sphereGrad.append('stop').attr('offset','100%').attr('stop-color','#040a18')

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
      .attr('fill','url(#sphere-grad)').attr('stroke','#0a1828').attr('stroke-width','0.6')

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
          .on('click', (event: MouseEvent, d: any) => {
            const id = parseInt(d.id)
            if (!FEATURED[id]) return
            isRotRef.current = false
            const [mx, my]  = d3.pointer(event, svgRef.current)
            const centroid   = geoPath.centroid(d as any)
            const px = isFinite(mx) ? mx : centroid[0]
            const py = isFinite(my) ? my : centroid[1]
            applyFlag(id, d, geoPath, gFlags, defs)
            gFtCountry.select(`.country-${id}`).classed('selected', true)
            setPopupSync({ countryId: id, x: px, y: py })
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

          if (isRotRef.current && !selectedRef.current && !centeringRef.current) {
            rotRef.current[0] += dt * 5
            proj.rotate(rotRef.current)
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

            if (progress >= 1) {
              const { countryId, feature: feat } = centeringRef.current
              centeringRef.current = null
              const centroid = geoPath.centroid(feat as any)
              if (isFinite(centroid[0]) && isFinite(centroid[1])) {
                applyFlag(countryId, feat, geoPath, gFlags, defs)
                gFtCountry.select(`.country-${countryId}`).classed('selected', true)
                setPopupSync({ countryId, x: centroid[0], y: centroid[1] })
              }
            }
          }

          gSphere.select('path').attr('d', geoPath(sphereShape) ?? '')
          gGrid.select('path').attr('d', geoPath as any)
          gBgCountry.selectAll('.bg-country').attr('d', geoPath as any)
          gFtCountry.selectAll('.ft-country').attr('d', geoPath as any)
          gBorders.select('path').attr('d', geoPath as any)

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
        proj.rotate(rotRef.current)
      })
      .on('end', () => {
        dragRef.current.on = false
        if (!selectedRef.current) isRotRef.current = true
      })

    svg.call(dragBehavior as any)
    return () => { cancelAnimationFrame(rafRef.current) }
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
        <CountryPopup
          countryId={popup.countryId}
          x={popup.x} y={popup.y}
          onNavigate={onNavigate}
          onClose={handleClose}
        />
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
