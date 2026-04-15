import { useState, useEffect } from 'react'
import PageLayout from './PageLayout'
import { getCollection, getPackConfigs, openPack, saveCollection } from '../services/collection'
import type { PackType, OwnedCard } from '../services/collection'
import { PLAYERS } from '../data/wc2026Players'
import type { Rarity } from '../data/wc2026Players'

// ─── Demo cards shown when player database is empty ───────────────────────────
const DEMO_CARDS: { name: string; position: string; rarity: Rarity; rating: number; trait: string }[] = [
  { name: 'Kylian Mbappé',   position: 'ATT', rarity: 'carnage', rating: 97, trait: 'Finisseur' },
  { name: 'Vinicius Jr',     position: 'ATT', rarity: 'gold',    rating: 96, trait: 'Dribbleur' },
  { name: 'Jude Bellingham', position: 'MID', rarity: 'gold',    rating: 93, trait: 'Phénomène' },
  { name: 'Declan Rice',     position: 'MID', rarity: 'silver',  rating: 86, trait: 'Moteur'    },
  { name: 'Jordan Pickford', position: 'GK',  rarity: 'bronze',  rating: 82, trait: 'Réflexes'  },
]

const RARITY_LABEL: Record<Rarity, string> = {
  bronze: 'Bronze', silver: 'Argent', gold: 'Or', carnage: 'Carnage',
}

// ─── Pack visual config ───────────────────────────────────────────────────────
const PACK_VISUALS: Record<PackType, {
  gradient: string
  glow: string
  badgeColor: string
  badgeText: string
  borderColor: string
}> = {
  starter: {
    gradient: 'linear-gradient(145deg, #c9a364 0%, #a17d44 50%, #8c6a34 100%)',
    glow: 'rgba(201,163,100,0.35)',
    badgeColor: '#b08d4c',
    badgeText: 'DÉBUTANT',
    borderColor: '#b08d4c',
  },
  pro: {
    gradient: 'linear-gradient(145deg, #ffd700 0%, #daa520 35%, #b8860b 70%, #daa520 100%)',
    glow: 'rgba(255,215,0,0.35)',
    badgeColor: '#daa520',
    badgeText: 'PRO',
    borderColor: '#e8c32a',
  },
  superstar: {
    gradient: 'linear-gradient(145deg, #ff1744 0%, #d50000 30%, #ff1744 50%, #ff6f00 70%, #ff1744 100%)',
    glow: 'rgba(255,23,68,0.50)',
    badgeColor: '#ff1744',
    badgeText: 'SUPERSTAR',
    borderColor: '#ff3d00',
  },
}

// ─── Card Stack — fan of 3 player cards (replaces box emoji) ─────────────────
function CardStack({ type, scale = 1 }: { type: PackType; scale?: number }) {
  const palettes: Record<PackType, [string, string, string, string]> = {
    //                 back-left  back-right  front      shine
    starter:   ['#4A2C14', '#8C6034', '#C9A364', 'rgba(255,220,150,0.25)'],
    pro:       ['#5A420E', '#9C7A20', '#E8C040', 'rgba(255,245,150,0.30)'],
    superstar: ['#520010', '#960020', '#FF2040', 'rgba(255,120,80,0.32)'],
  }
  const [c0, c1, c2, shine] = palettes[type]
  const W = 88, H = 76, cW = 46, cH = 64, cR = 7
  const cx = cW / 2  // 23
  const cy = cH / 2  // 32

  return (
    <svg
      width={W * scale} height={H * scale}
      viewBox={`0 0 ${W} ${H}`}
      fill="none"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {/* ── Back-left card ── */}
      <g transform={`translate(2,10) rotate(-13,${cx},${cy})`}>
        <rect width={cW} height={cH} rx={cR} fill={c0} />
        <rect x={3} y={3} width={cW - 6} height={cH - 6} rx={cR - 2}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </g>

      {/* ── Back-right card ── */}
      <g transform={`translate(40,8) rotate(9,${cx},${cy})`}>
        <rect width={cW} height={cH} rx={cR} fill={c1} />
        <rect x={3} y={3} width={cW - 6} height={cH - 6} rx={cR - 2}
          stroke="rgba(255,255,255,0.11)" strokeWidth="1" />
        <text x="7" y="19" fontFamily="'Bebas Neue',cursive" fontSize="15"
          fill="rgba(255,255,255,0.45)">--</text>
      </g>

      {/* ── Front card ── */}
      <g transform="translate(21,4)">
        <rect width={cW} height={cH} rx={cR} fill={c2} />
        {/* Top shine */}
        <rect width={cW} height={cH * 0.44} rx={cR} fill={shine} />
        {/* Inner border */}
        <rect x={3} y={3} width={cW - 6} height={cH - 6} rx={cR - 2}
          stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
        {/* Rating */}
        <text x="7" y="20" fontFamily="'Bebas Neue',cursive" fontSize="17"
          fill="rgba(255,255,255,0.92)">--</text>
        {/* Per-type symbol — filled + outlined for max visibility */}
        {type === 'starter' && (
          <path d="M9,20 L37,20 L37,36 Q37,52 23,56 Q9,52 9,36 Z"
            fill="rgba(255,255,255,0.38)"
            stroke="rgba(255,255,255,0.70)" strokeWidth="1.5" />
        )}
        {type === 'pro' && (
          <polygon
            points="23,28 25.6,35.4 32.5,35.9 27.3,40.4 28.9,47.1 23,43.5 17.1,47.1 18.7,40.4 13.5,35.9 20.4,35.4"
            fill="rgba(255,255,255,0.40)"
            stroke="rgba(255,255,255,0.72)" strokeWidth="1.5" />
        )}
        {type === 'superstar' && (
          <path d="M26,16 L14,38 H22 L20,54 L32,33 H24 Z"
            fill="rgba(255,255,255,0.44)"
            stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
        )}
        {/* Bottom name bar */}
        <rect x={3} y={cH - 17} width={cW - 6} height={13} rx={3}
          fill="rgba(0,0,0,0.22)" />
      </g>
    </svg>
  )
}

// ─── Position icon — geometric SVG (no emoji) ─────────────────────────────────
function PosIcon({ pos, size = 22 }: { pos: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      {pos === 'GK' && (
        // Goal post
        <>
          <rect x="1" y="5" width="20" height="2.5" rx="1.2" fill="rgba(255,255,255,0.82)" />
          <rect x="1" y="5" width="2.5" height="13" rx="1.2" fill="rgba(255,255,255,0.82)" />
          <rect x="18.5" y="5" width="2.5" height="13" rx="1.2" fill="rgba(255,255,255,0.82)" />
        </>
      )}
      {pos === 'DEF' && (
        // Shield
        <path d="M11 2 L19 5.5 L19 12 Q19 18.5 11 21 Q3 18.5 3 12 L3 5.5 Z"
          fill="rgba(255,255,255,0.78)" />
      )}
      {pos === 'MID' && (
        // Hexagon
        <polygon points="11,2 18.5,6.25 18.5,15.75 11,20 3.5,15.75 3.5,6.25"
          fill="rgba(255,255,255,0.78)" />
      )}
      {(pos === 'ATT' || (pos !== 'GK' && pos !== 'DEF' && pos !== 'MID')) && (
        // Lightning bolt
        <path d="M13 2 L5 12 H10 L9 20 L17 10 H12 Z"
          fill="rgba(255,255,255,0.88)" />
      )}
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MesPacks({ onBack }: { onBack: () => void }) {
  const [coins,       setCoins]       = useState(() => getCollection().coins)
  const [phase,       setPhase]       = useState<'idle' | 'shake' | 'burst' | 'reveal'>('idle')
  const [openingType, setOpeningType] = useState<PackType | null>(null)
  const [revealCards, setRevealCards] = useState<typeof DEMO_CARDS>([])

  useEffect(() => { setCoins(getCollection().coins) }, [])

  const configs = getPackConfigs()

  const handleOpen = (type: PackType) => {
    const config = configs.find(c => c.type === type)!
    if (coins < config.price) return

    setOpeningType(type)
    setPhase('shake')

    setTimeout(() => setPhase('burst'),  700)
    setTimeout(() => {
      const rawCards = openPack(type)
      let displayCards: typeof DEMO_CARDS
      if (rawCards.length > 0) {
        displayCards = rawCards.map((c: OwnedCard) => {
          const p = PLAYERS.find(pl => pl.id === c.playerId)
          return p
            ? { name: p.name, position: p.position, rarity: p.rarity, rating: p.rating, trait: p.trait }
            : { name: '???', position: 'ATT', rarity: 'bronze' as Rarity, rating: 70, trait: 'Mystère' }
        })
      } else {
        displayCards = DEMO_CARDS
      }
      setRevealCards(displayCards)
      setCoins(getCollection().coins)
      setPhase('reveal')
    }, 1100)
  }

  const handleClose = () => {
    setPhase('idle')
    setOpeningType(null)
    setRevealCards([])
  }

  const addCoins = () => {
    const s = getCollection()
    s.coins += 5000
    saveCollection(s)
    setCoins(s.coins)
  }

  return (
    <PageLayout
      onBack={onBack}
      accentColor="#C89B3C"
      flag={
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <rect x="1" y="5" width="13" height="17" rx="3" fill="#7A5030"/>
          <rect x="5" y="1" width="14" height="17" rx="3" fill="#C9A364"/>
          <rect x="6" y="2" width="12" height="15" rx="2.5" stroke="rgba(255,255,255,0.30)" strokeWidth="1" fill="none"/>
        </svg>
      }
      title="MES PACKS"
      subtitle={`${coins.toLocaleString('fr-FR')} pièces disponibles`}
    >

      {/* Low coins banner */}
      {coins < 500 && (
        <div style={{
          marginBottom: 16, padding: '12px 16px',
          background: 'rgba(255,23,68,0.06)',
          border: '1px solid rgba(255,23,68,0.2)',
          borderRadius: 14, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ff1744', marginBottom: 2 }}>
              Pièces insuffisantes
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Gagne des pièces en faisant des pronostics
            </div>
          </div>
          <button onClick={addCoins} style={{
            padding: '8px 14px', background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
            border: 'none', borderRadius: 10, color: '#0D0800',
            fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}>
            +5 000 pièces
          </button>
        </div>
      )}

      {/* Pack list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {configs.map(config => {
          const v         = PACK_VISUALS[config.type]
          const canAfford = coins >= config.price
          const proba     = config.probabilities

          return (
            <div key={config.type} style={{
              borderRadius: 20, overflow: 'hidden',
              border: `2px solid ${v.borderColor}`,
              boxShadow: canAfford ? `0 4px 24px ${v.glow}` : 'none',
              opacity: canAfford ? 1 : 0.6,
              transition: 'all 0.2s',
            }}>
              {/* Top: gradient band with card-stack art */}
              <div style={{
                background: v.gradient,
                padding: '18px 18px 14px',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                {/* Card stack replaces the old emoji */}
                <CardStack type={config.type} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(0,0,0,0.22)', marginBottom: 5,
                    fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: 'rgba(255,255,255,0.92)',
                  }}>
                    {v.badgeText}
                  </div>
                  <div style={{
                    fontFamily: "'Bebas Neue', cursive", fontSize: 26,
                    letterSpacing: 2, color: '#fff', lineHeight: 1,
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  }}>
                    {config.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
                    {config.description}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontFamily: "'Bebas Neue', cursive", fontSize: 28,
                    color: '#fff', lineHeight: 1,
                    textShadow: '0 2px 6px rgba(0,0,0,0.35)',
                  }}>
                    {config.price.toLocaleString('fr-FR')}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, fontWeight: 700 }}>
                    PIÈCES
                  </div>
                </div>
              </div>

              {/* Bottom: probabilities + CTA */}
              <div style={{
                background: 'var(--bg-card)',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ display: 'flex', gap: 5, flex: 1, flexWrap: 'wrap' }}>
                  {(['carnage', 'gold', 'silver', 'bronze'] as Rarity[]).map(r => (
                    <div key={r} style={{
                      fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
                      letterSpacing: 0.3,
                      background: r === 'carnage' ? 'rgba(255,23,68,0.08)'  :
                                  r === 'gold'    ? 'rgba(218,165,32,0.08)' :
                                  r === 'silver'  ? 'rgba(160,160,180,0.08)': 'rgba(160,120,60,0.08)',
                      color: r === 'carnage' ? '#ff1744' :
                             r === 'gold'    ? '#b8860b' :
                             r === 'silver'  ? '#6E6E73' : '#a17d44',
                    }}>
                      {RARITY_LABEL[r]}: {(proba[r] * 100).toFixed(1)}%
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => canAfford && handleOpen(config.type)}
                  disabled={!canAfford}
                  style={{
                    flexShrink: 0, padding: '10px 20px',
                    background: canAfford ? v.gradient : 'var(--bg-fill)',
                    border: 'none', borderRadius: 12,
                    color: canAfford ? '#fff' : 'var(--text-3)',
                    fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
                    cursor: canAfford ? 'pointer' : 'not-allowed',
                    boxShadow: canAfford ? `0 3px 12px ${v.glow}` : 'none',
                    transition: 'all 0.15s',
                  }}
                  onPointerDown={e => canAfford && (e.currentTarget.style.transform = 'scale(0.95)')}
                  onPointerUp={e => canAfford && (e.currentTarget.style.transform = 'scale(1)')}
                >
                  Ouvrir
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <div style={{
        marginTop: 20, padding: '14px 16px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
          Fais des pronostics corrects pour gagner des pièces
        </div>
      </div>

      {/* ── Pack opening overlay ──────────────────────────────── */}
      {phase !== 'idle' && openingType && (
        <PackOpeningOverlay
          phase={phase}
          packType={openingType}
          cards={revealCards}
          onClose={handleClose}
        />
      )}
    </PageLayout>
  )
}

// ─── Pack Opening Overlay ─────────────────────────────────────────────────────
function PackOpeningOverlay({
  phase, packType, cards, onClose,
}: {
  phase: 'shake' | 'burst' | 'reveal'
  packType: PackType
  cards: typeof DEMO_CARDS
  onClose: () => void
}) {
  const v = PACK_VISUALS[packType]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.94)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
      animation: 'fadeIn 0.25s ease',
    }}>
      {/* Phase: shake / burst — animated card stack */}
      {(phase === 'shake' || phase === 'burst') && (
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{
            animation: phase === 'shake'
              ? 'packShake 0.7s ease-in-out'
              : 'packBurst 0.4s ease-out forwards',
          }}>
            <CardStack type={packType} scale={2.0} />
          </div>
          <div style={{
            marginTop: 28, fontSize: 13, fontWeight: 700, letterSpacing: 2.5,
            color: v.badgeColor, textTransform: 'uppercase',
          }}>
            Ouverture…
          </div>
          {/* Glow ring */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 220, height: 220, borderRadius: '50%',
            background: `radial-gradient(circle, ${v.glow} 0%, transparent 70%)`,
            pointerEvents: 'none',
            animation: 'fadeIn 0.3s ease',
          }} />
        </div>
      )}

      {/* Phase: reveal */}
      {phase === 'reveal' && (
        <>
          <div style={{
            fontSize: 12, fontWeight: 800, letterSpacing: 3,
            color: v.badgeColor, textTransform: 'uppercase',
          }}>
            {cards.length} nouvelle{cards.length > 1 ? 's' : ''} carte{cards.length > 1 ? 's' : ''} !
          </div>

          <div style={{
            display: 'flex', gap: 10,
            overflowX: 'auto', padding: '4px 20px 8px',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
          }}>
            {cards.map((card, i) => (
              <RevealedCard key={i} card={card} delay={i * 120} />
            ))}
          </div>

          <button
            onClick={onClose}
            style={{
              marginTop: 8, padding: '14px 40px',
              background: v.gradient,
              border: 'none', borderRadius: 14,
              color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: 1,
              cursor: 'pointer',
              boxShadow: `0 4px 20px ${v.glow}`,
            }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
            onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Continuer
          </button>
        </>
      )}
    </div>
  )
}

// ─── Revealed Card ────────────────────────────────────────────────────────────
function RevealedCard({
  card, delay,
}: {
  card: { name: string; position: string; rarity: Rarity; rating: number; trait: string }
  delay: number
}) {
  const r = card.rarity
  return (
    <div className={`card-${r}`} style={{
      width: 112, flexShrink: 0, borderRadius: 16, overflow: 'hidden', padding: 0,
      boxShadow: r === 'carnage' ? undefined : 'var(--shadow)',
      animation: `cardReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`,
      position: 'relative', scrollSnapAlign: 'center',
    }}>

      {/* ── Photo placeholder (will hold player image later) ── */}
      <div style={{ height: 110, position: 'relative', overflow: 'hidden' }}>
        {/* Depth overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(170deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.50) 100%)',
          pointerEvents: 'none',
        }}/>

        {/* Position silhouette — placeholder until real photo */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%',
          transform: 'translateX(-50%)',
          opacity: 0.20,
        }}>
          <PosIcon pos={card.position} size={58} />
        </div>

        {/* Rating + position — top-left */}
        <div style={{ position: 'absolute', top: 8, left: 10 }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive", fontSize: 32,
            color: '#fff', lineHeight: 1,
            textShadow: '0 2px 8px rgba(0,0,0,0.65)',
          }}>{card.rating}</div>
          <div style={{
            fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.82)',
            letterSpacing: 0.5, marginTop: -4,
          }}>{card.position}</div>
        </div>

        {/* Rarity badge — top-right */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(0,0,0,0.36)',
          borderRadius: 5, padding: '2px 6px',
          fontSize: 7, fontWeight: 800,
          color: 'rgba(255,255,255,0.90)',
          letterSpacing: 0.8, textTransform: 'uppercase',
          backdropFilter: 'blur(4px)',
        }}>{RARITY_LABEL[r]}</div>

        {/* Bottom fade into info section */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 28,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.45))',
          pointerEvents: 'none',
        }}/>
      </div>

      {/* ── Player info ── */}
      <div style={{
        background: 'rgba(0,0,0,0.38)',
        padding: '7px 10px 9px',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive", fontSize: 14,
          letterSpacing: 1.2, color: '#fff', lineHeight: 1.1,
          marginBottom: 5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{card.name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Nation placeholder */}
          <span style={{
            fontSize: 8, color: 'rgba(255,255,255,0.40)', fontWeight: 600, letterSpacing: 0.3,
          }}>— · —</span>
          <span style={{
            fontSize: 7, color: 'rgba(255,255,255,0.62)', fontWeight: 700, letterSpacing: 0.4,
          }}>{card.trait}</span>
        </div>
      </div>
    </div>
  )
}
