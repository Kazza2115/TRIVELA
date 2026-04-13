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
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadeIn 0.22s ease',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 18px',
        height: 56,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(242,242,247,0.9)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        flexShrink: 0,
      }}>
        {/* Back */}
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', borderRadius: 8,
            color: accentColor, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', padding: '6px 2px',
            transition: 'opacity 0.15s',
          }}
          onPointerDown={e => (e.currentTarget.style.opacity = '0.45')}
          onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
        >
          ‹ Globe
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{flag}</span>

        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 22, letterSpacing: 2.5,
            color: 'var(--text-1)', lineHeight: 1,
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{
              fontSize: 10, color: 'var(--text-3)',
              marginTop: 1, letterSpacing: 0.3,
            }}>
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ marginLeft: 'auto' }}>
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 14, letterSpacing: 3,
            color: 'var(--text-3)',
          }}>TRIVELA</span>
        </div>
      </header>

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '20px 16px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {children}
      </div>
    </div>
  )
}
