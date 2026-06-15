import type { Team } from '../data/wc2026Matches'

export type Outcome = 'home' | 'draw' | 'away'

export interface Percents { home: number; draw: number; away: number; leader: Outcome | null; total: number }

/** Convertit des compteurs (ou des % bruts) en pourcentages entiers de somme 100,
 *  avec l'issue majoritaire (leader). total = somme des compteurs d'origine. */
export function trendPercents(home: number, draw: number, away: number): Percents {
  const total = home + draw + away
  if (total <= 0) return { home: 0, draw: 0, away: 0, leader: null, total: 0 }
  let h = Math.round((home / total) * 100)
  let a = Math.round((away / total) * 100)
  let d = 100 - h - a
  if (d < 0) { if (h >= a) h += d; else a += d; d = 0 }
  // Leader = issue au plus grand nombre de pronos (départage home > away > draw).
  const max = Math.max(home, away, draw)
  const leader: Outcome = home === max ? 'home' : away === max ? 'away' : 'draw'
  return { home: h, draw: d, away: a, leader, total }
}

const GREEN = '#16a34a'
const FLAME_THRESHOLD = 80   // 🔥 si l'issue majoritaire dépasse 80 %

function Flag({ code, size = 16 }: { code: string; size?: number }) {
  return (
    <img src={`https://flagcdn.com/w20/${code}.png`} alt="" style={{
      width: size, height: Math.round(size * 0.67), borderRadius: 2, objectFit: 'cover',
      border: '1px solid var(--border)', flexShrink: 0,
    }} />
  )
}

interface TrendBarProps {
  homeTeam: Team
  awayTeam: Team
  /** compteurs OU pourcentages (trendPercents normalise de toute façon). */
  home: number
  draw: number
  away: number
  total?: number
  compact?: boolean
  onClick?: () => void
  label?: string
  emptyHint?: string
}

/** Barre de tendance : 3 segments (domicile / nul / extérieur). L'issue majoritaire
 *  est en vert, avec une 🔥 si elle dépasse 80 %. */
export default function TrendBar({
  homeTeam, awayTeam, home, draw, away, total, compact, onClick, label, emptyHint,
}: TrendBarProps) {
  const p = trendPercents(home, draw, away)
  const nVoters = total ?? p.total

  if (p.leader === null) {
    return (
      <div style={{ fontSize: compact ? 10 : 12, color: 'var(--text-3)', fontStyle: 'italic' }}>
        {emptyHint ?? 'Aucun pronostic pour l\'instant'}
      </div>
    )
  }

  const segColor = (o: Outcome) => (o === p.leader ? GREEN : 'var(--text-3)')
  const segBg = (o: Outcome) =>
    o === p.leader ? 'rgba(22,163,74,0.85)' : 'rgba(140,140,148,0.30)'
  const pct = { home: p.home, draw: p.draw, away: p.away }
  const flame = (o: Outcome) => o === p.leader && pct[o] > FLAME_THRESHOLD

  const Segment = ({ o }: { o: Outcome }) => (
    <div style={{
      width: `${pct[o]}%`, minWidth: pct[o] > 0 ? 3 : 0, height: compact ? 7 : 10,
      background: segBg(o), transition: 'width 0.4s ease',
    }} />
  )

  const Label = ({ o }: { o: Outcome }) => {
    const isLeader = o === p.leader
    const content = o === 'draw'
      ? <span style={{ fontSize: compact ? 9 : 11, fontWeight: 700, color: segColor(o) }}>Nul</span>
      : <Flag code={(o === 'home' ? homeTeam : awayTeam).code} size={compact ? 15 : 18} />
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        flexDirection: o === 'away' ? 'row-reverse' : 'row',
      }}>
        {content}
        <span style={{
          fontSize: compact ? 11 : 14, fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: isLeader ? GREEN : 'var(--text-2)',
        }}>{pct[o]}%</span>
        {flame(o) && (
          <span style={{
            fontSize: compact ? 12 : 15, lineHeight: 1,
            filter: 'drop-shadow(0 0 4px rgba(245,130,30,0.85))',
            animation: 'flameFlicker 0.6s ease-in-out infinite',
          }}>🔥</span>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: compact ? 5 : 8, width: '100%',
      }}
      onPointerDown={onClick ? e => (e.currentTarget.style.opacity = '0.6') : undefined}
      onPointerUp={onClick ? e => (e.currentTarget.style.opacity = '1') : undefined}
    >
      {label && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: compact ? 9 : 10, fontWeight: 700, letterSpacing: 0.8,
          color: 'var(--text-3)', textTransform: 'uppercase',
        }}>
          <span>{label}</span>
          {!compact && nVoters > 0 && (
            <span style={{ color: 'var(--text-3)', fontWeight: 600, letterSpacing: 0 }}>
              {nVoters} prono{nVoters > 1 ? 's' : ''}
            </span>
          )}
          {compact && onClick && <span style={{ color: 'var(--text-3)', opacity: 0.7 }}>détails ›</span>}
        </div>
      )}

      {/* Barre empilée */}
      <div style={{
        display: 'flex', width: '100%', borderRadius: 999, overflow: 'hidden',
        background: 'var(--bg-fill)', gap: 1,
      }}>
        <Segment o="home" />
        <Segment o="draw" />
        <Segment o="away" />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label o="home" />
        <Label o="draw" />
        <Label o="away" />
      </div>
    </div>
  )
}
