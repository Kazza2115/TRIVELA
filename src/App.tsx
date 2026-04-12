import { useState } from 'react'
import Globe from './components/Globe'
import Starfield from './components/Starfield'
import MesPacks    from './pages/MesPacks'
import Classement  from './pages/Classement'
import MonAlbum    from './pages/MonAlbum'
import Echange     from './pages/Echange'
import Defis       from './pages/Defis'
import './index.css'

export type SectionId = 'globe' | 'packs' | 'classement' | 'album' | 'echange' | 'defis'

// ─── Bottom nav items ─────────────────────────────────────────────────────
// countryId maps each section to the country that represents it on the globe
const NAV_ITEMS = [
  { sectionId: 'packs',      countryId: 76,  icon: '📦', label: 'Packs'     },
  { sectionId: 'classement', countryId: 686, icon: '🏆', label: 'Class.'    },
  { sectionId: 'album',      countryId: 756, icon: '📖', label: 'Album'     },
  { sectionId: 'echange',    countryId: 392, icon: '🔄', label: 'Échange'   },
  { sectionId: 'defis',      countryId: 840, icon: '⚡', label: 'Défis'     },
] as const

export default function App() {
  const [section, setSection] = useState<SectionId>('globe')

  // { id: countryId, ts: Date.now() } — ts ensures same country re-centers
  const [centerRequest, setCenterRequest] = useState<{ id: number; ts: number } | null>(null)

  const navigate = (s: string) => setSection(s as SectionId)
  const back     = () => setSection('globe')

  const handleNavTap = (countryId: number, sectionId: string) => {
    if (section === 'globe') {
      // Center globe on that country and show its popup
      setCenterRequest({ id: countryId, ts: Date.now() })
    } else {
      // Already in a section: navigate to the tapped one
      setSection(sectionId as SectionId)
    }
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: 'var(--bg-deep)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      // Respect iOS safe areas
      paddingTop: 'var(--sat)',
      paddingBottom: 'var(--sab)',
      paddingLeft: 'var(--sal)',
      paddingRight: 'var(--sar)',
    }}>
      <Starfield />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        height: 'var(--header-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 10,
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>⚽</span>
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 30,
            letterSpacing: 4,
            color: '#fff',
            textShadow: '0 0 24px rgba(100,150,255,0.35)',
          }}>
            TRIVELA
          </span>
        </div>

        <div style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 1.5,
          color: 'rgba(255,255,255,0.28)',
          textTransform: 'uppercase',
        }}>
          WC 2026
        </div>
      </header>

      {/* ── Main content area ─────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>

        {/* Globe view */}
        {section === 'globe' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Globe onNavigate={navigate} centerRequest={centerRequest} />

            {/* Hint */}
            <div style={{
              position: 'absolute',
              top: 14,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'rgba(255,255,255,0.20)',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              fontWeight: 500,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              animation: 'fadeIn 1.5s ease 1.2s both',
            }}>
              Appuyez sur un pays pour explorer
            </div>
          </div>
        )}

        {/* Section views */}
        {section !== 'globe' && (
          <div style={{ position: 'absolute', inset: 0 }}>
            {section === 'packs'      && <MesPacks   onBack={back} />}
            {section === 'classement' && <Classement  onBack={back} />}
            {section === 'album'      && <MonAlbum    onBack={back} />}
            {section === 'echange'    && <Echange     onBack={back} />}
            {section === 'defis'      && <Defis       onBack={back} />}
          </div>
        )}
      </div>

      {/* ── Bottom navigation ─────────────────────────────────────────── */}
      <nav style={{
        flexShrink: 0,
        height: 'var(--nav-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        background: 'rgba(6,13,26,0.92)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 20,
        paddingBottom: 0,
      }}>
        {/* Globe home button */}
        <NavButton
          icon="🌍"
          label="Globe"
          active={section === 'globe'}
          onClick={() => setSection('globe')}
        />

        {NAV_ITEMS.map(item => (
          <NavButton
            key={item.sectionId}
            icon={item.icon}
            label={item.label}
            active={section === item.sectionId}
            onClick={() => handleNavTap(item.countryId, item.sectionId)}
          />
        ))}
      </nav>
    </div>
  )
}

// ─── NavButton ────────────────────────────────────────────────────────────
function NavButton({
  icon, label, active, onClick,
}: {
  icon: string; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '6px 2px',
        borderRadius: 10,
        transition: 'opacity 0.15s',
        opacity: active ? 1 : 0.45,
      }}
      onPointerDown={e => (e.currentTarget.style.opacity = '0.7')}
      onPointerUp={e   => (e.currentTarget.style.opacity = active ? '1' : '0.45')}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: 0.5,
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        fontFamily: "'Inter', sans-serif",
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {/* Active indicator dot */}
      {active && (
        <div style={{
          width: 4, height: 4,
          borderRadius: '50%',
          background: 'rgba(160,200,255,0.8)',
          boxShadow: '0 0 6px rgba(160,200,255,0.6)',
        }} />
      )}
    </button>
  )
}
