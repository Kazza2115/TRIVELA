// ─── Trivela Logo — football boot kicking a ball, trivela curve ───────────────

export default function TrivelaLogo({ size = 140, color = '#C89B3C' }: { size?: number; color?: string }) {
  const w = size
  const h = Math.round(size * 0.38)
  return (
    <svg width={w} height={h} viewBox="0 0 290 110" fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* ── Football boot (side profile, right-pointing toe, kicking pose) ── */}
      {/* Main boot body */}
      <path
        d="M 12,92 Q 6,96 16,97 L 54,97 L 66,82 L 63,68 Q 54,58 36,56 L 20,58 Q 11,60 11,72 L 11,88 Z"
        fill={color} opacity="0.90"
      />
      {/* Ankle cuff rising from the back of the boot */}
      <path
        d="M 20,58 L 17,36 Q 16,26 22,24 L 28,24 Q 34,26 32,36 L 30,58 Z"
        fill={color} opacity="0.90"
      />
      {/* Sole strip (slightly darker) */}
      <path
        d="M 14,97 L 54,97 L 66,84"
        stroke="rgba(0,0,0,0.22)" strokeWidth="3.5" strokeLinecap="round" fill="none"
      />
      {/* Lace stitching on vamp */}
      <path d="M 24,66 L 40,61" stroke="rgba(0,0,0,0.22)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 25,72 L 44,66" stroke="rgba(0,0,0,0.22)" strokeWidth="1.8" strokeLinecap="round" />
      {/* Studs */}
      <rect x="20" y="97" width="6" height="5" rx="2" fill={color} opacity="0.50" />
      <rect x="33" y="97" width="6" height="5" rx="2" fill={color} opacity="0.50" />
      <rect x="47" y="96" width="6" height="5" rx="2" fill={color} opacity="0.50" />

      {/* ── Football (being struck by the outside of the boot toe) ── */}
      <circle cx="81" cy="70" r="13" fill={color} opacity="0.92" />
      {/* Pentagon patch */}
      <path d="M 78,65 L 81,63 L 84,65 L 83,70 L 79,70 Z" fill="rgba(0,0,0,0.22)" />
      {/* Second patch */}
      <path d="M 72,73 L 74,69 L 79,70 L 79,75 L 74,76 Z" fill="rgba(0,0,0,0.14)" />
      {/* Shine */}
      <circle cx="77" cy="66" r="3" fill="rgba(255,255,255,0.38)" />

      {/* ── Trivela curve — outside-of-foot curving trajectory ── */}
      <path
        d="M 92,58 Q 130,24 178,28 T 284,18"
        stroke={color} strokeWidth="2.2" strokeLinecap="round"
        strokeDasharray="5 8" fill="none" opacity="0.28"
      />
      <path
        d="M 94,63 Q 134,32 180,34 T 282,24"
        stroke={color} strokeWidth="1.1" strokeLinecap="round"
        fill="none" opacity="0.14"
      />

      {/* ── TRIVELA wordmark ── */}
      <text
        x="195" y="78"
        textAnchor="middle"
        fontFamily="'Bebas Neue', cursive"
        fontSize="52"
        letterSpacing="8"
        fill={color}
      >
        TRIVELA
      </text>

      {/* Underline swoosh */}
      <path
        d="M 106,87 Q 196,103 286,87"
        stroke={color} strokeWidth="2.2" strokeLinecap="round"
        fill="none" opacity="0.55"
      />
      <circle cx="288" cy="86.5" r="2.2" fill={color} opacity="0.45" />
    </svg>
  )
}
