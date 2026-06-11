import { useState } from 'react'
import { updatePassword } from '../services/auth'

interface Props {
  onClose: () => void
}

export default function ResetPasswordModal({ onClose }: Props) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  const submit = async () => {
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) { setError(error); return }
    setDone(true)
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'var(--bg-fill)', border: '1.5px solid var(--border)',
    borderRadius: 12, fontSize: 15, color: 'var(--text-1)',
    outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'fadeIn 0.18s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--bg-card)',
        borderRadius: '24px 24px 0 0',
        padding: '10px 24px 40px',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
        animation: 'fadeSlideUp 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--bg-fill)', margin: '0 auto 20px' }} />

        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 28, letterSpacing: 3, color: '#C89B3C',
          textAlign: 'center', marginBottom: 4,
        }}>TRIVELA</div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '14px 0 4px' }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
              Mot de passe mis à jour
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 22 }}>
              Vous êtes connecté. Vous pouvez utiliser votre nouveau mot de passe dès maintenant.
            </p>
            <button onClick={onClose} style={{
              width: '100%', padding: '14px 0',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              border: 'none', borderRadius: 14, color: '#0D0800',
              fontSize: 15, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(200,155,60,0.4)',
            }}>Continuer</button>
          </div>
        ) : (
          <>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}>
              Choisissez un nouveau mot de passe
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="password" placeholder="Nouveau mot de passe" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={input}
              />
              <input
                type="password" placeholder="Confirmer le mot de passe" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={input}
              />
            </div>

            {error && (
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, fontSize: 13, color: '#dc2626',
              }}>{error}</div>
            )}

            <button onClick={submit} disabled={loading} style={{
              width: '100%', marginTop: 20, padding: '14px 0',
              background: loading ? 'rgba(200,155,60,0.4)' : 'linear-gradient(135deg,#C89B3C,#E8D080)',
              border: 'none', borderRadius: 14, color: '#0D0800',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(200,155,60,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
            </button>

            <button onClick={onClose} style={{
              width: '100%', marginTop: 10, padding: '10px 0',
              background: 'none', border: 'none', color: 'var(--text-3)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Annuler</button>
          </>
        )}
      </div>
    </div>
  )
}
