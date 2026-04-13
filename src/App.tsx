import { useState } from 'react'
import Globe      from './components/Globe'
import Starfield  from './components/Starfield'
import Paris      from './pages/Paris'
import Classement from './pages/Classement'
import {
  IconGlobe, IconTrophy,
} from './components/NavIcons'
import './index.css'

// ─── Sections ─────────────────────────────────────────────────────────────
export type SectionId = 'globe' | 'paris' | 'classement'

// ─── Custom SVG: target/bullseye for Paris ────────────────────────────────
function IconTarget({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
      <line x1="12" y1="2.5" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="21.5" />
      <line x1="2.5" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="21.5" y2="12" />
    </svg>
  )
}

const NAV_ITEMS = [
  { id: 'globe'      as SectionId, Icon: IconGlobe,    label: 'Globe',       countryId: null },
  { id: 'paris'      as SectionId, Icon: IconTarget,   label: 'Paris',       countryId: null },
  { id: 'classement' as SectionId, Icon: IconTrophy,   label: 'Classement',  countryId: null },
] as const

// ─── App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [section, setSection]           = useState<SectionId>('globe')
  const [centerRequest] = useState<{ id: number; ts: number } | null>(null)

  const back = () => setSection('globe')

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg-deep)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)',
      paddingLeft: 'var(--sal)', paddingRight: 'var(--sar)',
    }}>
      <Starfield />

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        height: 'var(--header-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 10,
        borderBottom: '1px solid rgba(200,155,60,.1)',
        background: 'linear-gradient(180deg,rgba(10,22,40,.8) 0%,transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontSize: 20 }}>⚽</span>
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 30, letterSpacing: 5,
            color: 'var(--gold-lt)',
            textShadow: '0 0 20px rgba(200,155,60,.45)',
          }}>TRIVELA</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 2,
          color: 'rgba(200,155,60,.4)', textTransform: 'uppercase',
        }}>World Cup 2026</span>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>

        {/* Globe */}
        {section === 'globe' && (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Globe
              onNavigate={(s) => setSection(s as SectionId)}
              centerRequest={centerRequest}
            />
            <p style={{
              position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center',
              fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
              color: 'rgba(200,155,60,.3)', pointerEvents: 'none',
              animation: 'fadeIn 2s ease 1.5s both',
            }}>
              Appuyez sur un pays · Swipez pour explorer
            </p>

            {/* Quick-access banner */}
            <div style={{
              position: 'absolute', bottom: 16, left: 16, right: 16,
              padding: '12px 18px',
              background: 'rgba(6,13,26,.88)',
              border: '1px solid rgba(200,155,60,.22)',
              borderRadius: 16,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              animation: 'fadeSlideUp .6s ease .8s both',
            }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(200,155,60,.6)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
                  Coupe du Monde 2026
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontWeight: 600 }}>
                  72 matchs · Faites vos pronostics
                </div>
              </div>
              <button
                onClick={() => setSection('paris')}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg,#C89B3C,#F0E6D2)',
                  border: 'none', borderRadius: 10,
                  color: '#1a0d00', fontSize: 12, fontWeight: 800,
                  cursor: 'pointer', letterSpacing: .5,
                  fontFamily: "'Inter', sans-serif",
                  flexShrink: 0,
                }}
              >
                Parier →
              </button>
            </div>
          </div>
        )}

        {/* Paris */}
        {section === 'paris' && <Paris onBack={back} />}

        {/* Classement */}
        {section === 'classement' && <Classement onBack={back} />}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────── */}
      <nav style={{
        flexShrink: 0, height: 'var(--nav-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        background: 'rgba(5,10,22,.96)',
        borderTop: '1px solid rgba(200,155,60,.12)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 20,
      }}>
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const active = section === id
          const gold   = '#C89B3C'
          const dim    = 'rgba(120,150,200,.5)'
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '5px 2px', borderRadius: 10,
              }}
              onPointerDown={e => (e.currentTarget.style.opacity = '.6')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              <Icon size={21} color={active ? gold : dim} />
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: .8,
                color: active ? gold : dim,
                fontFamily: "'Inter', sans-serif",
                textTransform: 'uppercase',
              }}>{label}</span>
              {active && (
                <div style={{
                  width: 20, height: 2, borderRadius: 1,
                  background: `linear-gradient(90deg,transparent,${gold},transparent)`,
                  boxShadow: `0 0 8px ${gold}88`,
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
