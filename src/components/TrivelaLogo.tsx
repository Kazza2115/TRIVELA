// ─── Trivela Logo — realistic football boot kicking a ball ───────────────────

export default function TrivelaLogo({ size = 140, color = '#C89B3C' }: { size?: number; color?: string }) {
  const w = size
  const h = Math.round(size * 0.37)
  return (
    <svg width={w} height={h} viewBox="0 0 290 100" fill="none" xmlns="http://www.w3.org/2000/svg">

      {/*
        ── Football boot — unified silhouette (ankle collar + lower boot in one path)
        Side-profile, right boot, slight kick-angle (toe pointing right & slightly up).
        The path traces clockwise from the heel sole, around the sole/toe/vamp, up the
        front of the ankle collar, across the top, down the back, round the heel counter.
      */}
      <path
        d={`
          M 12,88
          Q 6,93 18,94
          L 54,94 L 68,80 L 70,66
          L 68,56
          Q 58,48 40,47
          Q 26,46 20,50
          L 16,32
          Q 16,20 22,18
          L 26,18
          Q 34,20 32,32
          L 28,50
          Q 12,54 12,70
          L 12,84
          Z
        `}
        fill={color}
        opacity="0.92"
      />

      {/* Sole strip — slightly darker band along the bottom */}
      <path
        d="M 14,94 L 54,94 L 68,82"
        stroke="rgba(0,0,0,0.22)" strokeWidth="3.2" strokeLinecap="round" fill="none"
      />

      {/* Three vertical brand stripes across the upper (Adidas-style) */}
      <path d="M 34,50 L 38,80" stroke="rgba(255,255,255,0.28)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M 41,48 L 45,78" stroke="rgba(255,255,255,0.20)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M 48,48 L 52,74" stroke="rgba(255,255,255,0.12)" strokeWidth="3.2" strokeLinecap="round" />

      {/* Lace detail — two short lines on the vamp/tongue */}
      <path d="M 51,58 L 65,63" stroke="rgba(0,0,0,0.20)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M 53,65 L 67,69" stroke="rgba(0,0,0,0.20)" strokeWidth="1.8" strokeLinecap="round" />

      {/* Collar opening — dark ellipse where the foot enters */}
      <ellipse cx="23" cy="21" rx="3.5" ry="3" fill="rgba(0,0,0,0.24)" />

      {/* Vamp top highlight — subtle light reflection */}
      <path
        d="M 28,52 Q 46,47 64,57"
        stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinecap="round" fill="none"
      />

      {/* ── Football (being struck by outside of the boot toe) ── */}
      <circle cx="83" cy="68" r="13" fill={color} opacity="0.90" />
      {/* Pentagon patches */}
      <path d="M 80,63 L 83,61 L 86,63 L 85,68 L 81,68 Z" fill="rgba(0,0,0,0.22)" />
      <path d="M 74,71 L 76,67 L 81,68 L 81,73 L 76,74 Z"  fill="rgba(0,0,0,0.14)" />
      {/* Shine */}
      <circle cx="79" cy="65" r="3" fill="rgba(255,255,255,0.38)" />

      {/* ── Trivela arc — outside-of-foot curving ball trajectory ── */}
      <path
        d="M 94,58 Q 131,24 176,28 T 284,18"
        stroke={color} strokeWidth="2.2" strokeLinecap="round"
        strokeDasharray="5 8" fill="none" opacity="0.28"
      />
      <path
        d="M 96,63 Q 134,32 178,34 T 282,24"
        stroke={color} strokeWidth="1.1" strokeLinecap="round"
        fill="none" opacity="0.14"
      />

      {/* ── TRIVELA wordmark ── */}
      <text
        x="193" y="75"
        textAnchor="middle"
        fontFamily="'Bebas Neue', cursive"
        fontSize="52"
        letterSpacing="8"
        fill={color}
      >TRIVELA</text>

      {/* Underline swoosh */}
      <path
        d="M 106,84 Q 194,100 282,84"
        stroke={color} strokeWidth="2.2" strokeLinecap="round"
        fill="none" opacity="0.55"
      />
      <circle cx="284" cy="83.5" r="2" fill={color} opacity="0.45" />
    </svg>
  )
}
