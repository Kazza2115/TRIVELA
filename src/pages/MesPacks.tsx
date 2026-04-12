import { useState } from 'react'
import PageLayout from './PageLayout'

const PACKS = [
  { id: 1, name: 'Pack Standard',  rarity: 'standard', cards: 5,  cost: '100 pts', color: '#4a7fb5' },
  { id: 2, name: 'Pack Or',        rarity: 'gold',     cards: 5,  cost: '250 pts', color: '#c9a227' },
  { id: 3, name: 'Pack Platine',   rarity: 'platinum', cards: 7,  cost: '500 pts', color: '#b0c4de' },
  { id: 4, name: 'Pack Légendaire',rarity: 'legend',   cards: 10, cost: '1000 pts',color: '#9b59b6' },
]

const MY_PACKS = [
  { id: 1, type: 'gold',     name: 'Pack Or'       },
  { id: 2, type: 'standard', name: 'Pack Standard'  },
  { id: 3, type: 'gold',     name: 'Pack Or'       },
  { id: 4, type: 'platinum', name: 'Pack Platine'   },
]

const RARITY_COLORS: Record<string, string> = {
  standard: '#4a7fb5',
  gold:      '#c9a227',
  platinum:  '#b0c4de',
  legend:    '#9b59b6',
}

const REVEALED_CARDS = [
  { player: 'Vinicius Jr.', country: '🇧🇷', rating: 92, pos: 'ATT', rarity: 'legend' },
  { player: 'Rodrygo',      country: '🇧🇷', rating: 87, pos: 'MIL', rarity: 'gold'   },
  { player: 'Marquinhos',   country: '🇧🇷', rating: 88, pos: 'DEF', rarity: 'gold'   },
  { player: 'Endrick',      country: '🇧🇷', rating: 83, pos: 'ATT', rarity: 'standard'},
  { player: 'Alisson',      country: '🇧🇷', rating: 90, pos: 'GK',  rarity: 'platinum'},
]

export default function MesPacks({ onBack }: { onBack: () => void }) {
  const [opening, setOpening] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)

  const handleOpen = (packId: number) => {
    setOpening(packId)
    setTimeout(() => setRevealed(true), 800)
  }

  const handleClose = () => {
    setOpening(null)
    setRevealed(false)
  }

  return (
    <PageLayout
      onBack={onBack}
      accentColor="#009C3B"
      flag="🇧🇷"
      title="Mes Packs"
      subtitle="Ouvrez vos packs pour découvrir de nouvelles cartes"
    >
      {/* My packs */}
      <section style={{ marginBottom: 40 }}>
        <SectionTitle>Mes packs à ouvrir ({MY_PACKS.length})</SectionTitle>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {MY_PACKS.map((pack, i) => (
            <PackCard
              key={i}
              name={pack.name}
              color={RARITY_COLORS[pack.type]}
              onOpen={() => handleOpen(pack.id)}
            />
          ))}
        </div>
      </section>

      {/* Shop */}
      <section>
        <SectionTitle>Boutique</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {PACKS.map(p => (
            <ShopPackCard key={p.id} pack={p} />
          ))}
        </div>
      </section>

      {/* Pack opening overlay */}
      {opening !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.3s ease',
        }}>
          {!revealed ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 80,
                animation: 'float 0.8s ease-in-out infinite, pulse-brazil 0.8s ease-in-out infinite',
                marginBottom: 20,
              }}>📦</div>
              <div style={{ color: '#c9a227', fontSize: 16, fontWeight: 600, letterSpacing: 2 }}>
                Ouverture en cours…
              </div>
            </div>
          ) : (
            <div style={{ animation: 'scaleIn 0.4s ease', textAlign: 'center' }}>
              <div style={{ fontSize: 13, letterSpacing: 2, color: '#c9a227', marginBottom: 20, fontWeight: 600 }}>
                5 NOUVELLES CARTES !
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
                {REVEALED_CARDS.map((card, i) => (
                  <PlayerCard key={i} card={card} delay={i * 100} />
                ))}
              </div>
              <button className="btn btn-gold" onClick={handleClose}>
                Continuer
              </button>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  )
}

function PackCard({ name, color, onOpen }: { name: string; color: string; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      style={{
        width: 130, height: 180,
        background: `linear-gradient(160deg, ${color}33, ${color}11)`,
        border: `1.5px solid ${color}55`,
        borderRadius: 14,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 10, cursor: 'pointer',
        transition: 'all 0.25s',
        boxShadow: `0 4px 24px ${color}22`,
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-6px) scale(1.03)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 12px 36px ${color}44`
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.transform = 'none'
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 4px 24px ${color}22`
      }}
    >
      <span style={{ fontSize: 40, animation: 'float 3s ease-in-out infinite' }}>📦</span>
      <span style={{ fontSize: 12, color, fontWeight: 700, letterSpacing: 0.5 }}>{name}</span>
      <span style={{
        fontSize: 10, color: '#fff', background: color,
        padding: '3px 10px', borderRadius: 20, fontWeight: 700,
      }}>OUVRIR</span>
    </div>
  )
}

function ShopPackCard({ pack }: { pack: typeof PACKS[0] }) {
  return (
    <div style={{
      background: `linear-gradient(160deg, ${pack.color}22, rgba(0,0,0,0.4))`,
      border: `1px solid ${pack.color}44`,
      borderRadius: 16, padding: '20px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.25s',
      cursor: 'pointer',
    }}
    onMouseEnter={e => {
      ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
      ;(e.currentTarget as HTMLElement).style.borderColor = `${pack.color}88`
    }}
    onMouseLeave={e => {
      ;(e.currentTarget as HTMLElement).style.transform = 'none'
      ;(e.currentTarget as HTMLElement).style.borderColor = `${pack.color}44`
    }}>
      <div style={{ fontSize: 32, textAlign: 'center' }}>📦</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: pack.color }}>{pack.name}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{pack.cards} cartes</div>
      <button style={{
        padding: '7px 12px', background: pack.color,
        border: 'none', borderRadius: 8,
        color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
      }}>
        {pack.cost}
      </button>
    </div>
  )
}

function PlayerCard({ card, delay }: { card: typeof REVEALED_CARDS[0]; delay: number }) {
  const c = RARITY_COLORS[card.rarity]
  return (
    <div style={{
      width: 100, height: 145,
      background: `linear-gradient(160deg, ${c}44, ${c}11)`,
      border: `1.5px solid ${c}88`,
      borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 4, padding: 8,
      animation: `scaleIn 0.4s ease ${delay}ms both`,
      boxShadow: `0 4px 20px ${c}44`,
    }}>
      <div style={{ fontSize: 24 }}>{card.country}</div>
      <div style={{
        fontSize: 22, fontWeight: 900, color: c,
        fontFamily: "'Bebas Neue', cursive", letterSpacing: 1,
      }}>{card.rating}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{card.pos}</div>
      <div style={{ fontSize: 10, color: '#fff', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
        {card.player}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 12, fontWeight: 700, letterSpacing: 2.5,
      color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
      marginBottom: 16,
    }}>
      {children}
    </h2>
  )
}
