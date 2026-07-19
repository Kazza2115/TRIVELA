import { useState, useEffect } from 'react'
import PageLayout from './PageLayout'
import Fireworks from '../components/Fireworks'
import { subscribeToLeaderboard, getWorldChampion } from '../services/auth'
import { teamByShort } from '../data/wc2026Matches'
import type { UserProfile } from '../services/auth'

const PODIUM_COLORS  = ['#A0A0A8', '#C89B3C', '#A07040']
const PODIUM_HEIGHTS = [110, 140, 90]

interface ClassementProps {
  onBack: () => void
  currentUser: UserProfile | null
  onOpenAuth: () => void
  onSelectPlayer: (player: UserProfile, rank: number) => void
}

export default function Classement({ onBack, currentUser, onOpenAuth, onSelectPlayer }: ClassementProps) {
  const [players, setPlayers] = useState<UserProfile[]>([])
  const [champion, setChampion] = useState<string | null>(null)   // pays champion du monde (code court)

  useEffect(() => subscribeToLeaderboard(setPlayers), [])
  useEffect(() => { getWorldChampion().then(setChampion) }, [])

  const championTeam = champion ? teamByShort(champion) : null
  const seasonOver = !!champion                     // tournoi terminé → fête sur le podium
  const top3   = players.slice(0, 3)
  const myRank = currentUser ? players.findIndex(p => p.id === currentUser.id) + 1 : null

  return (
    <PageLayout onBack={onBack} accentColor="#C89B3C" flag="🏆"
      title="CLASSEMENT" subtitle="Top joueurs de la saison">

      {/* Season pill */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: 'var(--shadow-sm)', marginBottom: 24,
      }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700,
            letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
            Saison actuelle
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
            Coupe du Monde 2026
          </div>
        </div>
        {seasonOver ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px',
            background: 'rgba(200,155,60,0.14)', border: '1px solid rgba(200,155,60,0.4)',
            borderRadius: 20, fontSize: 11, fontWeight: 800, color: '#A07828',
          }}>
            🏆 {championTeam ? (
              <>
                <img src={`https://flagcdn.com/w20/${championTeam.code}.png`} alt=""
                  style={{ width: 16, height: 11, borderRadius: 2, objectFit: 'cover' }} />
                {championTeam.short} CHAMPION
              </>
            ) : 'TERMINÉ'}
          </div>
        ) : (
          <div style={{
            padding: '5px 12px',
            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#16a34a',
          }}>
            EN COURS
          </div>
        )}
      </div>

      {players.length === 0 ? (
        /* ── Empty state ───────────────────────────────────────── */
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🏆</div>
          <div style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 22, letterSpacing: 2, color: 'var(--text-1)', marginBottom: 8,
          }}>
            Aucun joueur encore
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 28 }}>
            Sois le premier à t'inscrire et à prendre la tête du classement !
          </p>
          {!currentUser && (
            <button onClick={onOpenAuth} style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              border: 'none', borderRadius: 14,
              color: '#0D0800', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(200,155,60,0.4)',
              transition: 'transform 0.12s',
            }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
              onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
            >
              S'inscrire →
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Bandeau « Champions du monde » (fin de saison) ─── */}
          {seasonOver && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 14px', marginBottom: 14,
              background: 'linear-gradient(135deg, rgba(200,155,60,0.16), rgba(255,215,94,0.06))',
              border: '1px solid rgba(200,155,60,0.4)', borderRadius: 14,
              fontFamily: "'Bebas Neue', cursive", fontSize: 17, letterSpacing: 1.5, color: '#A07828',
            }}>
              🎉 Coupe du Monde terminée — bravo au podium ! 🎉
            </div>
          )}

          {/* ── Podium ─────────────────────────────────────────── */}
          <div style={{
            position: 'relative',
            display: 'flex', gap: 10, marginBottom: 28,
            justifyContent: 'center', alignItems: 'flex-end',
          }}>
            {/* Feux d'artifice sur le podium quand le tournoi est terminé */}
            <Fireworks active={seasonOver} style={{ top: -24, zIndex: 3 }} />
            {[top3[1], top3[0], top3[2]].map((p, i) => {
              if (!p) return <div key={i} style={{ width: 100, flexShrink: 0 }} />
              const c = PODIUM_COLORS[i]
              const medals = ['🥈', '🥇', '🥉']
              const podiumRank = i === 0 ? 2 : i === 1 ? 1 : 3
              return (
                <div key={p.id}
                  onClick={() => onSelectPlayer(p, podiumRank)}
                  style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  flex: '0 0 auto', width: 100, cursor: 'pointer',
                }}>
                  <img src={`https://flagcdn.com/w40/${p.countryCode}.png`} alt={p.countryName}
                    style={{ width: 28, height: 19, borderRadius: 3, objectFit: 'cover',
                      border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)',
                    textAlign: 'center', maxWidth: 90,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.pseudo}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-2)' }}>
                    {p.score.toLocaleString()} pts
                  </div>
                  <div style={{
                    width: '100%', height: PODIUM_HEIGHTS[i],
                    background: `linear-gradient(180deg, ${c}22, ${c}08)`,
                    border: `1.5px solid ${c}44`, borderRadius: '10px 10px 0 0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, boxShadow: `inset 0 0 0 1px ${c}22`,
                  }}>
                    {medals[i]}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Règle de départage ─────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 14px', marginBottom: 12,
            background: 'rgba(200,155,60,0.07)', border: '1px solid rgba(200,155,60,0.22)',
            borderRadius: 12, fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>⚖️</span>
            <span>
              En cas d'égalité de points, on départage par le nombre de{' '}
              <b style={{ color: 'var(--text-1)' }}>scores exacts</b> 🎯, puis de{' '}
              <b style={{ color: 'var(--text-1)' }}>bons résultats</b> ✓.
            </span>
          </div>

          {/* ── Full list ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map((p, i) => {
              const isMe = currentUser?.id === p.id
              return (
                <div key={p.id}
                  onClick={() => onSelectPlayer(p, i + 1)}
                  style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: isMe ? 'rgba(200,155,60,0.08)' : 'var(--bg-card)',
                  border: isMe ? '1px solid rgba(200,155,60,0.35)' : '1px solid var(--border)',
                  borderRadius: 12, boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
                  animation: `fadeSlideUp 0.35s ease ${i * 35}ms both`,
                }}>
                  <div style={{
                    width: 28, fontFamily: "'Bebas Neue', cursive",
                    fontSize: 18, textAlign: 'center',
                    color: i < 3 ? '#C89B3C' : 'var(--text-3)',
                  }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </div>
                  <img src={`https://flagcdn.com/w40/${p.countryCode}.png`} alt={p.countryName}
                    style={{ width: 26, height: 17, borderRadius: 3, objectFit: 'cover',
                      border: '1px solid var(--border)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700,
                      color: isMe ? '#A07828' : 'var(--text-1)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.pseudo}
                      {isMe && (
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, marginLeft: 5 }}>
                          (Vous)
                        </span>
                      )}
                    </div>
                    {((p.exactCount ?? 0) > 0 || (p.goodCount ?? 0) > 0) && (
                      <div style={{ display: 'flex', gap: 9, fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                        <span>🎯 {p.exactCount ?? 0} exact{(p.exactCount ?? 0) > 1 ? 's' : ''}</span>
                        <span>✓ {p.goodCount ?? 0} bon{(p.goodCount ?? 0) > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontFamily: "'Bebas Neue', cursive",
                    fontSize: 17, color: 'var(--text-1)', letterSpacing: 0.5,
                  }}>
                    {p.score.toLocaleString()}&thinsp;
                    <span style={{ fontSize: 9, color: 'var(--text-3)' }}>pts</span>
                  </div>
                  <span style={{ color: 'var(--text-3)', fontSize: 18, marginLeft: 2, flexShrink: 0 }}>›</span>
                </div>
              )
            })}
          </div>

          {/* CTA if not logged in */}
          {!currentUser && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button onClick={onOpenAuth} style={{
                padding: '12px 28px',
                background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
                border: 'none', borderRadius: 14,
                color: '#0D0800', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(200,155,60,0.4)',
                transition: 'transform 0.12s',
              }}
                onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.96)')}
                onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Rejoindre le classement →
              </button>
              {myRank !== null && myRank > 0 && (
                <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
                  Votre rang actuel : #{myRank}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </PageLayout>
  )
}
