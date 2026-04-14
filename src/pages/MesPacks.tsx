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
  emoji: string
  gradient: string
  glow: string
  badgeColor: string
  badgeText: string
  borderColor: string
}> = {
  starter: {
    emoji: '📦',
    gradient: 'linear-gradient(145deg, #c9a364 0%, #a17d44 50%, #8c6a34 100%)',
    glow: 'rgba(201,163,100,0.35)',
    badgeColor: '#b08d4c',
    badgeText: 'DÉBUTANT',
    borderColor: '#b08d4c',
  },
  pro: {
    emoji: '✨',
    gradient: 'linear-gradient(145deg, #ffd700 0%, #daa520 35%, #b8860b 70%, #daa520 100%)',
    glow: 'rgba(255,215,0,0.35)',
    badgeColor: '#daa520',
    badgeText: 'PRO',
    borderColor: '#e8c32a',
  },
  superstar: {
    emoji: '💥',
    gradient: 'linear-gradient(145deg, #ff1744 0%, #d50000 30%, #ff1744 50%, #ff6f00 70%, #ff1744 100%)',
    glow: 'rgba(255,23,68,0.50)',
    badgeColor: '#ff1744',
    badgeText: 'SUPERSTAR',
    borderColor: '#ff3d00',
  },
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function posIcon(pos: string) {
  return pos === 'GK' ? '🧤' : pos === 'DEF' ? '🛡️' : pos === 'MID' ? '🎯' : '⚡'
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MesPacks({ onBack }: { onBack: () => void }) {
  const [coins,       setCoins]       = useState(() => getCollection().coins)
  const [phase,       setPhase]       = useState<'idle' | 'shake' | 'burst' | 'reveal'>('idle')
  const [openingType, setOpeningType] = useState<PackType | null>(null)
  const [revealCards, setRevealCards] = useState<typeof DEMO_CARDS>([])

  // Refresh coin count when re-entering
  useEffect(() => { setCoins(getCollection().coins) }, [])

  const configs = getPackConfigs()

  const handleOpen = (type: PackType) => {
    const config = configs.find(c => c.type === type)!
    if (coins < config.price) return

    setOpeningType(type)
    setPhase('shake')

    // shake → burst → reveal
    setTimeout(() => setPhase('burst'),  700)
    setTimeout(() => {
      const rawCards = openPack(type)
      // Build display cards
      let displayCards: typeof DEMO_CARDS
      if (rawCards.length > 0) {
        displayCards = rawCards.map((c: OwnedCard) => {
          const p = PLAYERS.find(pl => pl.id === c.playerId)
          return p
            ? { name: p.name, position: p.position, rarity: p.rarity, rating: p.rating, trait: p.trait }
            : { name: '???', position: 'ATT', rarity: 'bronze' as Rarity, rating: 70, trait: 'Mystère' }
        })
      } else {
        // Player database empty — show demo preview cards for the selected pack rarity
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

  // Add free coins (dev helper button — shown only when coins < 500)
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
      flag="📦"
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

      {/* Pack grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {configs.map(config => {
          const v       = PACK_VISUALS[config.type]
          const canAfford = coins >= config.price
          const proba   = config.probabilities

          return (
            <div key={config.type} style={{
              borderRadius: 20, overflow: 'hidden',
              border: `2px solid ${v.borderColor}`,
              boxShadow: canAfford ? `0 4px 24px ${v.glow}` : 'none',
              opacity: canAfford ? 1 : 0.6,
              transition: 'all 0.2s',
            }}>
              {/* Top: gradient pack art */}
              <div style={{
                background: v.gradient,
                padding: '20px 20px 16px',
                display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ fontSize: 52, lineHeight: 1, flexShrink: 0 }}>{v.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(0,0,0,0.2)', marginBottom: 4,
                    fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: 'rgba(255,255,255,0.9)',
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
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
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
                {/* Rarity pills */}
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

                {/* Open button */}
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
          💡 Fais des pronostics corrects pour gagner des pièces
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
      {/* Phase: shake / burst */}
      {(phase === 'shake' || phase === 'burst') && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 100, lineHeight: 1,
            animation: phase === 'shake'
              ? 'packShake 0.7s ease-in-out'
              : 'packBurst 0.4s ease-out forwards',
          }}>
            {v.emoji}
          </div>
          <div style={{
            marginTop: 20, fontSize: 14, fontWeight: 700, letterSpacing: 2,
            color: v.badgeColor, textTransform: 'uppercase',
          }}>
            Ouverture…
          </div>
          {/* Glow ring */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 200, height: 200, borderRadius: '50%',
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

          {/* Cards */}
          <div style={{
            display: 'flex', gap: 10, flexWrap: 'wrap',
            justifyContent: 'center', maxWidth: 380, padding: '0 16px',
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
      width: 100, borderRadius: 14, overflow: 'hidden', padding: 0,
      boxShadow: r === 'carnage' ? undefined : 'var(--shadow)',
      animation: `cardReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms both`,
      position: 'relative',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '6px 8px 3px',
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', cursive", fontSize: 20, color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,0.4)', lineHeight: 1,
        }}>{card.rating}</span>
        <span style={{
          fontSize: 7, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.85)',
        }}>{RARITY_LABEL[r]}</span>
      </div>

      {/* Icon */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '3px 8px 5px',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          border: '2px solid rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>
          {posIcon(card.position)}
        </div>
      </div>

      {/* Name + info */}
      <div style={{ background: 'rgba(0,0,0,0.28)', padding: '6px 8px 8px', backdropFilter: 'blur(4px)' }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive", fontSize: 12, letterSpacing: 1.2,
          color: '#fff', lineHeight: 1.1, marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{card.name}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{card.position}</span>
          <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: 0.5 }}>
            {card.trait}
          </span>
        </div>
      </div>
    </div>
  )
}
