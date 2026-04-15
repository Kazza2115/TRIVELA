import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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

// ─── Rarity palette ──────────────────────────────────────────────────────────
const RARITY_RANK: Record<Rarity, number>  = { bronze: 0, silver: 1, gold: 2, carnage: 3 }
const RARITY_COLOR: Record<Rarity, string> = {
  bronze: '#C9A364', silver: '#C8C8D8', gold: '#FFD700', carnage: '#FF1744',
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

  // ── Reveal state ──────────────────────────────────────────────────────────
  const sorted = useMemo(
    () => [...cards].sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]),
    [cards],
  )
  const [revealIdx, setRevealIdx] = useState(0)
  const [cardAnim,  setCardAnim]  = useState<'in' | 'idle' | 'out'>('in')
  const touchRef    = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const cardWrapRef = useRef<HTMLDivElement>(null)

  // 'in' auto-settles to 'idle' after entrance animation
  useEffect(() => {
    if (phase !== 'reveal' || cardAnim !== 'in') return
    const t = setTimeout(() => setCardAnim('idle'), 600)
    return () => clearTimeout(t)
  }, [phase, cardAnim])

  // Prevent the page from scrolling/swiping while touching the card area
  useEffect(() => {
    if (phase !== 'reveal') return
    const el = cardWrapRef.current
    if (!el) return
    const prevent = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchmove', prevent, { passive: false })
    return () => el.removeEventListener('touchmove', prevent)
  }, [phase])

  const advance = useCallback(() => {
    if (cardAnim !== 'idle') return
    if (revealIdx >= sorted.length - 1) { onClose(); return }
    setCardAnim('out')
    setTimeout(() => { setRevealIdx(i => i + 1); setCardAnim('in') }, 400)
  }, [cardAnim, revealIdx, sorted.length, onClose])

  const onTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.y)
    if (dx < -45 && dy < 90) advance()
  }

  const currentCard = sorted[revealIdx]
  const isLast      = sorted.length > 0 && revealIdx === sorted.length - 1
  const bestCard    = sorted[sorted.length - 1]
  const bestColor   = bestCard ? RARITY_COLOR[bestCard.rarity] : v.badgeColor
  const numGhosts   = Math.min(sorted.length - revealIdx - 1, 3)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.96)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 0,
      animation: 'fadeIn 0.25s ease',
    }}>

      {/* Mysterious bottom glow — color of best card, barely visible, pulses */}
      {phase === 'reveal' && bestCard && bestCard.rarity !== 'bronze' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
          background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${bestColor}22 0%, transparent 65%)`,
          pointerEvents: 'none',
          animation: 'lastCardGlow 2.4s ease-in-out infinite',
        }}/>
      )}

      {/* ── Shake / Burst ── */}
      {(phase === 'shake' || phase === 'burst') && (
        <div style={{ textAlign: 'center', position: 'relative', overflow: 'visible', width: 280 }}>
          <div style={{
            overflow: 'visible',
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
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 220, height: 220, borderRadius: '50%',
            background: `radial-gradient(circle, ${v.glow} 0%, transparent 70%)`,
            pointerEvents: 'none', animation: 'fadeIn 0.3s ease',
          }} />
        </div>
      )}

      {/* ── Reveal ── */}
      {phase === 'reveal' && (
        <>
          {/* Rarity indicator row — last dot always pulses (best card visible from card 1) */}
          <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 28 }}>
            {sorted.map((c, i) => {
              const col      = RARITY_COLOR[c.rarity]
              const revealed = i < revealIdx
              const current  = i === revealIdx
              const isLastDot = i === sorted.length - 1
              return (
                <div key={i} style={{
                  width:  isLastDot ? 13 : current ? 10 : 7,
                  height: isLastDot ? 13 : current ? 10 : 7,
                  borderRadius: '50%',
                  background: (revealed || current) ? col : 'rgba(255,255,255,0.16)',
                  boxShadow: current  ? `0 0 8px ${col}, 0 0 18px ${col}` :
                             revealed  ? `0 0 4px ${col}` : 'none',
                  animation: isLastDot && !current ? `dotPulse 1.6s ease-in-out infinite` : 'none',
                  transition: 'all 0.35s',
                  // Always show best color so it's visible regardless of current card
                  opacity: (revealed || current || isLastDot) ? 1 : 0.35,
                }}/>
              )
            })}
          </div>

          {/* Counter */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
            color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            Carte {revealIdx + 1} / {sorted.length}
          </div>

          {/* Card stack — current card with ghost cards peeking behind */}
          {/* Shift left by half the ghost overhang so the stack stays centered */}
          <div ref={cardWrapRef}
            style={{
              position: 'relative', width: 200, overflow: 'visible',
              transform: `translateX(-${numGhosts * 6.5}px)`,
              transition: 'transform 0.3s ease',
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onClick={advance}
          >
            {/* Ghost cards — each shows the actual rarity color of that card */}
            {sorted.slice(revealIdx + 1, revealIdx + 4).map((upcomingCard, i) => (
              <div key={i} style={{
                position: 'absolute',
                top: (i + 1) * 5,
                left: (i + 1) * 13,
                zIndex: 9 - i,
                opacity: 1 - (i + 1) * 0.22,
                transform: `rotate(${(i + 1) * 3}deg)`,
                pointerEvents: 'none',
              }}>
                <CardBack rarity={upcomingCard.rarity} />
              </div>
            ))}

            {/* Current card (front) */}
            <div style={{ position: 'relative', zIndex: 10, cursor: cardAnim === 'idle' ? 'pointer' : 'default' }}>
              <BigRevealCard
                card={currentCard}
                anim={cardAnim}
                isLast={isLast}
                bestColor={bestColor}
              />
            </div>
          </div>

          {/* Swipe hint / CTA */}
          <div style={{ marginTop: 28, textAlign: 'center' }}>
            {!isLast ? (
              <>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.38)', letterSpacing: 1.5,
                  marginBottom: 14,
                }}>
                  ← Glisse pour la suivante
                </div>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 20px', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10,
                    color: 'rgba(255,255,255,0.42)', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', letterSpacing: 0.5,
                  }}
                >
                  Tout afficher
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                style={{
                  padding: '14px 44px',
                  background: v.gradient,
                  border: 'none', borderRadius: 14,
                  color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: 1,
                  cursor: 'pointer',
                  boxShadow: `0 4px 20px ${v.glow}`,
                  animation: 'fadeIn 0.4s ease',
                }}
                onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Continuer
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Card Back (face-down ghost card in the stack) ───────────────────────────
function CardBack({ rarity }: { rarity: Rarity }) {
  return (
    <div className={`card-${rarity}`} style={{
      width: 200, height: 260, borderRadius: 20, overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
    }}>
      <div style={{
        margin: 11, height: 'calc(100% - 22px)',
        border: '1px solid rgba(255,255,255,0.28)',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.16)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" opacity="0.32">
          <polygon points="28,4 52,28 28,52 4,28"
            stroke="white" strokeWidth="1.5" fill="none"/>
          <polygon points="28,14 42,28 28,42 14,28"
            stroke="white" strokeWidth="1.5" fill="none"/>
          <circle cx="28" cy="28" r="5" fill="white"/>
        </svg>
      </div>
    </div>
  )
}

// ─── Big Reveal Card (one-by-one overlay) ────────────────────────────────────
function BigRevealCard({
  card, anim, isLast, bestColor,
}: {
  card: { name: string; position: string; rarity: Rarity; rating: number; trait: string }
  anim: 'in' | 'idle' | 'out'
  isLast: boolean
  bestColor: string
}) {
  const r       = card.rarity
  const rarCol  = RARITY_COLOR[r]

  const animation =
    anim === 'in'  ? 'bigCardEnter 0.58s cubic-bezier(0.34,1.44,0.64,1) forwards' :
    anim === 'out' ? 'bigCardExit 0.38s ease-in forwards' :
    'none'

  // Outer wrapper handles animation — NO overflow:hidden so corners are never clipped
  // Inner div handles the visual card with overflow:hidden for content clipping
  return (
    <div style={{ animation, overflow: 'visible' }}>
    <div className={`card-${r}`} style={{
      width: 200, borderRadius: 20, overflow: 'hidden', position: 'relative',
      // Last card: pulsing glow border
      boxShadow: isLast
        ? `0 0 0 2px ${rarCol}, 0 0 28px ${rarCol}, 0 0 60px ${bestColor}55`
        : `0 8px 32px rgba(0,0,0,0.55)`,
    }}>
      {/* Special top shine strip for last card */}
      {isLast && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 2,
          background: `linear-gradient(90deg, transparent, ${rarCol}, transparent)`,
          animation: 'lastCardGlow 1.2s ease-in-out infinite',
        }}/>
      )}

      {/* ── Photo placeholder ── */}
      <div style={{ height: 196, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(170deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}/>

        {/* Position silhouette — will be replaced by player photo */}
        <div style={{
          position: 'absolute', bottom: 10, left: '50%',
          transform: 'translateX(-50%)', opacity: 0.18,
        }}>
          <PosIcon pos={card.position} size={84} />
        </div>

        {/* Rating + position */}
        <div style={{ position: 'absolute', top: 12, left: 14 }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive", fontSize: 44,
            color: '#fff', lineHeight: 1,
            textShadow: '0 3px 10px rgba(0,0,0,0.7)',
          }}>{card.rating}</div>
          <div style={{
            fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.80)',
            letterSpacing: 0.6, marginTop: -5,
          }}>{card.position}</div>
        </div>

        {/* Rarity badge */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(4px)',
          borderRadius: 6, padding: '3px 8px',
          fontSize: 8, fontWeight: 800,
          color: rarCol, letterSpacing: 1, textTransform: 'uppercase',
          border: `1px solid ${rarCol}55`,
        }}>{RARITY_LABEL[r]}</div>

        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.50))',
          pointerEvents: 'none',
        }}/>
      </div>

      {/* ── Player info ── */}
      <div style={{
        background: 'rgba(0,0,0,0.42)', padding: '10px 14px 13px',
        backdropFilter: 'blur(6px)',
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive", fontSize: 20,
          letterSpacing: 1.5, color: '#fff', lineHeight: 1.1,
          marginBottom: 6,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{card.name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', fontWeight: 600 }}>— · —</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
            color: rarCol, opacity: 0.85,
          }}>{card.trait}</span>
        </div>
      </div>
    </div>  {/* end inner visual card */}
    </div>  /* end animation wrapper */
  )
}
