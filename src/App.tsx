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

// ─── Icon: target/bullseye ────────────────────────────────────────────────
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

// ─── App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [section, setSection] = useState<SectionId>('globe')
  const [centerRequest] = useState<{ id: number; ts: number } | null>(null)

  const back = () => setSection('globe')

  const gold = '#C89B3C'
  const dim  = 'rgba(245,245,247,0.35)'

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
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(7,9,15,0.75)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      }}>
        {/* TRIVELA logo — clickable, returns to globe */}
        <button
          onClick={() => setSection('globe')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 6px', borderRadius: 8,
            transition: 'opacity 0.2s',
          }}
          onPointerDown={e => (e.currentTarget.style.opacity = '0.6')}
          onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>⚽</span>
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 28, letterSpacing: 4,
            color: gold,
            lineHeight: 1,
          }}>TRIVELA</span>
        </button>

        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 2.5,
          color: 'rgba(200,155,60,0.38)', textTransform: 'uppercase',
          fontFamily: '-apple-system, Inter, sans-serif',
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

            {/* Hint */}
            <p style={{
              position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center',
              fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase',
              color: 'rgba(245,245,247,0.22)', pointerEvents: 'none',
              fontFamily: '-apple-system, Inter, sans-serif', fontWeight: 600,
              animation: 'fadeIn 2s ease 1.5s both',
            }}>
              Touchez un pays · Faites pivoter le globe
            </p>

            {/* Quick-access card */}
            <div style={{
              position: 'absolute', bottom: 16, left: 16, right: 16,
              padding: '14px 18px',
              background: 'rgba(7,9,15,0.72)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 18,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              animation: 'fadeSlideUp .55s cubic-bezier(0.4,0,0.2,1) .8s both',
            }}>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1.8,
                  color: 'rgba(200,155,60,0.7)', textTransform: 'uppercase',
                  marginBottom: 3, fontFamily: '-apple-system, Inter, sans-serif',
                }}>
                  Coupe du Monde 2026
                </div>
                <div style={{
                  fontSize: 13, color: 'rgba(245,245,247,0.72)', fontWeight: 500,
                  fontFamily: '-apple-system, Inter, sans-serif',
                }}>
                  72 matchs · Faites vos pronostics
                </div>
              </div>
              <button
                onClick={() => setSection('paris')}
                style={{
                  padding: '9px 18px',
                  background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
                  border: 'none', borderRadius: 12,
                  color: '#0D0800', fontSize: 12, fontWeight: 800,
                  cursor: 'pointer', letterSpacing: 0.3,
                  fontFamily: '-apple-system, Inter, sans-serif',
                  flexShrink: 0,
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: '0 4px 16px rgba(200,155,60,0.35)',
                }}
                onPointerDown={e => {
                  e.currentTarget.style.transform = 'scale(0.96)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(200,155,60,0.25)'
                }}
                onPointerUp={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(200,155,60,0.35)'
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
        background: 'rgba(7,9,15,0.82)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
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
                alignItems: 'center', justifyContent: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 4px', borderRadius: 12,
                transition: 'opacity 0.15s',
              }}
              onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
              onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
            >
              <Icon size={22} color={active ? gold : dim} />
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
                color: active ? gold : dim,
                fontFamily: '-apple-system, Inter, sans-serif',
                textTransform: 'uppercase',
                transition: 'color 0.2s',
              }}>{label}</span>
              {active && (
                <div style={{
                  width: 18, height: 2, borderRadius: 1,
                  background: gold,
                  opacity: 0.8,
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
