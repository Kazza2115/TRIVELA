import { useEffect, useRef } from 'react'

interface Star { x: number; y: number; r: number; opacity: number; speed: number }

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = canvas.width  = window.innerWidth
    let H = canvas.height = window.innerHeight

    const count = Math.floor((W * H) / 4500)
    const stars: Star[] = Array.from({ length: count }, () => ({
      x:       Math.random() * W,
      y:       Math.random() * H,
      r:       Math.random() * 1.2 + 0.2,
      opacity: Math.random() * 0.7 + 0.15,
      speed:   Math.random() * 0.004 + 0.001,
    }))

    let frame = 0
    let raf: number

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      frame++
      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(frame * s.speed * 6 + s.x)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,215,255,${s.opacity * twinkle})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)

    const onResize = () => {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.7,
      }}
    />
  )
}
