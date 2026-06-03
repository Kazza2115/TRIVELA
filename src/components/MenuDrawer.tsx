import type { SectionId } from '../App'

interface MenuDrawerProps {
  open: boolean
  onClose: () => void
  onNavigate: (s: SectionId) => void
  activeSection: SectionId
}

export default function MenuDrawer({ open, onClose, onNavigate, activeSection }: MenuDrawerProps) {
  const gold = '#C89B3C'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.48)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 301,
        width: 270,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        boxShadow: '6px 0 40px rgba(0,0,0,0.22)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}>
        {/* Branding header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 18px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 26, letterSpacing: 3, color: gold, lineHeight: 1,
            }}>TRIVELA</div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', letterSpacing: 1.5, marginTop: 2 }}>
              COUPE DU MONDE 2026
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30,
              background: 'var(--bg-fill)', border: '1px solid var(--border)',
              borderRadius: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'var(--text-3)',
            }}
            onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
            onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
          >✕</button>
        </div>

        {/* Menu items */}
        <div style={{ flex: 1, padding: '14px 12px', overflowY: 'auto' }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.8,
            color: 'var(--text-3)', textTransform: 'uppercase',
            padding: '0 8px 8px',
          }}>Explorer</div>

          <MenuItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/>
                <path d="M4 22a2 2 0 0 1-2-2V8c0-1.1.9-2 2-2h4"/>
                <path d="M10 7h8"/>
                <path d="M10 11h8"/>
                <path d="M10 15h5"/>
              </svg>
            }
            label="Actualités"
            badge="NEW"
            active={activeSection === 'actualites'}
            onClick={() => { onNavigate('actualites'); onClose() }}
          />

          <MenuItem
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            }
            label="Chat"
            badge="LIVE"
            active={activeSection === 'chat'}
            onClick={() => { onNavigate('chat'); onClose() }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 18px 20px',
          borderTop: '1px solid var(--border)',
          fontSize: 10, color: 'var(--text-3)', letterSpacing: 0.5, lineHeight: 1.6,
        }}>
          Trivela · Paris sportifs<br />
          <span style={{ color: gold }}>FIFA World Cup 2026™</span>
        </div>
      </div>
    </>
  )
}

function MenuItem({
  icon, label, badge, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  badge?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 12px',
        background: active ? 'rgba(200,155,60,0.08)' : 'transparent',
        border: active ? '1px solid rgba(200,155,60,0.22)' : '1px solid transparent',
        borderRadius: 12, cursor: 'pointer', textAlign: 'left',
        color: active ? '#C89B3C' : 'var(--text-1)',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
      }}
      onPointerDown={e => (e.currentTarget.style.opacity = '0.6')}
      onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
    >
      <span style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: 1,
          background: 'rgba(200,155,60,0.15)',
          border: '1px solid rgba(200,155,60,0.3)',
          color: '#C89B3C', borderRadius: 5, padding: '2px 5px',
        }}>{badge}</span>
      )}
    </button>
  )
}
