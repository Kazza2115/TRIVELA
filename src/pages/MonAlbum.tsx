import { useState } from 'react'
import PageLayout from './PageLayout'

const GROUPS = [
  {
    name: 'Groupe A — Brésil',
    flag: '🇧🇷',
    color: '#009C3B',
    players: [
      { name: 'Vinicius Jr.',  rating: 92, pos: 'ATT', have: true  },
      { name: 'Rodrygo',       rating: 87, pos: 'MIL', have: true  },
      { name: 'Marquinhos',    rating: 88, pos: 'DEF', have: false },
      { name: 'Alisson',       rating: 90, pos: 'GK',  have: true  },
      { name: 'Endrick',       rating: 83, pos: 'ATT', have: false },
      { name: 'Casemiro',      rating: 86, pos: 'MIL', have: false },
    ],
  },
  {
    name: 'Groupe B — Sénégal',
    flag: '🇸🇳',
    color: '#00A550',
    players: [
      { name: 'Sadio Mané',   rating: 89, pos: 'ATT', have: true  },
      { name: 'Gana Gueye',   rating: 83, pos: 'MIL', have: false },
      { name: 'Édouard Mendy',rating: 85, pos: 'GK',  have: true  },
      { name: 'Koulibaly',    rating: 84, pos: 'DEF', have: false },
    ],
  },
  {
    name: 'Groupe C — Suisse',
    flag: '🇨🇭',
    color: '#FF0000',
    players: [
      { name: 'Xhaka',       rating: 84, pos: 'MIL', have: true  },
      { name: 'Shaqiri',     rating: 83, pos: 'MIL', have: true  },
      { name: 'Sommer',      rating: 84, pos: 'GK',  have: false },
      { name: 'Embolo',      rating: 81, pos: 'ATT', have: false },
    ],
  },
]

export default function MonAlbum({ onBack }: { onBack: () => void }) {
  const [activeGroup, setActiveGroup] = useState(0)

  const allCards = GROUPS.flatMap(g => g.players)
  const collected = allCards.filter(p => p.have).length
  const total = allCards.length

  return (
    <PageLayout
      onBack={onBack}
      accentColor="#FF0000"
      flag="🇨🇭"
      title="Mon Album"
      subtitle="Votre collection de cartes joueurs"
    >
      {/* Progress */}
      <div style={{
        padding: '18px 20px',
        background: 'rgba(255,0,0,0.06)',
        border: '1px solid rgba(255,0,0,0.18)',
        borderRadius: 16, marginBottom: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            Progression totale
          </span>
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 20, color: '#FF0000', letterSpacing: 1,
          }}>
            {collected} / {total}
          </span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${(collected / total) * 100}%`,
            background: 'linear-gradient(90deg, #FF0000, #ff6666)',
            borderRadius: 4,
            transition: 'width 1s ease',
          }} />
        </div>
      </div>

      {/* Group tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, overflowX: 'auto', paddingBottom: 4 }}>
        {GROUPS.map((g, i) => (
          <button
            key={i}
            onClick={() => setActiveGroup(i)}
            style={{
              padding: '8px 16px',
              background: activeGroup === i ? g.color : 'rgba(255,255,255,0.05)',
              border: `1px solid ${activeGroup === i ? g.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 20,
              color: activeGroup === i ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {g.flag} {g.name.split('—')[1].trim()}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      {GROUPS.map((g, gi) => gi === activeGroup && (
        <div key={gi}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 14,
          }}>
            {g.players.map((p, i) => (
              <AlbumCard key={i} player={p} groupColor={g.color} delay={i * 60} />
            ))}
          </div>
        </div>
      ))}
    </PageLayout>
  )
}

function AlbumCard({ player, groupColor, delay }: {
  player: { name: string; rating: number; pos: string; have: boolean }
  groupColor: string
  delay: number
}) {
  return (
    <div style={{
      height: 150,
      background: player.have
        ? `linear-gradient(160deg, ${groupColor}33, ${groupColor}11)`
        : 'rgba(255,255,255,0.03)',
      border: player.have
        ? `1.5px solid ${groupColor}55`
        : '1.5px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 5, padding: 10,
      transition: 'all 0.25s',
      animation: `scaleIn 0.3s ease ${delay}ms both`,
      cursor: player.have ? 'pointer' : 'default',
      boxShadow: player.have ? `0 4px 18px ${groupColor}22` : 'none',
    }}
    onMouseEnter={e => {
      if (player.have) {
        ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = `0 8px 28px ${groupColor}44`
      }
    }}
    onMouseLeave={e => {
      ;(e.currentTarget as HTMLElement).style.transform = 'none'
      ;(e.currentTarget as HTMLElement).style.boxShadow = player.have ? `0 4px 18px ${groupColor}22` : 'none'
    }}>
      {player.have ? (
        <>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 32, color: groupColor, letterSpacing: 1, lineHeight: 1,
          }}>{player.rating}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 1 }}>
            {player.pos}
          </div>
          <div style={{
            fontSize: 10, color: '#fff', fontWeight: 700,
            textAlign: 'center', lineHeight: 1.4,
          }}>
            {player.name}
          </div>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: groupColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#fff',
          }}>✓</div>
        </>
      ) : (
        <>
          <div style={{
            fontSize: 28, color: 'rgba(255,255,255,0.08)',
          }}>?</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontWeight: 600, textAlign: 'center' }}>
            Non collecté
          </div>
        </>
      )}
    </div>
  )
}
