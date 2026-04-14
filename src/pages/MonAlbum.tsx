import { useState, useMemo } from 'react'
import PageLayout from './PageLayout'
import { GROUPS } from '../data/wc2026Matches'
import { PLAYERS_BY_TEAM } from '../data/wc2026Players'
import type { Player, Rarity } from '../data/wc2026Players'
import { hasCard, getCardCount, getCollectionStats } from '../services/collection'

const RARITY_LABEL: Record<Rarity, string> = {
  bronze: 'Bronze', silver: 'Argent', gold: 'Or', carnage: 'Carnage',
}

// Build alphabetical team list from groups
const ALL_TEAMS = Object.values(GROUPS)
  .flat()
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

function rarityOrder(r: Rarity): number {
  return r === 'carnage' ? 4 : r === 'gold' ? 3 : r === 'silver' ? 2 : 1
}

export default function MonAlbum({ onBack }: { onBack: () => void }) {
  const [activeTeam, setActiveTeam] = useState(ALL_TEAMS[0]?.short ?? 'FRA')
  const [, setTick] = useState(0) // force re-render after navigation
  const stats = useMemo(() => getCollectionStats(), [])
  const teamPlayers = PLAYERS_BY_TEAM[activeTeam] ?? []
  const teamObj = ALL_TEAMS.find(t => t.short === activeTeam)

  const switchTeam = (code: string) => {
    setActiveTeam(code)
    setTick(t => t + 1)
  }

  return (
    <PageLayout onBack={onBack} accentColor="#C89B3C" flag="📖" title="MON ALBUM"
      subtitle={`${stats.collected} / ${stats.total} cartes collectées`}>

      {/* Progress bar */}
      <div style={{
        marginBottom: 16, padding: '12px 16px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>Progression</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#C89B3C' }}>
            {stats.total > 0 ? Math.round(stats.collected / stats.total * 100) : 0}%
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-fill)', borderRadius: 3 }}>
          <div style={{
            height: '100%', borderRadius: 3, transition: 'width 0.4s ease',
            background: 'linear-gradient(90deg, #C89B3C, #E8D080)',
            width: `${stats.total > 0 ? Math.min(100, stats.collected / stats.total * 100) : 0}%`,
          }} />
        </div>
        {/* Rarity breakdown */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {(['carnage', 'gold', 'silver', 'bronze'] as Rarity[]).map(r => {
            const s = stats.byRarity[r]
            return (
              <div key={r} style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                padding: '3px 7px', borderRadius: 6,
                background: r === 'carnage' ? 'rgba(255,23,68,0.08)' :
                  r === 'gold' ? 'rgba(218,165,32,0.08)' :
                    r === 'silver' ? 'rgba(160,160,180,0.08)' : 'rgba(160,120,60,0.08)',
                color: r === 'carnage' ? '#ff1744' :
                  r === 'gold' ? '#b8860b' :
                    r === 'silver' ? '#6E6E73' : '#a17d44',
              }}>
                {RARITY_LABEL[r]}: {s?.collected ?? 0}/{s?.total ?? 0}
              </div>
            )
          })}
        </div>
      </div>

      {/* Team selector — horizontal scroll */}
      <div style={{
        display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4,
        marginBottom: 16, scrollbarWidth: 'none',
      }}>
        {ALL_TEAMS.map(t => {
          const active = activeTeam === t.short
          const teamStats = stats.byTeam[t.short]
          const complete = teamStats && teamStats.collected >= teamStats.total && teamStats.total > 0
          return (
            <button key={t.short} onClick={() => switchTeam(t.short)} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${active ? '#C89B3C' : 'var(--border)'}`,
              background: active ? 'rgba(200,155,60,0.1)' : 'var(--bg-card)',
              boxShadow: active ? 'none' : 'var(--shadow-sm)',
              transition: 'all 0.15s',
            }}>
              <img src={`https://flagcdn.com/w40/${t.code}.png`} alt={t.name}
                style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover' }} />
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                color: active ? '#A07828' : 'var(--text-2)',
              }}>{t.short}</span>
              {complete && <span style={{ fontSize: 8, color: '#22c55e' }}>✓</span>}
            </button>
          )
        })}
      </div>

      {/* Team header */}
      {teamObj && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', marginBottom: 16,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-sm)',
        }}>
          <img src={`https://flagcdn.com/w80/${teamObj.code}.png`} alt={teamObj.name}
            style={{ width: 36, height: 24, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border)' }} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 2,
              color: 'var(--text-1)', lineHeight: 1,
            }}>{teamObj.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
              {teamPlayers.filter(p => hasCard(p.id)).length} / {teamPlayers.length} cartes
            </div>
          </div>
        </div>
      )}

      {/* Card grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
      }}>
        {teamPlayers
          .sort((a, b) => rarityOrder(b.rarity) - rarityOrder(a.rarity) || b.rating - a.rating)
          .map((p, i) => (
            <PlayerCard key={p.id} player={p} owned={hasCard(p.id)} count={getCardCount(p.id)} delay={i * 40} />
          ))
        }
      </div>

      {teamPlayers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', fontSize: 13 }}>
          Aucun joueur enregistré pour cette équipe.
        </div>
      )}
    </PageLayout>
  )
}

// ─── Player Card ──────────────────────────────────────────────────────────
function PlayerCard({ player, owned, count, delay }: {
  player: Player; owned: boolean; count: number; delay: number
}) {
  const r = player.rarity
  const rarityClass = `card-${r}`

  if (!owned) {
    return (
      <div style={{
        borderRadius: 14, overflow: 'hidden',
        background: 'var(--bg-fill)', border: '1.5px solid var(--border)',
        padding: 14, textAlign: 'center', minHeight: 140,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: 0.5,
        animation: `fadeSlideUp .3s ease ${delay}ms both`,
      }}>
        <div style={{ fontSize: 32, marginBottom: 6, filter: 'grayscale(1)' }}>❓</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 0.5 }}>
          {player.position} · {RARITY_LABEL[r]}
        </div>
      </div>
    )
  }

  return (
    <div className={rarityClass} style={{
      borderRadius: 14, overflow: 'hidden', padding: 0,
      boxShadow: r === 'carnage' ? undefined : 'var(--shadow)',
      animation: `fadeSlideUp .3s ease ${delay}ms both`,
      position: 'relative',
    }}>
      {/* Top bar: rating + rarity */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 10px 4px',
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: '#fff',
          textShadow: '0 1px 3px rgba(0,0,0,0.4)', lineHeight: 1,
        }}>{player.rating}</span>
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}>{RARITY_LABEL[r]}</span>
      </div>

      {/* Player icon area */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4px 10px 6px',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          border: '2px solid rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 22 }}>
            {player.position === 'GK' ? '🧤' : player.position === 'DEF' ? '🛡️' : player.position === 'MID' ? '🎯' : '⚡'}
          </span>
        </div>
      </div>

      {/* Name + info */}
      <div style={{
        background: 'rgba(0,0,0,0.25)', padding: '8px 10px 10px',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive", fontSize: 14, letterSpacing: 1.5,
          color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          lineHeight: 1.1, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{player.name}</div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{
            fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 600,
            letterSpacing: 0.3,
          }}>{player.position} · {player.age} ans</span>
          <span style={{
            fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>{player.trait}</span>
        </div>
      </div>

      {/* Duplicate badge */}
      {count > 1 && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 800, color: '#fff',
        }}>×{count}</div>
      )}
    </div>
  )
}
