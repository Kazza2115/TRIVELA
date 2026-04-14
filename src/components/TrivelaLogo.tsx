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

      {/* ── Trivela arc — authentic outside-of-foot S-curve trajectory ──
           The ball rises steeply, bends hard left, then hooks right — exactly
           the banana-reverse shape of a real trivela pass.              ── */}
      {/* Main arc — pronounced S-curve */}
      <path
        d="M 24,62 C 8,22 55,2 112,24 C 168,46 224,6 268,22"
        stroke={color} strokeWidth="2.4" strokeLinecap="round"
        strokeDasharray="6 9" fill="none" opacity="0.34"
      />
      {/* Shadow arc — slightly offset, gives depth */}
      <path
        d="M 25,65 C 10,26 57,6 114,28 C 170,50 226,10 268,26"
        stroke={color} strokeWidth="1.2" strokeLinecap="round"
        strokeDasharray="4 11" fill="none" opacity="0.16"
      />
      {/* Faint ghost arc — extra depth at the peak of the curve */}
      <path
        d="M 22,60 C 5,18 52,0 110,22"
        stroke={color} strokeWidth="0.8" strokeLinecap="round"
        fill="none" opacity="0.10"
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
