import { useState } from 'react'
import Globe      from './components/Globe'
import Paris      from './pages/Paris'
import Classement from './pages/Classement'
import {
  IconGlobe, IconTrophy,
} from './components/NavIcons'
import './index.css'

export type SectionId = 'globe' | 'paris' | 'classement'

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
  { id: 'globe'      as SectionId, Icon: IconGlobe,  label: 'Globe'      },
  { id: 'paris'      as SectionId, Icon: IconTarget, label: 'Paris'      },
  { id: 'classement' as SectionId, Icon: IconTrophy, label: 'Classement' },
] as const

export default function App() {
  const [section, setSection] = useState<SectionId>('globe')
  const [centerRequest] = useState<{ id: number; ts: number } | null>(null)

  const back = () => setSection('globe')

  const gold   = '#C89B3C'
  const dimCol = '#AEAEB2'

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)',
      paddingLeft: 'var(--sal)', paddingRight: 'var(--sar)',
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        height: 'var(--header-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 10,
        background: 'rgba(242,242,247,0.85)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(60,60,67,0.14)',
      }}>
        {/* Clickable TRIVELA logo */}
        <button
          onClick={() => setSection('globe')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 6px', borderRadius: 8,
            transition: 'opacity 0.18s',
          }}
          onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
          onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚽</span>
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 27, letterSpacing: 4,
            color: gold, lineHeight: 1,
          }}>TRIVELA</span>
        </button>

        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 2,
          color: 'var(--text-3)', textTransform: 'uppercase',
        }}>
          World Cup 2026
        </span>
      </header>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', zIndex: 1 }}>

        {section === 'globe' && (
          <div style={{ width: '100%', height: '100%', position: 'relative', background: 'var(--bg)' }}>
            <Globe
              onNavigate={(s) => setSection(s as SectionId)}
              centerRequest={centerRequest}
            />

            {/* Hint */}
            <p style={{
              position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center',
              fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
              color: 'var(--text-3)', pointerEvents: 'none',
              fontWeight: 600,
              animation: 'fadeIn 2s ease 1.5s both',
            }}>
              Touchez un pays · Faites pivoter
            </p>

            {/* Quick-access card */}
            <div style={{
              position: 'absolute', bottom: 16, left: 16, right: 16,
              padding: '16px 18px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              boxShadow: 'var(--shadow-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12,
              animation: 'fadeSlideUp .5s cubic-bezier(0.4,0,0.2,1) .8s both',
            }}>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
                  color: gold, textTransform: 'uppercase',
                  marginBottom: 3,
                }}>
                  Coupe du Monde 2026
                </div>
                <div style={{
                  fontSize: 13, color: 'var(--text-1)', fontWeight: 500,
                }}>
                  72 matchs · Faites vos pronostics
                </div>
              </div>
              <button
                onClick={() => setSection('paris')}
                style={{
                  padding: '10px 18px',
                  background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
                  border: 'none', borderRadius: 12,
                  color: '#0D0800', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 4px 14px rgba(200,155,60,0.4)',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                }}
                onPointerDown={e => {
                  e.currentTarget.style.transform = 'scale(0.96)'
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(200,155,60,0.25)'
                }}
                onPointerUp={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(200,155,60,0.4)'
                }}
              >
                Parier →
              </button>
            </div>
          </div>
        )}

        {section === 'paris'      && <Paris      onBack={back} />}
        {section === 'classement' && <Classement onBack={back} />}
      </div>

      {/* ── Bottom nav ──────────────────────────────────────────── */}
      <nav style={{
        flexShrink: 0, height: 'var(--nav-h)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        background: 'rgba(242,242,247,0.92)',
        borderTop: '1px solid rgba(60,60,67,0.14)',
        backdropFilter: 'saturate(180%) blur(24px)',
        WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        zIndex: 20,
      }}>
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const active = section === id
          return (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 4px', borderRadius: 12,
                transition: 'opacity 0.15s',
              }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.45')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              <Icon size={22} color={active ? gold : dimCol} />
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
                color: active ? gold : dimCol,
                textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}>{label}</span>
              {active && (
                <div style={{
                  width: 16, height: 2, borderRadius: 1,
                  background: gold,
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
