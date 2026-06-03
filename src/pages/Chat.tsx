import { useState, useEffect, useRef, useCallback } from 'react'
import PageLayout from './PageLayout'
import {
  getChatMessages, sendChatMessage, deleteChatMessage, subscribeToChat,
} from '../services/auth'
import type { ChatMessage, UserProfile } from '../services/auth'

const GOLD = '#C89B3C'

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich', hour12: false,
  })
}

interface ChatProps {
  onBack: () => void
  currentUser: UserProfile | null
  onOpenAuth: () => void
}

export default function Chat({ onBack, currentUser, onOpenAuth }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [loading, setLoading]   = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const msgs = await getChatMessages()
    setMessages(msgs)
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => { await load(); if (alive) setLoading(false) })()
    const unsub = subscribeToChat(load)
    return () => { alive = false; unsub() }
  }, [load])

  // Défile vers le dernier message à chaque mise à jour
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!currentUser || !draft.trim() || busy) return
    setBusy(true)
    const { error } = await sendChatMessage(
      currentUser.id, currentUser.pseudo, currentUser.countryCode, draft,
    )
    if (!error) { setDraft(''); await load() }
    setBusy(false)
  }

  const remove = async (id: string) => {
    setBusy(true); await deleteChatMessage(id); await load(); setBusy(false)
  }

  return (
    <PageLayout onBack={onBack} backLabel="Globe" accentColor={GOLD}
      flag={<span>💬</span>} title="Chat" subtitle="Discussion en direct">

      {/* ── Fil des messages ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontSize: 13 }}>Chargement…</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 13 }}>Aucun message — lance la discussion !</div>
          </div>
        ) : (
          messages.map(m => {
            const mine = currentUser?.id === m.userId
            return (
              <div key={m.id} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: mine ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2,
                  flexDirection: mine ? 'row-reverse' : 'row',
                }}>
                  <img src={`https://flagcdn.com/w20/${m.countryCode}.png`} alt=""
                    style={{ width: 16, height: 11, borderRadius: 2, objectFit: 'cover' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>{m.pseudo}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{timeLabel(m.createdAt)}</span>
                  {mine && (
                    <button onClick={() => remove(m.id)} disabled={busy} title="Supprimer"
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-3)', fontSize: 11, padding: 0 }}>✕</button>
                  )}
                </div>
                <div style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: 14,
                  borderTopRightRadius: mine ? 4 : 14, borderTopLeftRadius: mine ? 14 : 4,
                  background: mine ? 'linear-gradient(135deg,#C89B3C,#E8D080)' : 'var(--bg-card)',
                  color: mine ? '#0D0800' : 'var(--text-1)',
                  border: mine ? 'none' : '1px solid var(--border)',
                  fontSize: 14, lineHeight: 1.35, wordBreak: 'break-word',
                  boxShadow: 'var(--shadow-sm)',
                }}>{m.body}</div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Barre de saisie ─────────────────────────────────────── */}
      <div style={{
        position: 'sticky', bottom: 0, paddingTop: 8,
        background: 'linear-gradient(to top, var(--bg) 70%, transparent)',
      }}>
        {currentUser ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              maxLength={500}
              placeholder="Votre message…"
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12,
                border: '1px solid var(--border)', background: 'var(--bg-card)',
                color: 'var(--text-1)', fontSize: 14, outline: 'none',
              }} />
            <button onClick={send} disabled={busy || !draft.trim()} style={{
              padding: '10px 16px', borderRadius: 12, border: 'none',
              background: draft.trim() ? 'linear-gradient(135deg,#C89B3C,#E8D080)' : 'var(--border)',
              color: draft.trim() ? '#0D0800' : 'var(--text-3)', fontWeight: 700, fontSize: 14,
              cursor: draft.trim() ? 'pointer' : 'default',
            }}>Envoyer</button>
          </div>
        ) : (
          <button onClick={onOpenAuth} style={{
            width: '100%', padding: '11px', borderRadius: 12, border: `1px solid ${GOLD}55`,
            background: 'rgba(200,155,60,0.10)', color: GOLD, fontWeight: 700, fontSize: 13,
            cursor: 'pointer',
          }}>Connectez-vous pour participer au chat</button>
        )}
      </div>
    </PageLayout>
  )
}
