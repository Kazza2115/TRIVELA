import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import CountryPopup from './CountryPopup'

// ─── Country configuration ─────────────────────────────────────────────────
// Palette cartoon / stylisée : pas de couleurs trop saturées, style jeu vidéo
export const FEATURED: Record<number, {
  name: string; code: string; color: string
  pulseClass: string; sectionId: string; sectionName: string; icon: string
}> = {
  76:  { name: 'Brésil',  code: 'br', color: '#5C946E', pulseClass: 'pulse-brazil',   sectionId: 'packs',      sectionName: 'Mes Packs',   icon: '📦' },
  686: { name: 'Sénégal', code: 'sn', color: '#D98C5F', pulseClass: 'pulse-senegal',  sectionId: 'classement', sectionName: 'Classement',  icon: '🏆' },
  756: { name: 'Suisse',  code: 'ch', color: '#C65D5D', pulseClass: 'pulse-suisse',   sectionId: 'album',      sectionName: 'Mon Album',   icon: '📖' },
  392: { name: 'Japon',   code: 'jp', color: '#D9C97C', pulseClass: 'pulse-japon',    sectionId: 'echange',    sectionName: 'Échange',     icon: '🔄' },
  840: { name: 'USA',     code: 'us', color: '#7FB77E', pulseClass: 'pulse-usa',      sectionId: 'defis',      sectionName: 'Défis',       icon: '⚡' },
}

interface GlobeProps { onNavigate: (section: string) => void }

interface PopupState {
  countryId: number
  x: number; y: number
}

export default function Globe({ onNavigate }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // D3 refs (not React state → no re-render)
  const projRef    = useRef<d3.GeoProjection | null>(null)
  const pathRef    = useRef<d3.GeoPath | null>(null)
  const worldRef   = useRef<Topology | null>(null)
  const rafRef     = useRef<number>(0)
  const rotRef     = useRef<[number, number]>([-10, -25])
  const isRotRef   = useRef(true)
  const drag       = useRef({ on: false, ox: 0, oy: 0 })
  const popupRef   = useRef<PopupState | null>(null)
  const selectedRef = useRef<number | null>(null)

  // Fix zoom bug: track selected feature so flag overlay updates every frame
  const selectedFeatureRef = useRef<any>(null)
  // Base scale for zoom limits
  const baseScaleRef = useRef<number>(0)

  // Keep refs in sync with state
  const setPopupSync = useCallback((p: PopupState | null) => {
    popupRef.current = p
    selectedRef.current = p ? p.countryId : null
    setPopup(p)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !svgRef.current) return

    const W = el.clientWidth
    const H = el.clientHeight
    const R = Math.min(W, H) * 0.42
    baseScaleRef.current = R

    // ── Projection ──────────────────────────────────────────────────
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

    // ── Defs ────────────────────────────────────────────────────────
    const defs = svg.append('defs')

    // Atmosphère très subtile — bord doux seulement, zéro glow
    const atmoGrad = defs.append('radialGradient')
      .attr('id', 'atmo-grad')
      .attr('cx', '50%').attr('cy', '50%').attr('r', '50%')
    atmoGrad.append('stop').attr('offset', '82%').attr('stop-color', 'transparent')
    atmoGrad.append('stop').attr('offset', '93%').attr('stop-color', '#1F4666').attr('stop-opacity', '0.15')
    atmoGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0a1520').attr('stop-opacity', '0')

    // Océan — dégradé doux style cartoon (#3F7FB2 clair → #1F4666 sombre)
    const sphereGrad = defs.append('radialGradient')
      .attr('id', 'sphere-grad')
      .attr('cx', '38%').attr('cy', '32%').attr('r', '60%')
    sphereGrad.append('stop').attr('offset', '0%').attr('stop-color', '#3F7FB2').attr('stop-opacity', '1')
    sphereGrad.append('stop').attr('offset', '100%').attr('stop-color', '#1F4666').attr('stop-opacity', '1')

    // ── Layer groups (bottom → top) ──────────────────────────────────
    // Pas de gAtmoTop (rim light supprimé)
    const gAtmo      = svg.append('g').attr('class', 'g-atmo')
    const gSphere    = svg.append('g').attr('class', 'g-sphere')
    const gGrid      = svg.append('g').attr('class', 'g-grid')
    const gBgCountry = svg.append('g').attr('class', 'g-bg-countries')
    const gFtCountry = svg.append('g').attr('class', 'g-ft-countries')
    const gFlags     = svg.append('g').attr('class', 'g-flags')
    const gBorders   = svg.append('g').attr('class', 'g-borders')

    // Halo atmosphérique très léger (pas de glow bleu)
    const atmoCircle = gAtmo.append('circle')
      .attr('cx', W / 2).attr('cy', H / 2).attr('r', R + 16)
      .attr('fill', 'url(#atmo-grad)')

    // Océan
    const spherePath = { type: 'Sphere' } as Parameters<typeof geoPath>[0]
    gSphere.append('path')
      .datum(spherePath)
      .attr('d', geoPath)
      .attr('fill', 'url(#sphere-grad)')
      .attr('stroke', '#2C5F8A')
      .attr('stroke-width', '0.6')

    // Graticule (grille subtile)
    const graticule = d3.geoGraticule().step([20, 20])
    gGrid.append('path')
      .datum(graticule())
      .attr('d', geoPath)
      .attr('fill', 'none')
      .attr('stroke', '#2C5F8A')
      .attr('stroke-width', '0.3')
      .attr('opacity', '0.3')

    // ── Load world data ──────────────────────────────────────────────
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')
      .then(r => r.json())
      .then((world: Topology) => {
        worldRef.current = world
        const countries = feature(world, (world as any).objects.countries) as any
        if (!countries.features) return
        const features: any[] = countries.features

        // Pays non-featured (fond neutre, lisible)
        gBgCountry.selectAll('.bg-country')
          .data(features)
          .join('path')
          .attr('class', (d: any) => {
            const id = parseInt(d.id)
            return FEATURED[id] ? 'hidden-path' : 'bg-country'
          })
          .attr('d', geoPath as any)
          .attr('fill', '#1F4A6E')
          .attr('stroke', '#2A5F85')
          .attr('stroke-width', '0.35')
          .attr('opacity', '0.75')

        // Pays featured (palette cartoon cohérente)
        gFtCountry.selectAll('.ft-country')
          .data(features.filter((d: any) => FEATURED[parseInt(d.id)]))
          .join('path')
          .attr('class', (d: any) => {
            const id = parseInt(d.id)
            return `ft-country country-${id} ${FEATURED[id].pulseClass}`
          })
          .attr('d', geoPath as any)
          .attr('fill', (d: any) => FEATURED[parseInt(d.id)].color)
          .attr('stroke', (d: any) => FEATURED[parseInt(d.id)].color)
          .attr('stroke-width', '0.8')
          .style('cursor', 'pointer')
          .on('click', (event: MouseEvent, d: any) => {
            const id = parseInt(d.id)
            if (!FEATURED[id]) return

            isRotRef.current = false

            const [mx, my] = d3.pointer(event, svgRef.current)
            const centroid = geoPath.centroid(d as any)
            const px = isFinite(mx) ? mx : centroid[0]
            const py = isFinite(my) ? my : centroid[1]

            // Stocker le feature pour mise à jour du flag overlay chaque frame
            selectedFeatureRef.current = d

            applyFlag(id, d, geoPath, gFlags, defs, svg)

            gFtCountry.select(`.country-${id}`).classed('selected', true)

            setPopupSync({ countryId: id, x: px, y: py })
          })

        // Maillage des frontières
        gBorders.append('path')
          .datum(countries as any)
          .attr('d', geoPath as any)
          .attr('fill', 'none')
          .attr('stroke', '#1A3A55')
          .attr('stroke-width', '0.4')
          .attr('opacity', '0.55')

        setIsLoaded(true)

        // ── Animation loop ──────────────────────────────────────────
        let prevT = 0
        const animate = (t: number) => {
          const dt = Math.min((t - prevT) / 1000, 0.05)
          prevT = t

          // Auto-rotate
          if (isRotRef.current && !selectedRef.current) {
            rotRef.current[0] += dt * 7
            proj.rotate([rotRef.current[0], rotRef.current[1]])
          }

          // Mise à jour de tous les paths géo-dépendants
          gSphere.select('path').attr('d', geoPath(spherePath) ?? '')
          gGrid.select('path').attr('d', geoPath as any)
          gBgCountry.selectAll('.bg-country').attr('d', geoPath as any)
          gFtCountry.selectAll('.ft-country').attr('d', geoPath as any)
          gBorders.select('path').attr('d', geoPath as any)

          // Fix zoom bug: re-calculer le flag overlay à chaque frame
          // Garantit l'alignement parfait pays/globe quelle que soit la transformation
          if (selectedRef.current !== null && selectedFeatureRef.current) {
            const id = selectedRef.current
            const feat = selectedFeatureRef.current
            const pathStr = geoPath(feat as any)
            if (pathStr) {
              defs.select(`#clip-flag-${id} path`).attr('d', pathStr)
              const [[fx0, fy0], [fx1, fy1]] = geoPath.bounds(feat as any)
              const fw = Math.max(fx1 - fx0, 1)
              const fh = Math.max(fy1 - fy0, 1)
              gFlags.select('image')
                .attr('x', fx0).attr('y', fy0)
                .attr('width', fw).attr('height', fh)
            }
          }

          // Mettre à jour le rayon de l'atmosphère selon le scale actuel (zoom)
          const currentScale = proj.scale()
          atmoCircle.attr('r', currentScale + 16)

          rafRef.current = requestAnimationFrame(animate)
        }
        rafRef.current = requestAnimationFrame(animate)
      })

    // ── Drag to rotate ───────────────────────────────────────────────
    const dragBehavior = d3.drag<SVGSVGElement, unknown>()
      .on('start', (event) => {
        if (selectedRef.current) return
        isRotRef.current = false
        drag.current = { on: true, ox: event.x, oy: event.y }
      })
      .on('drag', (event) => {
        if (!drag.current.on || selectedRef.current) return
        const dx = event.x - drag.current.ox
        const dy = event.y - drag.current.oy
        drag.current.ox = event.x
        drag.current.oy = event.y
        rotRef.current[0] += dx * 0.28
        rotRef.current[1] = Math.max(-80, Math.min(80, rotRef.current[1] - dy * 0.28))
        proj.rotate([rotRef.current[0], rotRef.current[1]])
      })
      .on('end', () => {
        drag.current.on = false
        if (!selectedRef.current) isRotRef.current = true
      })

    svg.call(dragBehavior as any)

    // ── Zoom via molette — modifie proj.scale() directement ──────────
    // Pas de transform CSS/SVG → les paths sont toujours recalculés correctement
    // Garantit zéro décalage pays/globe au zoom
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.08 : 0.93
      const minScale = baseScaleRef.current * 0.5
      const maxScale = baseScaleRef.current * 3.0
      const newScale = Math.max(minScale, Math.min(maxScale, proj.scale() * factor))
      proj.scale(newScale)
      // L'animation loop se chargera de redessiner au prochain frame
    }

    const svgEl = svgRef.current
    svgEl.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      cancelAnimationFrame(rafRef.current)
      svgEl.removeEventListener('wheel', handleWheel)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close popup ────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    const prev = selectedRef.current
    setPopupSync(null)
    selectedFeatureRef.current = null  // Effacer le feature ref

    if (svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.select('.g-flags').selectAll('*').remove()
      svg.select(`defs #clip-flag-${prev}`).remove()
      svg.select(`.ft-country.country-${prev}`).classed('selected', false)
    }

    isRotRef.current = true
  }, [setPopupSync])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        style={{ display: 'block', cursor: 'grab' }}
        onMouseDown={() => { svgRef.current!.style.cursor = 'grabbing' }}
        onMouseUp={() => { svgRef.current!.style.cursor = 'grab' }}
      />

      {/* Loading overlay */}
      {!isLoaded && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, color: 'var(--text-secondary)',
        }}>
          <div style={{
            width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: 'var(--gold)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: 13, letterSpacing: 1 }}>Chargement de la carte…</span>
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

// ── Flag overlay helper ────────────────────────────────────────────────────
function applyFlag(
  id: number,
  featureData: any,
  geoPath: d3.GeoPath,
  gFlags: d3.Selection<SVGGElement, unknown, null, undefined>,
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  _svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
) {
  gFlags.selectAll('*').remove()
  defs.select(`#clip-flag-${id}`).remove()

  const pathStr = geoPath(featureData as any)
  if (!pathStr) return

  const bounds = geoPath.bounds(featureData as any)
  const [[x0, y0], [x1, y1]] = bounds
  const w = Math.max(x1 - x0, 1)
  const h = Math.max(y1 - y0, 1)

  // Clip path calqué sur la forme du pays
  defs.append('clipPath')
    .attr('id', `clip-flag-${id}`)
    .append('path')
    .attr('d', pathStr)

  const { code } = FEATURED[id]

  // Image du drapeau clippée à la frontière du pays
  gFlags.append('image')
    .attr('href', `https://flagcdn.com/w640/${code}.png`)
    .attr('x', x0).attr('y', y0)
    .attr('width', w).attr('height', h)
    .attr('preserveAspectRatio', 'xMidYMid slice')
    .attr('clip-path', `url(#clip-flag-${id})`)
    .attr('opacity', 0)
    .transition().duration(700).ease(d3.easeCubicOut)
    .attr('opacity', 1)
}
