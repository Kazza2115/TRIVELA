// Style partagé des pastilles de points (pronostics). Barème spécial pour le bonus KO :
//   • +7 (nul exact + bon qualifié)  → rouge « feu » avec halo animé autour du carré ;
//   • +6 (bon nul + bon qualifié)    → doré spécial (plus riche que l'or standard) ;
//   • +5 (score exact)               → vert ;
//   • >0                             → or standard ;
//   • 0                              → gris éteint.
import type { CSSProperties } from 'react'

export interface PtsBadge { style: CSSProperties; className: string }

export function pointsBadge(pts: number | null | undefined): PtsBadge {
  const p = pts ?? 0
  if (p >= 7) {
    return {
      className: 'pts-fire',
      style: {
        color: '#fff', fontWeight: 800,
        background: 'linear-gradient(135deg,#ff5a1f,#e11d2a)',
        border: '1px solid rgba(255,120,60,0.9)',
      },
    }
  }
  if (p === 6) {
    return {
      className: 'pts-gold6',
      style: {
        color: '#3a2600', fontWeight: 800,
        background: 'linear-gradient(135deg,#FFD75E,#C8901E)',
        border: '1px solid #E8B923',
        boxShadow: '0 0 8px rgba(232,185,35,0.55)',
      },
    }
  }
  if (p === 5) {
    return { className: '', style: { color: '#16a34a', fontWeight: 800, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' } }
  }
  if (p > 0) {
    return { className: '', style: { color: '#A07828', fontWeight: 800, background: 'rgba(200,155,60,0.12)', border: '1px solid rgba(200,155,60,0.3)' } }
  }
  return { className: '', style: { color: 'var(--text-3)', fontWeight: 800, background: 'rgba(110,110,115,0.1)', border: '1px solid rgba(110,110,115,0.2)' } }
}

/** Libellé « +N » / « N ». */
export const ptsLabel = (pts: number | null | undefined) => `${(pts ?? 0) > 0 ? '+' : ''}${pts ?? 0}`
