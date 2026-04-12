import { useState } from 'react'
import PageLayout from './PageLayout'

const OFFERS = [
  { id: 1, offerer: 'KingDragon',  country: '🇫🇷', offer: { name: 'Mbappé', rating: 95, pos: 'ATT' }, want: { name: 'Vinicius Jr.', rating: 92, pos: 'ATT' } },
  { id: 2, offerer: 'BallonDor',   country: '🇦🇷', offer: { name: 'Di María', rating: 84, pos: 'MIL' }, want: { name: 'Rodrygo', rating: 87, pos: 'MIL' } },
  { id: 3, offerer: 'FutbolMaster', country: '🇧🇷', offer: { name: 'Alisson', rating: 90, pos: 'GK' }, want: { name: 'Sommer', rating: 84, pos: 'GK' } },
  { id: 4, offerer: 'GoalMachine', country: '🇪🇸', offer: { name: 'Pedri', rating: 88, pos: 'MIL' }, want: { name: 'Xhaka', rating: 84, pos: 'MIL' } },
]

const RARITY_COLORS: Record<number, string> = {
  95: '#9b59b6',
  92: '#9b59b6',
  90: '#b0c4de',
  88: '#c9a227',
  87: '#c9a227',
  84: '#4a7fb5',
}

export default function Echange({ onBack }: { onBack: () => void }) {
  const [accepted, setAccepted] = useState<number | null>(null)

  return (
    <PageLayout
      onBack={onBack}
      accentColor="#BC002D"
      flag="🇯🇵"
      title="Échange"
      subtitle="Proposez et acceptez des échanges de cartes"
    >
      {/* My proposal */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(188,0,45,0.07)',
        border: '1px solid rgba(188,0,45,0.22)',
        borderRadius: 16, marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <span style={{ fontSize: 24 }}>➕</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Proposer un échange</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            Offrez une carte contre celle que vous souhaitez
          </div>
        </div>
        <button style={{
          padding: '8px 20px', background: '#BC002D',
          border: 'none', borderRadius: 10,
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: "'Inter', sans-serif",
        }}>
          Créer
        </button>
      </div>

      {/* Active offers */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2.5, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 16 }}>
          Offres disponibles ({OFFERS.length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {OFFERS.map((o, i) => (
            <OfferRow
              key={o.id}
              offer={o}
              accepted={accepted === o.id}
              delay={i * 60}
              onAccept={() => setAccepted(o.id)}
            />
          ))}
        </div>
      </div>

      {/* Accepted overlay */}
      {accepted !== null && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: 64, animation: 'float 1.5s ease-in-out infinite' }}>🔄</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Échange réussi !</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Votre carte a été échangée
          </div>
          <button
            className="btn btn-gold"
            onClick={() => setAccepted(null)}
          >
            Continuer
          </button>
        </div>
      )}
    </PageLayout>
  )
}

function CardChip({ card, color }: { card: { name: string; rating: number; pos: string }; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: `${color}18`,
      border: `1px solid ${color}44`,
      borderRadius: 10,
    }}>
      <div style={{
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 22, color, lineHeight: 1,
      }}>{card.rating}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{card.name}</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{card.pos}</div>
      </div>
    </div>
  )
}

function OfferRow({ offer, accepted, delay, onAccept }: {
  offer: typeof OFFERS[0]; accepted: boolean; delay: number; onAccept: () => void
}) {
  const offerColor = RARITY_COLORS[offer.offer.rating] ?? '#4a7fb5'
  const wantColor  = RARITY_COLORS[offer.want.rating]  ?? '#4a7fb5'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px',
      background: accepted ? 'rgba(188,0,45,0.1)' : 'rgba(255,255,255,0.03)',
      border: accepted ? '1px solid rgba(188,0,45,0.4)' : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      animation: `fadeSlideUp 0.35s ease ${delay}ms both`,
      transition: 'all 0.2s',
    }}>
      {/* Offerer */}
      <div style={{ width: 36, textAlign: 'center' }}>
        <div style={{ fontSize: 18 }}>{offer.country}</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{offer.offerer}</div>
      </div>

      {/* Cards */}
      <CardChip card={offer.offer} color={offerColor} />

      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>⇄</div>

      <CardChip card={offer.want} color={wantColor} />

      <div style={{ flex: 1 }} />

      <button
        onClick={onAccept}
        style={{
          padding: '8px 16px',
          background: '#BC002D',
          border: 'none', borderRadius: 8,
          color: '#fff', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', transition: 'all 0.2s',
          fontFamily: "'Inter', sans-serif",
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLButtonElement).style.background = '#e6003a'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.background = '#BC002D'
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
        }}
      >
        Accepter
      </button>
    </div>
  )
}
