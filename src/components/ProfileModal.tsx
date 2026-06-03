import { useState, useEffect } from 'react'
import {
  getBets, logout, getAuthEmail, updateProfileInfo, updateEmail, updatePassword,
} from '../services/auth'
import type { UserProfile, BetRecord } from '../services/auth'
import { COUNTRIES } from '../data/countries'

interface ProfileModalProps {
  currentUser: UserProfile
  onClose: () => void
  onLogout: () => void
  onUpdated: (u: UserProfile) => void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 12,
  border: '1px solid var(--border)', background: 'var(--bg-fill)',
  color: 'var(--text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'var(--text-3)',
  textTransform: 'uppercase', margin: '2px 0',
}

export default function ProfileModal({ currentUser, onClose, onLogout, onUpdated }: ProfileModalProps) {
  const [bets, setBets] = useState<BetRecord[]>([])
  const [email, setEmail] = useState(currentUser.email)

  const [editing, setEditing] = useState(false)
  const [pseudo, setPseudo] = useState(currentUser.pseudo)
  const [countryCode, setCountryCode] = useState(currentUser.countryCode)
  const [countryName, setCountryName] = useState(currentUser.countryName)
  const [newEmail, setNewEmail] = useState(currentUser.email)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => { getBets(currentUser.id).then(setBets) }, [currentUser.id])
  useEffect(() => {
    if (!email) getAuthEmail().then(e => { if (e) { setEmail(e); setNewEmail(e) } })
  }, [email])

  const startEdit = () => {
    setPseudo(currentUser.pseudo)
    setCountryCode(currentUser.countryCode)
    setCountryName(currentUser.countryName)
    setNewEmail(email)
    setNewPassword('')
    setErr(''); setMsg(''); setEditing(true)
  }

  const save = async () => {
    if (busy) return
    setBusy(true); setErr(''); setMsg('')
    const errs: string[] = []
    let nextEmail = email
    const notes: string[] = []

    if (pseudo.trim() !== currentUser.pseudo || countryCode !== currentUser.countryCode) {
      const r = await updateProfileInfo(currentUser.id, pseudo, countryCode, countryName)
      if (r.error) errs.push(r.error)
    }
    if (newEmail.trim() && newEmail.trim().toLowerCase() !== email.toLowerCase()) {
      const r = await updateEmail(newEmail)
      if (r.error) errs.push(r.error)
      else { nextEmail = newEmail.trim(); notes.push('Vérifie ta boîte mail pour confirmer le nouvel e-mail.') }
    }
    if (newPassword) {
      const r = await updatePassword(newPassword)
      if (r.error) errs.push(r.error)
    }

    setBusy(false)
    if (errs.length) { setErr(errs.join(' ')); return }

    setEmail(nextEmail)
    onUpdated({ ...currentUser, pseudo: pseudo.trim(), countryCode, countryName, email: nextEmail })
    setMsg(['Profil mis à jour ✅', ...notes].join(' '))
    setEditing(false)
  }

  const handleLogout = () => { logout().then(onLogout) }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'fadeIn 0.18s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480, background: 'var(--bg-card)',
        borderRadius: '24px 24px 0 0', boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
        animation: 'fadeSlideUp 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column', maxHeight: '88vh',
      }}>
        {/* Drag handle */}
        <div style={{ flexShrink: 0, padding: '10px 24px 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-fill)', margin: '0 auto 20px' }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: '#0D0800', letterSpacing: 1 }}>
                {currentUser.pseudo[0].toUpperCase()}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', cursive", fontSize: 22, letterSpacing: 2,
                  color: 'var(--text-1)', lineHeight: 1, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{currentUser.pseudo}</span>
                {currentUser.isAdmin && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: '#0D0800',
                    background: 'linear-gradient(135deg,#C89B3C,#E8D080)', borderRadius: 6,
                    padding: '2px 6px', flexShrink: 0,
                  }}>👑 ADMIN</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, letterSpacing: 0.5 }}>
                Membre depuis {new Date(currentUser.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            {!editing && (
              <button onClick={startEdit} style={{
                padding: '7px 12px', flexShrink: 0,
                background: 'rgba(200,155,60,0.10)', border: '1px solid rgba(200,155,60,0.3)',
                borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#A07828',
              }}>Modifier</button>
            )}
            <button onClick={onClose} style={{
              width: 32, height: 32, flexShrink: 0,
              background: 'var(--bg-fill)', border: '1px solid var(--border)',
              borderRadius: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {msg && (
            <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 12 }}>{msg}</div>
          )}

          {editing ? (
            /* ── Formulaire d'édition ──────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
              <div style={labelStyle}>Pseudo</div>
              <input value={pseudo} maxLength={20} onChange={e => setPseudo(e.target.value)}
                placeholder="Pseudo (2–20 caractères)" style={inputStyle} />

              <div style={labelStyle}>Pays</div>
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...inputStyle, cursor: 'pointer' }}>
                  <img src={`https://flagcdn.com/w40/${countryCode}.png`} alt={countryName}
                    style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 3 }} />
                  <span style={{ flex: 1, fontSize: 14, color: 'var(--text-1)' }}>{countryName}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>▾</span>
                </div>
                <select value={countryCode}
                  onChange={e => {
                    const found = COUNTRIES.find(c => c.code === e.target.value)
                    if (found) { setCountryCode(found.code); setCountryName(found.name) }
                  }}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>

              <div style={labelStyle}>E-mail</div>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="Adresse e-mail" style={inputStyle} />

              <div style={labelStyle}>Nouveau mot de passe</div>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Laisser vide pour ne pas changer" style={inputStyle} />

              {err && <div style={{ fontSize: 12, color: '#dc2626', wordBreak: 'break-word' }}>{err}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={() => { setEditing(false); setErr('') }} disabled={busy} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, cursor: 'pointer',
                  background: 'var(--bg-fill)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', fontSize: 14, fontWeight: 700,
                }}>Annuler</button>
                <button onClick={save} disabled={busy} style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#C89B3C,#E8D080)', color: '#0D0800',
                  fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1,
                }}>{busy ? '…' : 'Enregistrer'}</button>
              </div>
            </div>
          ) : (
            /* ── Vue lecture ───────────────────────────────────── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <span style={{ fontSize: 16 }}>✉️</span>
                <div style={{ minWidth: 0 }}>
                  <div style={labelStyle}>Email</div>
                  <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email || '—'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <img src={`https://flagcdn.com/w40/${currentUser.countryCode}.png`} alt={currentUser.countryName}
                  style={{ width: 28, height: 19, borderRadius: 3, objectFit: 'cover',
                    border: '1px solid var(--border)', flexShrink: 0 }} />
                <div>
                  <div style={labelStyle}>Nationalité</div>
                  <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{currentUser.countryName}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'rgba(200,155,60,0.06)', border: '1px solid rgba(200,155,60,0.2)', borderRadius: 12 }}>
                <span style={{ fontSize: 16 }}>🏆</span>
                <div>
                  <div style={{ ...labelStyle, color: '#A07828' }}>Score total</div>
                  <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, color: '#C89B3C', letterSpacing: 1 }}>
                    {currentUser.score.toLocaleString()} pts
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bet history label */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'var(--text-3)',
            textTransform: 'uppercase', marginBottom: 10 }}>
            Historique des paris ({bets.length})
          </div>
        </div>

        {/* Scrollable bet list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px', scrollbarWidth: 'none' }}>
          {bets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>
              Aucun pari confirmé pour l'instant.<br />Rendez-vous dans l'onglet Paris !
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
              {bets.map(bet => (
                <div key={bet.id} style={{ padding: '10px 14px', background: 'var(--bg-fill)',
                  border: '1px solid var(--border)', borderRadius: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text-3)',
                    textTransform: 'uppercase', marginBottom: 5 }}>{bet.stage}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.home}</span>
                    <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, color: '#C89B3C',
                      letterSpacing: 2, flexShrink: 0 }}>{bet.homeScore} – {bet.awayScore}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', flex: 1, textAlign: 'right',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.away}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout button */}
        <div style={{ flexShrink: 0, padding: '12px 24px 36px' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '13px 0', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14,
            color: '#dc2626', fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}
            onPointerDown={e => (e.currentTarget.style.opacity = '0.6')}
            onPointerUp={e => (e.currentTarget.style.opacity = '1')}
          >Se déconnecter</button>
        </div>
      </div>
    </div>
  )
}
