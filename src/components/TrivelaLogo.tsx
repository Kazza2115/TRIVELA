// ─── Trivela Logo — curved football-inspired SVG ─────────────────────────
// Inspired by the "trivela" technique: a curved outside-of-the-foot shot.

export default function TrivelaLogo({ size = 140, color = '#C89B3C' }: { size?: number; color?: string }) {
  const w = size
  const h = size * 0.38
  return (
    <svg width={w} height={h} viewBox="0 0 260 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Curved motion arc — the "trivela" kick path */}
      <path
        d="M20 75 Q60 10, 130 50 T240 25"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
        strokeDasharray="4 6"
      />
      {/* Second thinner arc for depth */}
      <path
        d="M30 80 Q70 20, 135 52 T235 30"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.18"
      />
      {/* Small football at the arc start */}
      <circle cx="18" cy="76" r="6" fill={color} opacity="0.7" />
      {/* Tiny pentagon on the ball */}
      <path
        d="M16.2 74.8 L18 73.5 L19.8 74.8 L19.2 76.8 L16.8 76.8Z"
        fill="rgba(0,0,0,0.3)"
      />
      {/* TRIVELA text — main wordmark */}
      <text
        x="130" y="68"
        textAnchor="middle"
        fontFamily="'Bebas Neue', cursive"
        fontSize="52"
        letterSpacing="8"
        fill={color}
      >
        TRIVELA
      </text>
      {/* Underline swoosh — the trivela curve */}
      <path
        d="M48 78 Q130 92, 212 76"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {/* Small dot at the end of swoosh — ball trajectory endpoint */}
      <circle cx="214" cy="75.5" r="2.5" fill={color} opacity="0.5" />
    </svg>
  )
}
