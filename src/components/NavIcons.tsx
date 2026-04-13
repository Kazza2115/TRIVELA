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

export function IconPacks({ size = D.size, color = D.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <path d="M3 9l2-5h14l2 5" />
      <line x1="12" y1="9" x2="12" y2="21" />
      <path d="M8 4.5 C8 3 10 2 12 4 C14 2 16 3 16 4.5" />
      {/* star accent */}
      <path d="M7 14 l.7 1.4 1.6.2-1.15 1.1.28 1.55L7 17.5l-1.43.75.28-1.55L4.7 15.6l1.6-.2Z" fill={color} stroke="none"/>
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

export function IconAlbum({ size = D.size, color = D.color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="10" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
      <rect x="13" y="15" width="8" height="6" rx="1.5" />
      <line x1="5.5" y1="6" x2="8.5" y2="6" />
      <line x1="5.5" y1="8.5" x2="8.5" y2="8.5" />
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
