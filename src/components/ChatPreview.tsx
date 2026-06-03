import { useEffect, useState, useCallback } from 'react'
import { getChatMessages, subscribeToChat } from '../services/auth'
import type { ChatMessage } from '../services/auth'

const GOLD = '#C89B3C'
export type ChatPreviewVariant = 'ticker' | 'card' | 'bubble'

/** Aperçu du chat global affiché sur la page du globe pour inciter à discuter. */
export default function ChatPreview({
  variant, onOpen,
}: { variant: ChatPreviewVariant; onOpen: () => void }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])

  const load = useCallback(async () => setMsgs(await getChatMessages(20)), [])
  useEffect(() => { load(); return subscribeToChat(load) }, [load])

  const latest = msgs.slice(-3)
  const last   = latest[latest.length - 1]
  const base: React.CSSProperties = { position: 'absolute', bottom: 108, zIndex: 8, cursor: 'pointer' }

  // ── Bandeau défilant ───────────────────────────────────────────────────────
  if (variant === 'ticker') {
    const items = msgs.slice(-8)
    const line = items.length
      ? items.map(m => `💬 ${m.pseudo}: ${m.body}`).join('     •     ')
      : '💬 Sois le premier à écrire dans le chat…'
    return (
      <div onClick={onOpen} style={{
        ...base, left: 12, right: 12, height: 34, overflow: 'hidden',
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
        boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-2)',
          animation: items.length ? 'chatMarquee 24s linear infinite' : 'none',
          paddingLeft: items.length ? 0 : 12,
        }}>
          {items.length ? <span>{line}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{line}</span> : line}
        </div>
      </div>
    )
  }

  // ── Bulle flottante ────────────────────────────────────────────────────────
  if (variant === 'bubble') {
    return (
      <div onClick={onOpen} style={{
        ...base, right: 12, maxWidth: 230,
        background: 'var(--bg-card)', border: `1px solid ${GOLD}55`, borderRadius: 16,
        boxShadow: 'var(--shadow-lg)', padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>💬</span>
        <div style={{ minWidth: 0 }}>
          {last ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>{last.pseudo}</span>
              <div style={{ fontSize: 12, color: 'var(--text-1)', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last.body}</div>
            </>
          ) : <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Ouvrir le chat…</span>}
        </div>
      </div>
    )
  }

  // ── Mini-carte (2-3 messages) ──────────────────────────────────────────────
  return (
    <div onClick={onOpen} style={{
      ...base, left: 12, right: 12,
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
      boxShadow: 'var(--shadow-lg)', padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>💬 Chat en direct</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>appuie pour discuter ›</span>
      </div>
      {latest.length ? latest.map(m => (
        <div key={m.id} style={{
          fontSize: 12, color: 'var(--text-1)', lineHeight: 1.5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <img src={`https://flagcdn.com/w20/${m.countryCode}.png`} alt=""
            style={{ width: 14, height: 10, borderRadius: 2, objectFit: 'cover',
              marginRight: 5, verticalAlign: 'middle' }} />
          <span style={{ fontWeight: 700, color: GOLD }}>{m.pseudo}:</span> {m.body}
        </div>
      )) : (
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Sois le premier à écrire…</div>
      )}
    </div>
  )
}
