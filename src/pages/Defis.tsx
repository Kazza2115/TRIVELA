import PageLayout from './PageLayout'

const DEFIS = [
  {
    id: 1,
    title: 'Collecte Express',
    desc: 'Ouvrez 10 packs cette semaine',
    progress: 7,
    total: 10,
    reward: '🏆 Badge Collectionneur',
    xp: 500,
    color: '#f0b429',
    icon: '📦',
    difficulty: 'Facile',
  },
  {
    id: 2,
    title: 'Légende Brésilienne',
    desc: 'Collectez toutes les cartes OR du Brésil',
    progress: 3,
    total: 8,
    reward: '⚡ Pack Platine x2',
    xp: 1200,
    color: '#009C3B',
    icon: '🇧🇷',
    difficulty: 'Moyen',
  },
  {
    id: 3,
    title: 'Échangeur Pro',
    desc: 'Effectuez 5 échanges réussis',
    progress: 2,
    total: 5,
    reward: '🎴 Pack Légendaire',
    xp: 800,
    color: '#BC002D',
    icon: '🔄',
    difficulty: 'Moyen',
  },
  {
    id: 4,
    title: 'Album Complet',
    desc: 'Complétez un groupe entier dans l\'album',
    progress: 4,
    total: 6,
    reward: '⭐ 2000 Points',
    xp: 2000,
    color: '#3C3B6E',
    icon: '📖',
    difficulty: 'Difficile',
  },
  {
    id: 5,
    title: 'Grimpeur de Classement',
    desc: 'Atteignez le Top 100 mondial',
    progress: 1,
    total: 1,
    reward: '👑 Titre exclusif',
    xp: 3000,
    color: '#9b59b6',
    icon: '🏆',
    difficulty: 'Très Difficile',
    completed: true,
  },
]

const DIFFICULTY_COLORS: Record<string, string> = {
  'Facile':        '#00A550',
  'Moyen':         '#f0b429',
  'Difficile':     '#FF0000',
  'Très Difficile':'#9b59b6',
}

export default function Defis({ onBack }: { onBack: () => void }) {
  const completed = DEFIS.filter(d => d.completed).length

  return (
    <PageLayout
      onBack={onBack}
      accentColor="#3C3B6E"
      flag="🇺🇸"
      title="Défis"
      subtitle="Relevez des défis pour gagner des récompenses exclusives"
    >
      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28,
      }}>
        {[
          { label: 'En cours',  value: DEFIS.length - completed, color: '#f0b429' },
          { label: 'Terminés',  value: completed,                 color: '#00A550' },
          { label: 'XP Total',  value: '4 500',                   color: '#3C3B6E' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '14px 16px',
            background: `${s.color}0d`,
            border: `1px solid ${s.color}2a`,
            borderRadius: 14,
            textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 28, color: s.color, letterSpacing: 1,
            }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 1 }}>
              {s.label.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Defi cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {DEFIS.map((d, i) => (
          <DefiCard key={d.id} defi={d} delay={i * 70} />
        ))}
      </div>
    </PageLayout>
  )
}

function DefiCard({ defi, delay }: { defi: typeof DEFIS[0]; delay: number }) {
  const pct = (defi.progress / defi.total) * 100
  const diffColor = DIFFICULTY_COLORS[defi.difficulty]

  return (
    <div style={{
      padding: '18px 20px',
      background: defi.completed
        ? 'rgba(0,165,80,0.08)'
        : `${defi.color}0a`,
      border: defi.completed
        ? '1px solid rgba(0,165,80,0.3)'
        : `1px solid ${defi.color}28`,
      borderRadius: 16,
      animation: `fadeSlideUp 0.35s ease ${delay}ms both`,
      opacity: defi.completed ? 0.8 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Icon */}
        <div style={{
          width: 44, height: 44, flexShrink: 0,
          background: `${defi.color}22`,
          border: `1px solid ${defi.color}44`,
          borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          {defi.completed ? '✅' : defi.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{defi.title}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1,
              color: diffColor, padding: '2px 7px',
              background: `${diffColor}18`, border: `1px solid ${diffColor}33`,
              borderRadius: 20, textTransform: 'uppercase',
            }}>
              {defi.difficulty}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
            {defi.desc}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                Progression
              </span>
              <span style={{ fontSize: 10, color: defi.color, fontWeight: 700 }}>
                {defi.progress} / {defi.total}
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: defi.completed
                  ? '#00A550'
                  : `linear-gradient(90deg, ${defi.color}, ${defi.color}cc)`,
                borderRadius: 3,
                transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }} />
            </div>
          </div>

          {/* Reward row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: '#f0b429', fontWeight: 600,
            }}>
              🎁 {defi.reward}
            </div>
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600,
            }}>
              +{defi.xp} XP
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
