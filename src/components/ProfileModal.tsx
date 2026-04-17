import { useState, useEffect } from 'react'
import { getBets, logout } from '../services/auth'
import type { UserProfile, BetRecord } from '../services/auth'

interface ProfileModalProps {
  currentUser: UserProfile
  onClose: () => void
  onLogout: () => void
}

export default function ProfileModal({ currentUser, onClose, onLogout }: ProfileModalProps) {
  const [bets, setBets] = useState<BetRecord[]>([])

  useEffect(() => {
    getBets(currentUser.id).then(setBets)
  }, [currentUser.id])

  const handleLogout = () => {
    logout().then(onLogout)
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
        boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
        animation: 'fadeSlideUp 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '88vh',
      }}>
        {/* Drag handle */}
        <div style={{ flexShrink: 0, padding: '10px 24px 0' }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'var(--bg-fill)', margin: '0 auto 20px',
          }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            {/* Avatar circle */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: 22, color: '#0D0800', letterSpacing: 1,
              }}>
                {currentUser.pseudo[0].toUpperCase()}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Bebas Neue', cursive",
                fontSize: 22, letterSpacing: 2, color: 'var(--text-1)', lineHeight: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {currentUser.pseudo}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, letterSpacing: 0.5 }}>
                Membre depuis {new Date(currentUser.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, flexShrink: 0,
              background: 'var(--bg-fill)', border: '1px solid var(--border)',
              borderRadius: 10, cursor: 'pointer', fontSize: 14,
              color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>
          </div>

          {/* Info cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {/* Email */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: 'var(--bg-fill)', border: '1px solid var(--border)',
              borderRadius: 12,
            }}>
              <span style={{ fontSize: 16 }}>✉️</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'var(--text-3)',
                  textTransform: 'uppercase', marginBottom: 1 }}>
                  Email
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>
                  {currentUser.email}
                </div>
              </div>
            </div>

            {/* Country */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: 'var(--bg-fill)', border: '1px solid var(--border)',
              borderRadius: 12,
            }}>
              <img
                src={`https://flagcdn.com/w40/${currentUser.countryCode}.png`}
                alt={currentUser.countryName}
                style={{ width: 28, height: 19, borderRadius: 3, objectFit: 'cover',
                  border: '1px solid var(--border)', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: 'var(--text-3)',
                  textTransform: 'uppercase', marginBottom: 1 }}>
                  Nationalité
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>
                  {currentUser.countryName}
                </div>
              </div>
            </div>

            {/* Score */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px',
              background: 'rgba(200,155,60,0.06)', border: '1px solid rgba(200,155,60,0.2)',
              borderRadius: 12,
            }}>
              <span style={{ fontSize: 16 }}>🏆</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#A07828',
                  textTransform: 'uppercase', marginBottom: 1 }}>
                  Score total
                </div>
                <div style={{
                  fontFamily: "'Bebas Neue', cursive",
                  fontSize: 18, color: '#C89B3C', letterSpacing: 1,
                }}>
                  {currentUser.score.toLocaleString()} pts
                </div>
              </div>
            </div>
          </div>

          {/* Bet history label */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            color: 'var(--text-3)', textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            Historique des paris ({bets.length})
          </div>
        </div>

        {/* Scrollable bet list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px', scrollbarWidth: 'none' }}>
          {bets.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '28px 0',
              fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6,
            }}>
              Aucun pari confirmé pour l'instant.<br />
              Rendez-vous dans l'onglet Paris !
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
              {bets.map(bet => (
                <div key={bet.id} style={{
                  padding: '10px 14px',
                  background: 'var(--bg-fill)', border: '1px solid var(--border)',
                  borderRadius: 12,
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
                    color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 5,
                  }}>
                    {bet.stage}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bet.home}
                    </span>
                    <span style={{
                      fontFamily: "'Bebas Neue', cursive",
                      fontSize: 18, color: '#C89B3C', letterSpacing: 2, flexShrink: 0,
                    }}>
                      {bet.homeScore} – {bet.awayScore}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)',
                      flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {bet.away}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout button */}
        <div style={{ flexShrink: 0, padding: '12px 24px 36px' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '13px 0',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 14,
              color: '#dc2626', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onPointerDown={e => (e.currentTarget.style.opacity = '0.6')}
            onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )
}
