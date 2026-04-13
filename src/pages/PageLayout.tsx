import { type ReactNode } from 'react'

interface PageLayoutProps {
  onBack: () => void
  accentColor: string
  flag: string
  title: string
  subtitle?: string
  children: ReactNode
}

export default function PageLayout({ onBack, accentColor, flag, title, subtitle, children }: PageLayoutProps) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'var(--bg-deep)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadeIn 0.28s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px',
        height: 56,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(7,9,15,0.8)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        flexShrink: 0,
      }}>
        {/* Back button */}
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '7px 13px',
            color: 'rgba(245,245,247,0.65)', fontSize: 13,
            fontWeight: 500, cursor: 'pointer',
            fontFamily: '-apple-system, Inter, sans-serif',
            transition: 'background 0.15s, color 0.15s',
            flexShrink: 0,
          }}
          onPointerDown={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
          }}
          onPointerUp={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(245,245,247,0.65)'
          }}
        >
          ‹ Retour
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* Icon + title */}
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{flag}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 24, letterSpacing: 3,
            color: '#fff', lineHeight: 1,
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 10, color: 'rgba(245,245,247,0.38)',
              marginTop: 1, letterSpacing: 0.4,
              fontFamily: '-apple-system, Inter, sans-serif',
            }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Brand mark */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 16, letterSpacing: 3,
            color: `${accentColor}55`,
          }}>TRIVELA</span>
        </div>
      </header>

      {/* Accent line */}
      <div style={{
        height: 1,
        background: `linear-gradient(90deg, ${accentColor}60 0%, ${accentColor}20 60%, transparent 100%)`,
        flexShrink: 0,
      }} />

      {/* Scrollable content */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '22px 18px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {children}
      </div>
    </div>
  )
}
