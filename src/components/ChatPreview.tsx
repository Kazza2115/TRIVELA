import { useEffect, useState, useCallback } from 'react'
import { getChatMessages, subscribeToChat } from '../services/auth'
import type { ChatMessage } from '../services/auth'

const GOLD = '#C89B3C'

/** Aperçu du chat global (carte) affiché en bas de la page du globe. */
export default function ChatPreview({ onOpen }: { onOpen: () => void }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([])

  const load = useCallback(async () => setMsgs(await getChatMessages(20)), [])
  useEffect(() => { load(); return subscribeToChat(load) }, [load])

  const latest = msgs.slice(-3)

  return (
    <div onClick={onOpen} style={{
      position: 'absolute', bottom: 16, left: 12, right: 12, zIndex: 8, cursor: 'pointer',
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
