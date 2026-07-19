// Feux d'artifice 100 % CSS — AUCUNE boucle JS (ni canvas, ni requestAnimationFrame),
// donc zéro concurrence avec la boucle de rendu du globe → stable et léger.
// Chaque « éclat » est un point unique dont l'anneau d'étincelles est peint via box-shadow
// (statique) ; seule la mise à l'échelle + l'opacité sont animées (composées par le GPU).

// Anneau d'étincelles (box-shadow figé). Généré une seule fois par couleur, au chargement.
function ring(colors: string[], count: number, radius: number): string {
  const parts: string[] = []
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count
    const x = Math.round(Math.cos(a) * radius)
    const y = Math.round(Math.sin(a) * radius)
    parts.push(`${x}px ${y}px 0 0 ${colors[i % colors.length]}`)
  }
  return parts.join(',')
}

interface Burst { left: string; top: string; shadow: string; delay: string; dur: string; scale: number }

// Palette + positions figées (déterministes → pas de re-render, pas de Math.random au rendu).
const BURSTS: Burst[] = [
  { left: '22%', top: '30%', shadow: ring(['#FFD75E', '#FF5A1F', '#fff'], 12, 30), delay: '0s',    dur: '1.5s', scale: 1.2 },
  { left: '74%', top: '24%', shadow: ring(['#7FE9FF', '#E8D080', '#fff'], 12, 26), delay: '0.5s',  dur: '1.7s', scale: 1.0 },
  { left: '48%', top: '16%', shadow: ring(['#ff9ff3', '#FFD75E', '#fff'], 14, 34), delay: '0.9s',  dur: '1.6s', scale: 1.35 },
  { left: '32%', top: '52%', shadow: ring(['#5ce1e6', '#FF5A1F', '#fff'], 10, 24), delay: '1.3s',  dur: '1.5s', scale: 0.9 },
  { left: '80%', top: '48%', shadow: ring(['#FFD75E', '#C89B3C', '#fff'], 12, 28), delay: '1.8s',  dur: '1.7s', scale: 1.1 },
  { left: '58%', top: '40%', shadow: ring(['#fff', '#FF5A1F', '#7FE9FF'], 12, 22), delay: '2.2s',  dur: '1.5s', scale: 1.0 },
]

interface FireworksProps { active?: boolean; style?: React.CSSProperties }

export default function Fireworks({ active = true, style }: FireworksProps) {
  if (!active) return null
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      pointerEvents: 'none', zIndex: 5, ...style,
    }}>
      {BURSTS.map((b, i) => (
        <span key={i} className="fw-burst" style={{
          position: 'absolute', left: b.left, top: b.top,
          width: 4, height: 4, borderRadius: '50%',
          boxShadow: b.shadow,
          ['--fw-scale' as string]: b.scale, animationDelay: b.delay, animationDuration: b.dur,
        } as React.CSSProperties} />
      ))}
    </div>
  )
}
