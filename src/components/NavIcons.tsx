// ─── Custom SVG icons for the bottom navigation ───────────────────────────
// All icons share the same 24×24 viewBox and consistent 1.5px stroke weight.

interface IconProps { size?: number; color?: string }
const D = { size: 22, color: 'currentColor' }

export function IconGlobe({ size = D.size, color = D.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <ellipse cx="12" cy="12" rx="3.8" ry="9.5" />
      <line x1="2.5" y1="12" x2="21.5" y2="12" />
      <path d="M5 7.5 Q12 6 19 7.5" />
      <path d="M5 16.5 Q12 18 19 16.5" />
    </svg>
  )
}

export function IconTrophy({ size = D.size, color = D.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2h8v8a4 4 0 0 1-8 0V2Z" />
      <path d="M5 3H3a1 1 0 0 0-1 1v2a4 4 0 0 0 3.8 4" />
      <path d="M19 3h2a1 1 0 0 1 1 1v2a4 4 0 0 1-3.8 4" />
      <line x1="12" y1="14" x2="12" y2="18" />
      <path d="M8 21h8" />
      <path d="M9 18h6a1 1 0 0 1 1 1v1H8v-1a1 1 0 0 1 1-1Z" />
    </svg>
  )
}

export function IconExchange({ size = D.size, color = D.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M8 10l-3 2 3 2" />
      <path d="M16 14l3-2-3-2" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function IconBolt({ size = D.size, color = D.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
