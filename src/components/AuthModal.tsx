import { useState } from 'react'
import { register, login } from '../services/auth'
import type { UserProfile } from '../services/auth'
import { COUNTRIES } from '../data/countries'

interface AuthModalProps {
  onSuccess: (user: UserProfile) => void
  onClose: () => void
}

type Mode = 'login' | 'register'

export default function AuthModal({ onSuccess, onClose }: AuthModalProps) {
  const [mode,       setMode]       = useState<Mode>('login')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [pseudo,     setPseudo]     = useState('')
  const [country,    setCountry]    = useState(COUNTRIES[0])
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  const switchMode = (m: Mode) => { setMode(m); setError('') }

  const submit = async () => {
    setError('')
    if (!email.trim() || !password.trim()) { setError('Remplis tous les champs.'); return }
    if (mode === 'register' && !pseudo.trim()) { setError('Choisis un pseudo.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 320)) // slight delay for UX feel
    const result = mode === 'register'
      ? register(email.trim(), password, pseudo.trim(), country.code, country.name)
      : login(email.trim(), password)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onSuccess(result.user!)
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'var(--bg-fill)', border: '1.5px solid var(--border)',
    borderRadius: 12, fontSize: 15, color: 'var(--text-1)',
    outline: 'none', transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'fadeIn 0.18s ease',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--bg-card)',
        borderRadius: '24px 24px 0 0',
        padding: '10px 24px 40px',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
        animation: 'fadeSlideUp 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--bg-fill)', margin: '0 auto 20px',
        }} />

        {/* Title */}
        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 28, letterSpacing: 3, color: '#C89B3C',
          textAlign: 'center', marginBottom: 4,
        }}>
          TRIVELA
        </div>
        <p style={{
          textAlign: 'center', fontSize: 13, color: 'var(--text-2)',
          marginBottom: 24,
        }}>
          {mode === 'login' ? 'Connexion à votre compte' : 'Créer un compte joueur'}
        </p>

        {/* Mode toggle */}
        <div style={{
          display: 'flex', background: 'var(--bg-fill)',
          borderRadius: 12, padding: 3, marginBottom: 20,
        }}>
          {(['login', 'register'] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.18s',
              background: mode === m ? 'var(--bg-card)' : 'transparent',
              color: mode === m ? 'var(--text-1)' : 'var(--text-3)',
              boxShadow: mode === m ? 'var(--shadow-sm)' : 'none',
            }}>
              {m === 'login' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email" placeholder="Adresse email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={input}
          />
          <input
            type="password" placeholder="Mot de passe" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={input}
          />

          {mode === 'register' && (
            <>
              <input
                type="text" placeholder="Pseudo (2–20 caractères)" value={pseudo}
                onChange={e => setPseudo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={input}
                maxLength={20}
              />

              {/* Country picker */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  ...input, cursor: 'pointer',
                }}>
                  <img
                    src={`https://flagcdn.com/w40/${country.code}.png`}
                    alt={country.name}
                    style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 3 }}
                  />
                  <span style={{ flex: 1, fontSize: 15, color: 'var(--text-1)' }}>
                    {country.name}
                  </span>
                  <span style={{ color: 'var(--text-3)', fontSize: 12 }}>▾</span>
                </div>
                <select
                  value={country.code}
                  onChange={e => {
                    const found = COUNTRIES.find(c => c.code === e.target.value)
                    if (found) setCountry(found)
                  }}
                  style={{
                    position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer',
                    width: '100%', height: '100%',
                  }}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, fontSize: 13, color: '#dc2626',
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={submit}
          disabled={loading}
          style={{
            width: '100%', marginTop: 20, padding: '14px 0',
            background: loading ? 'rgba(200,155,60,0.4)' : 'linear-gradient(135deg,#C89B3C,#E8D080)',
            border: 'none', borderRadius: 14,
            color: '#0D0800', fontSize: 15, fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(200,155,60,0.4)',
            transition: 'all 0.18s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          onPointerDown={e => { if (!loading) e.currentTarget.style.transform = 'scale(0.97)' }}
          onPointerUp={e   => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {loading ? (
            <>
              <div style={{
                width: 16, height: 16, border: '2px solid rgba(13,8,0,0.2)',
                borderTopColor: '#0D0800', borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
              }} />
              Chargement…
            </>
          ) : (
            mode === 'login' ? 'Se connecter' : "Créer mon compte"
          )}
        </button>
      </div>
    </div>
  )
}
