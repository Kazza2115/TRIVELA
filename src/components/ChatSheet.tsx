import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getChatMessages, sendChatMessage, deleteChatMessage, subscribeToChat,
  clearChat, getAdminIds, getMentionables,
} from '../services/auth'
import type { ChatMessage, UserProfile, PresenceUser } from '../services/auth'

const GOLD = '#C89B3C'

const EMOJIS = [
  '⚽', '🔥', '😂', '😍', '😎', '👍', '👎', '👏', '🙌', '💪',
  '🎉', '🏆', '🥇', '🤩', '😱', '😭', '😡', '🤔', '🙄', '😅',
  '🥳', '💯', '👀', '❤️', '💔', '🤝', '🫡', '🐐', '🚀', '✨',
  '😤', '🤯', '🙏', '😬', '😴', '🤷', '🤦', '💩', '👋', '🫶',
]

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich', hour12: false,
  })
}

// Surligne les mentions @pseudo dans le corps d'un message.
function renderBody(body: string, mine: boolean) {
  return body.split(/(@[\p{L}0-9_]{2,20})/gu).map((part, i) =>
    part.startsWith('@')
      ? <span key={i} style={{ fontWeight: 800, color: mine ? '#5a3e00' : GOLD }}>{part}</span>
      : <span key={i}>{part}</span>,
  )
}

interface ChatSheetProps {
  open: boolean
  onClose: () => void
  currentUser: UserProfile | null
  onOpenAuth: () => void
  onOpenProfile: (userId: string) => void
  online: PresenceUser[]
}

/** Panneau de chat qui glisse par-dessus la page d'accueil (sans changer de page). */
export default function ChatSheet({
  open, onClose, currentUser, onOpenAuth, onOpenProfile, online,
}: ChatSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [admins, setAdmins]     = useState<Set<string>>(new Set())
  const [mentionables, setMentionables] = useState<{ id: string; pseudo: string; countryCode: string }[]>([])
  const [draft, setDraft]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [loading, setLoading]   = useState(true)
  const [err, setErr]           = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => { setMessages(await getChatMessages()) }, [])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    ;(async () => {
      await load()
      const [ids, ment] = await Promise.all([getAdminIds(), getMentionables()])
      if (alive) { setAdmins(new Set(ids)); setMentionables(ment); setLoading(false) }
    })()
    const unsub = subscribeToChat(load)
    return () => { alive = false; unsub() }
  }, [open, load])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Autocomplétion des mentions : token @ en fin de saisie
  const mentionMatch = draft.match(/@([\p{L}0-9_]*)$/u)
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : null
  const suggestions = mentionQuery !== null
    ? mentionables.filter(u => u.pseudo.toLowerCase().startsWith(mentionQuery) && u.id !== currentUser?.id).slice(0, 6)
    : []

  const applyMention = (pseudo: string) => {
    setDraft(d => d.replace(/@([\p{L}0-9_]*)$/u, `@${pseudo} `))
    inputRef.current?.focus()
  }
  const insertEmoji = (e: string) => {
    setDraft(d => (d + e).slice(0, 500))
    inputRef.current?.focus()
  }

  const send = async () => {
    if (!currentUser || !draft.trim() || busy) return
    setBusy(true); setErr('')
    const { error } = await sendChatMessage(currentUser.id, currentUser.pseudo, currentUser.countryCode, draft)
    if (error) setErr(error)
    else { setDraft(''); setShowEmoji(false); await load() }
    setBusy(false)
  }
  const remove = async (id: string) => { setBusy(true); await deleteChatMessage(id); await load(); setBusy(false) }
  const clearAll = async () => {
    if (busy || !window.confirm('Vider TOUT le chat ? Cette action est irréversible.')) return
    setBusy(true); setErr('')
    const { error } = await clearChat()
    if (error) setErr(error)
    await load(); setBusy(false)
  }

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 400, animation: 'fadeIn 0.2s ease',
      }} />

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, height: '80vh', zIndex: 401,
        background: 'var(--bg)', borderTopLeftRadius: 22, borderTopRightRadius: 22,
        boxShadow: '0 -8px 30px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
        animation: 'fadeSlideUp 0.28s cubic-bezier(0.34,1.15,0.64,1)',
      }}>
        {/* Poignée + en-tête */}
        <div style={{ flexShrink: 0, padding: '10px 16px 8px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Chat en direct</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                {online.length} en ligne
              </div>
            </div>
            {currentUser?.isAdmin && (
              <button onClick={clearAll} disabled={busy} title="Vider le chat" style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, cursor: 'pointer', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '6px 10px',
              }}>🗑️ Vider</button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)',
              fontSize: 20, lineHeight: 1, padding: 4,
            }}>✕</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              const isAdminAuthor = admins.has(m.userId)
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexDirection: mine ? 'row-reverse' : 'row' }}>
                    <button onClick={() => onOpenProfile(m.userId)} title="Voir le profil"
                      style={{
                        position: 'relative', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', gap: 6,
                        cursor: 'pointer', padding: '4px 12px', borderRadius: 999, background: 'var(--bg-fill)',
                        border: isAdminAuthor ? `1.5px solid ${GOLD}` : '1px solid var(--border)',
                        boxShadow: isAdminAuthor ? `0 0 0 1px ${GOLD}33` : 'none',
                      }}>
                      <img src={`https://flagcdn.com/w80/${m.countryCode}.png`} alt="" aria-hidden
                        style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '72%', height: '100%',
                          objectFit: 'cover', opacity: 0.32, transform: 'skewX(-12deg) scale(1.1)', transformOrigin: 'right',
                          WebkitMaskImage: 'linear-gradient(to right, transparent, #000 45%)',
                          maskImage: 'linear-gradient(to right, transparent, #000 45%)' }} />
                      <span style={{ position: 'relative', fontSize: 13, fontWeight: 600,
                        color: 'var(--text-1)', textShadow: '0 1px 1px rgba(0,0,0,0.12)' }}>{m.pseudo}</span>
                    </button>
                    <span style={{ fontSize: 9, color: 'var(--text-3)' }}>{timeLabel(m.createdAt)}</span>
                    {(mine || currentUser?.isAdmin) && (
                      <button onClick={() => remove(m.id)} disabled={busy} title={mine ? 'Supprimer' : 'Supprimer (admin)'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, padding: 0 }}>✕</button>
                    )}
                  </div>
                  <div style={{
                    maxWidth: '80%', padding: '8px 12px', borderRadius: 14,
                    borderTopRightRadius: mine ? 4 : 14, borderTopLeftRadius: mine ? 14 : 4,
                    background: mine ? 'linear-gradient(135deg,#C89B3C,#E8D080)' : 'var(--bg-card)',
                    color: mine ? '#0D0800' : 'var(--text-1)', border: mine ? 'none' : '1px solid var(--border)',
                    fontSize: 14, lineHeight: 1.35, wordBreak: 'break-word', boxShadow: 'var(--shadow-sm)',
                  }}>{renderBody(m.body, mine)}</div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Saisie */}
        <div style={{ flexShrink: 0, padding: '10px 16px 16px', borderTop: '1px solid var(--border)' }}>
          {err && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 8, wordBreak: 'break-word' }}>{err}</div>}

          {currentUser ? (
            <>
              {/* Suggestions de mentions */}
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {suggestions.map(u => (
                    <button key={u.id} onClick={() => applyMention(u.pseudo)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
                      padding: '4px 10px', borderRadius: 999, background: 'var(--bg-fill)',
                      border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-1)',
                    }}>
                      <img src={`https://flagcdn.com/w20/${u.countryCode}.png`} alt=""
                        style={{ width: 16, height: 11, borderRadius: 2, objectFit: 'cover' }} />
                      @{u.pseudo}
                    </button>
                  ))}
                </div>
              )}

              {/* Panneau emojis */}
              {showEmoji && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 8, maxHeight: 124, overflowY: 'auto',
                  padding: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => insertEmoji(e)} style={{
                      fontSize: 22, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer',
                      padding: 4, borderRadius: 8,
                    }}>{e}</button>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setShowEmoji(s => !s)} title="Emojis" style={{
                  flexShrink: 0, width: 42, height: 42, borderRadius: 12, cursor: 'pointer', fontSize: 20,
                  background: showEmoji ? 'rgba(200,155,60,0.15)' : 'var(--bg-card)',
                  border: `1px solid ${showEmoji ? GOLD : 'var(--border)'}`,
                }}>😊</button>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') send() }}
                  maxLength={500}
                  placeholder="Votre message… (@ pour mentionner)"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)',
                    background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: 14, outline: 'none' }} />
                <button onClick={send} disabled={busy || !draft.trim()} style={{
                  padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: draft.trim() ? 'linear-gradient(135deg,#C89B3C,#E8D080)' : 'var(--border)',
                  color: draft.trim() ? '#0D0800' : 'var(--text-3)', fontWeight: 700, fontSize: 14,
                  cursor: draft.trim() ? 'pointer' : 'default',
                }}>Envoyer</button>
              </div>
            </>
          ) : (
            <button onClick={onOpenAuth} style={{
              width: '100%', padding: '11px', borderRadius: 12, border: `1px solid ${GOLD}55`,
              background: 'rgba(200,155,60,0.10)', color: GOLD, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>Connectez-vous pour participer au chat</button>
          )}
        </div>
      </div>
    </>
  )
}
