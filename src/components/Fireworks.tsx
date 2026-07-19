import { useEffect, useRef } from 'react'

// Feux d'artifice en canvas, superposés (position:absolute) à leur conteneur parent
// (qui doit être position:relative). Système de particules léger : des fusées montent
// puis explosent en gerbes colorées. Auto-adapté au DPR, pointer-events désactivés,
// et respecte prefers-reduced-motion (rendu statique discret plutôt qu'animation).
interface FireworksProps {
  active?: boolean
  /** Densité des tirs (ms moyens entre deux fusées). Plus petit = plus dense. */
  interval?: number
  /** Palette des explosions. */
  colors?: string[]
  style?: React.CSSProperties
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Rocket   { x: number; y: number; vy: number; targetY: number; color: string }

const DEFAULT_COLORS = ['#FFD75E', '#FF5A1F', '#7FE9FF', '#E8D080', '#C89B3C', '#ff9ff3', '#5ce1e6', '#fff']

export default function Fireworks({ active = true, interval = 650, colors = DEFAULT_COLORS, style }: FireworksProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    let W = 0, H = 0, dpr = 1
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = r.width; H = r.height
      canvas.width = Math.max(1, Math.round(W * dpr))
      canvas.height = Math.max(1, Math.round(H * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const rockets: Rocket[] = []
    const parts: Particle[] = []
    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const pick = () => colors[(Math.random() * colors.length) | 0]

    const burst = (x: number, y: number, color: string) => {
      const n = reduce ? 18 : 34 + ((Math.random() * 16) | 0)
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(-0.1, 0.1)
        const sp = rand(1.1, 3.6)
        parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0, max: rand(45, 80), color: Math.random() < 0.2 ? '#fff' : color, size: rand(1.4, 2.8),
        })
      }
    }

    const launch = () => {
      const x = rand(W * 0.12, W * 0.88)
      rockets.push({ x, y: H + 6, vy: rand(-8.4, -6.2), targetY: rand(H * 0.12, H * 0.5), color: pick() })
    }

    // Salve initiale festive.
    let last = performance.now()
    let acc = 0
    if (!reduce) { launch(); setTimeout(launch, 180); setTimeout(launch, 380) }
    else { // reduced-motion : quelques éclats fixes, pas d'animation continue.
      for (let k = 0; k < 4; k++) burst(rand(W * 0.2, W * 0.8), rand(H * 0.25, H * 0.55), pick())
    }

    let raf = 0
    const frame = (t: number) => {
      const dt = Math.min(48, t - last); last = t
      ctx.clearRect(0, 0, W, H)

      if (!reduce) {
        acc += dt
        if (acc >= interval) { acc = 0; launch(); if (Math.random() < 0.5) setTimeout(launch, 120) }
      }

      // Fusées
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.y += r.vy; r.vy += 0.05
        ctx.globalAlpha = 0.9
        ctx.fillStyle = r.color
        ctx.beginPath(); ctx.arc(r.x, r.y, 2, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 0.25
        ctx.fillRect(r.x - 0.8, r.y, 1.6, 8)
        if (r.vy >= -1.2 || r.y <= r.targetY) { burst(r.x, r.y, r.color); rockets.splice(i, 1) }
      }

      // Particules
      ctx.globalCompositeOperation = 'lighter'
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.life++; p.x += p.vx; p.y += p.vy; p.vy += 0.035; p.vx *= 0.985; p.vy *= 0.985
        const k = 1 - p.life / p.max
        if (k <= 0) { parts.splice(i, 1); continue }
        ctx.globalAlpha = Math.max(0, k)
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1

      if (reduce && !parts.length) return   // rendu unique en reduced-motion
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [active, interval, colors])

  if (!active) return null
  return (
    <canvas ref={canvasRef} aria-hidden="true" style={{
      position: 'absolute', inset: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 5, ...style,
    }} />
  )
}
