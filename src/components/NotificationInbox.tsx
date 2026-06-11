import { ALL_MATCHES } from '../data/wc2026Matches'
import type { AppNotification } from '../services/auth'

const MATCH_BY_ID = new Map(ALL_MATCHES.map(m => [m.id, m]))

function matchLabel(matchId: string | null): string {
  if (!matchId) return ''
  const m = MATCH_BY_ID.get(matchId)
  return m ? `${m.home.short} – ${m.away.short}` : ''
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

function describe(n: AppNotification): { icon: string; title: string; detail: string } {
  const ml = matchLabel(n.matchId)
  if (n.type === 'comment') {
    return {
      icon: '💬',
      title: `${n.actorPseudo} a commenté ton pronostic`,
      detail: [ml, n.body ? `« ${n.body} »` : ''].filter(Boolean).join(' · '),
    }
  }
  if (n.type === 'rating') {
    const stars = '★'.repeat(Math.max(1, Math.min(5, parseInt(n.body ?? '0', 10) || 0)))
    return {
      icon: '⭐',
      title: `${n.actorPseudo} a noté ton pronostic`,
      detail: [stars, ml].filter(Boolean).join(' · '),
    }
  }
  return {
    icon: '📣',
    title: `${n.actorPseudo} t'a mentionné`,
    detail: n.body ? `« ${n.body} »` : '',
  }
}

interface Props {
  open: boolean
  onClose: () => void
  notifications: AppNotification[]
  onSelect: (n: AppNotification) => void
}

export default function NotificationInbox({ open, onClose, notifications, onSelect }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 250,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 251,
        maxWidth: 480, margin: '0 auto',
        background: 'var(--bg-card)', borderRadius: '20px 20px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.28)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', maxHeight: '82vh',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 18px 12px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-fill)',
            position: 'absolute', left: '50%', top: 7, transform: 'translateX(-50%)' }} />
          <span style={{ fontSize: 18 }}>🔔</span>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, letterSpacing: 1.5, color: 'var(--text-1)' }}>
            Notifications
          </div>
          <button onClick={onClose} style={{
            marginLeft: 'auto', width: 30, height: 30, borderRadius: 8,
            background: 'var(--bg-fill)', border: '1px solid var(--border)',
            color: 'var(--text-3)', fontSize: 13, cursor: 'pointer',
          }}>✕</button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', padding: '8px 12px 18px', WebkitOverflowScrolling: 'touch' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '44px 20px', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔕</div>
              <div style={{ fontSize: 13 }}>Aucune notification pour le moment.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notifications.map(n => {
                const d = describe(n)
                return (
                  <button
                    key={n.id}
                    onClick={() => onSelect(n)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      background: n.read ? 'var(--bg-fill)' : 'rgba(200,155,60,0.10)',
                      border: `1px solid ${n.read ? 'var(--border)' : 'rgba(200,155,60,0.30)'}`,
                      transition: 'opacity 0.15s',
                    }}
                    onPointerDown={e => (e.currentTarget.style.opacity = '0.6')}
                    onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1.1, flexShrink: 0 }}>{d.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{d.title}</div>
                      {d.detail && (
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {d.detail}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                    </div>
                    {!n.read && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626',
                        flexShrink: 0, marginTop: 4 }} />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
