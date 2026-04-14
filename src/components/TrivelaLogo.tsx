// ─── Trivela Logo — small football + wordmark + trivela curve ────────────────

export default function TrivelaLogo({ size = 140, color = '#C89B3C' }: { size?: number; color?: string }) {
  const w = size
  const h = Math.round(size * 0.37)
  return (
    <svg width={w} height={h} viewBox="0 0 290 100" fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* ── Football ── */}
      <circle cx="16" cy="68" r="10" fill={color} opacity="0.90" />
      {/* Pentagon patches */}
      <path d="M 13,63 L 16,61 L 19,63 L 18,68 L 14,68 Z" fill="rgba(0,0,0,0.22)" />
      <path d="M 8,71 L 10,67 L 14,68 L 14,73 L 10,74 Z"  fill="rgba(0,0,0,0.14)" />
      {/* Shine */}
      <circle cx="12" cy="64" r="3" fill="rgba(255,255,255,0.38)" />

      {/* ── Trivela arc — ball trajectory curving away ── */}
      <path
        d="M 24,60 Q 65,24 115,26 T 262,16"
        stroke={color} strokeWidth="2.2" strokeLinecap="round"
        strokeDasharray="5 8" fill="none" opacity="0.28"
      />
      <path
        d="M 26,65 Q 68,32 118,32 T 260,22"
        stroke={color} strokeWidth="1.1" strokeLinecap="round"
        fill="none" opacity="0.14"
      />

      {/* ── TRIVELA wordmark ── */}
      <text
        x="175" y="75"
        textAnchor="middle"
        fontFamily="'Bebas Neue', cursive"
        fontSize="52"
        letterSpacing="8"
        fill={color}
      >TRIVELA</text>

      {/* Underline swoosh */}
      <path
        d="M 84,84 Q 175,100 266,84"
        stroke={color} strokeWidth="2.2" strokeLinecap="round"
        fill="none" opacity="0.55"
      />
      <circle cx="268" cy="83.5" r="2" fill={color} opacity="0.45" />
    </svg>
  )
}
