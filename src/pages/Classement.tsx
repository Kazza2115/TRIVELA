import PageLayout from './PageLayout'

const PLAYERS = [
  { rank: 1,  name: 'KingDragon',   country: '🇫🇷', score: 48_200, badge: '👑' },
  { rank: 2,  name: 'FutbolMaster', country: '🇧🇷', score: 45_780, badge: '🥈' },
  { rank: 3,  name: 'WcLegend',     country: '🇩🇪', score: 42_100, badge: '🥉' },
  { rank: 4,  name: 'Trivelero',    country: '🇳🇱', score: 39_450, badge: '' },
  { rank: 5,  name: 'GoalMachine',  country: '🇪🇸', score: 37_200, badge: '' },
  { rank: 6,  name: 'BallonDor',    country: '🇦🇷', score: 34_900, badge: '' },
  { rank: 7,  name: 'You',          country: '🇺🇳', score: 12_450, badge: '⭐', isMe: true },
]

const PODIUM_COLORS = ['#B0B0B8', '#C89B3C', '#A0724E']

export default function Classement({ onBack }: { onBack: () => void }) {
  return (
    <PageLayout
      onBack={onBack}
      accentColor="#C89B3C"
      flag="🏆"
      title="CLASSEMENT"
      subtitle="Top joueurs de la saison"
    >
      {/* Season pill */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
            Saison actuelle
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
            Coupe du Monde 2026
          </div>
        </div>
        <div style={{
          padding: '5px 12px',
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 20,
          fontSize: 11, fontWeight: 700, color: '#16a34a',
        }}>
          EN COURS
        </div>
      </div>

      {/* Podium */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 28,
        justifyContent: 'center', alignItems: 'flex-end',
      }}>
        {[PLAYERS[1], PLAYERS[0], PLAYERS[2]].map((p, i) => {
          const heights = [110, 140, 90]
          const c = PODIUM_COLORS[i]
          return (
            <div key={p.rank} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              flex: '0 0 auto', width: 100,
            }}>
              <div style={{ fontSize: 22 }}>{p.country}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', textAlign: 'center' }}>
                {p.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{p.score.toLocaleString()} pts</div>
              <div style={{
                width: '100%', height: heights[i],
                background: `linear-gradient(180deg, ${c}22, ${c}08)`,
                border: `1.5px solid ${c}44`,
                borderRadius: '10px 10px 0 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26,
                boxShadow: `inset 0 0 0 1px ${c}22`,
              }}>
                {p.badge || `#${p.rank}`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Full list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PLAYERS.map((p, i) => (
          <div key={p.rank} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            background: p.isMe ? 'rgba(200,155,60,0.08)' : 'var(--bg-card)',
            border: p.isMe ? '1px solid rgba(200,155,60,0.35)' : '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-sm)',
            animation: `fadeSlideUp 0.35s ease ${i * 35}ms both`,
            transition: 'background 0.2s',
          }}>
            <div style={{
              width: 28, fontFamily: "'Bebas Neue', cursive",
              fontSize: 18, textAlign: 'center',
              color: p.rank <= 3 ? '#C89B3C' : 'var(--text-3)',
            }}>
              {p.badge || p.rank}
            </div>
            <div style={{ fontSize: 18 }}>{p.country}</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: p.isMe ? '#A07828' : 'var(--text-1)',
              }}>
                {p.name}
                {p.isMe && <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, marginLeft: 5 }}>(Vous)</span>}
              </div>
            </div>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 17, color: 'var(--text-1)', letterSpacing: 0.5,
            }}>
              {p.score.toLocaleString()}&thinsp;<span style={{ fontSize: 9, color: 'var(--text-3)' }}>pts</span>
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  )
}
