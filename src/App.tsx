import { useState } from 'react'
import Globe from './components/Globe'
import Starfield from './components/Starfield'
import MesPacks from './pages/MesPacks'
import Classement from './pages/Classement'
import MonAlbum from './pages/MonAlbum'
import Echange from './pages/Echange'
import Defis from './pages/Defis'
import './index.css'

export type SectionId = 'globe' | 'packs' | 'classement' | 'album' | 'echange' | 'defis'

export default function App() {
  const [section, setSection] = useState<SectionId>('globe')

  const navigate = (s: string) => setSection(s as SectionId)
  const back = () => setSection('globe')

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--bg-deep)', overflow: 'hidden' }}>
      <Starfield />

      {section === 'globe' && (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <header style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 32px',
            pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>⚽</span>
              <span style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: 36,
                letterSpacing: 4,
                color: '#fff',
                textShadow: '0 0 30px rgba(100,150,255,0.4)',
              }}>
                TRIVELA
              </span>
            </div>
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 2,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
            }}>
              Coupe du Monde 2026
            </div>
          </header>

          {/* Globe */}
          <Globe onNavigate={navigate} />

          {/* Legend */}
          <div style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 16,
            animation: 'fadeSlideUp 0.8s ease 0.4s both',
            pointerEvents: 'none',
          }}>
            {LEGEND.map(({ color, label, flag }) => (
              <div key={label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(10px)',
              }}>
                <span style={{ fontSize: 14 }}>{flag}</span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Hint */}
          <div style={{
            position: 'absolute',
            top: 90,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 12,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontWeight: 500,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            animation: 'fadeIn 1.2s ease 1s both',
          }}>
            Cliquez sur un pays pour explorer
          </div>
        </div>
      )}

      {section !== 'globe' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          {section === 'packs'      && <MesPacks    onBack={back} />}
          {section === 'classement' && <Classement   onBack={back} />}
          {section === 'album'      && <MonAlbum     onBack={back} />}
          {section === 'echange'    && <Echange      onBack={back} />}
          {section === 'defis'      && <Defis        onBack={back} />}
        </div>
      )}
    </div>
  )
}

const LEGEND = [
  { color: '#009C3B', label: 'Mes Packs',   flag: '🇧🇷' },
  { color: '#00A550', label: 'Classement',  flag: '🇸🇳' },
  { color: '#FF0000', label: 'Mon Album',   flag: '🇨🇭' },
  { color: '#BC002D', label: 'Échange',     flag: '🇯🇵' },
  { color: '#3C3B6E', label: 'Défis',       flag: '🇺🇸' },
]
