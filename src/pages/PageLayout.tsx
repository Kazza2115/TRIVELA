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
      animation: 'fadeSlideUp 0.4s ease',
    }}>
      {/* Top bar */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '18px 28px',
        borderBottom: `1px solid ${accentColor}22`,
        background: `linear-gradient(180deg, ${accentColor}0d 0%, transparent 100%)`,
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, padding: '8px 14px',
            color: 'rgba(255,255,255,0.6)', fontSize: 13,
            fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s', fontFamily: "'Inter', sans-serif",
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.11)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.6)'
          }}
        >
          ← Globe
        </button>

        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />

        <span style={{ fontSize: 26 }}>{flag}</span>

        <div>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 26, letterSpacing: 3,
            color: '#fff', lineHeight: 1,
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, letterSpacing: 0.5 }}>
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 18, letterSpacing: 3,
            color: `${accentColor}88`,
          }}>TRIVELA</span>
          <span style={{ fontSize: 16 }}>⚽</span>
        </div>
      </header>

      {/* Accent line */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, ${accentColor} 0%, ${accentColor}44 60%, transparent 100%)`,
        flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '28px 28px',
      }}>
        {children}
      </div>
    </div>
  )
}
