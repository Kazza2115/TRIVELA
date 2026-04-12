import PageLayout from './PageLayout'

const PLAYERS = [
  { rank: 1,  name: 'KingDragon', country: '🇫🇷', score: 48_200, cards: 324, badge: '👑' },
  { rank: 2,  name: 'FutbolMaster', country: '🇧🇷', score: 45_780, cards: 298, badge: '🥈' },
  { rank: 3,  name: 'WcLegend',   country: '🇩🇪', score: 42_100, cards: 276, badge: '🥉' },
  { rank: 4,  name: 'Trivelero',  country: '🇳🇱', score: 39_450, cards: 251, badge: '' },
  { rank: 5,  name: 'GoalMachine', country: '🇪🇸', score: 37_200, cards: 238, badge: '' },
  { rank: 6,  name: 'BallonDor',  country: '🇦🇷', score: 34_900, cards: 220, badge: '' },
  { rank: 7,  name: 'You',        country: '🇺🇳', score: 12_450, cards: 87,  badge: '⭐', isMe: true },
]

export default function Classement({ onBack }: { onBack: () => void }) {
  return (
    <PageLayout
      onBack={onBack}
      accentColor="#00A550"
      flag="🇸🇳"
      title="Classement"
      subtitle="Top joueurs de la saison"
    >
      {/* Season bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        background: 'rgba(0,165,80,0.08)',
        border: '1px solid rgba(0,165,80,0.2)',
        borderRadius: 14, marginBottom: 28,
      }}>
        <div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>SAISON ACTUELLE</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Coupe du Monde 2026 — Phase de groupes</div>
        </div>
        <div style={{
          padding: '6px 16px',
          background: '#00A550',
          borderRadius: 20,
          fontSize: 12, fontWeight: 700, color: '#fff',
        }}>
          EN COURS
        </div>
      </div>

      {/* Podium */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 32,
        justifyContent: 'center', alignItems: 'flex-end',
      }}>
        {[PLAYERS[1], PLAYERS[0], PLAYERS[2]].map((p, i) => {
          const heights = [120, 150, 100]
          const colors = ['#c0c0c0', '#ffd700', '#cd7f32']
          return (
            <div key={p.rank} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              flex: '0 0 auto', width: 110,
            }}>
              <div style={{ fontSize: 24 }}>{p.country}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{p.score.toLocaleString()} pts</div>
              <div style={{
                width: '100%', height: heights[i],
                background: `linear-gradient(180deg, ${colors[i]}33, ${colors[i]}11)`,
                border: `1.5px solid ${colors[i]}55`,
                borderRadius: '10px 10px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>
                {[p, p, p][i].badge || `#${p.rank}`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Full ranking */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PLAYERS.map((p, i) => (
          <div key={p.rank} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 18px',
            background: p.isMe
              ? 'rgba(0,165,80,0.12)'
              : 'rgba(255,255,255,0.03)',
            border: p.isMe
              ? '1px solid rgba(0,165,80,0.35)'
              : '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            transition: 'all 0.2s',
            animation: `fadeSlideUp 0.4s ease ${i * 40}ms both`,
          }}>
            <div style={{
              width: 32, fontFamily: "'Bebas Neue', cursive",
              fontSize: 20, color: p.rank <= 3 ? '#ffd700' : 'rgba(255,255,255,0.3)',
              textAlign: 'center',
            }}>
              {p.badge || p.rank}
            </div>
            <div style={{ fontSize: 20 }}>{p.country}</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: p.isMe ? '#00d966' : '#fff',
              }}>{p.name} {p.isMe && <span style={{ fontSize: 10, opacity: 0.6 }}>(Vous)</span>}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                {p.cards} cartes collectées
              </div>
            </div>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 18, color: '#fff', letterSpacing: 1,
            }}>
              {p.score.toLocaleString()} <span style={{ fontSize: 10, opacity: 0.4 }}>pts</span>
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  )
}
