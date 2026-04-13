import { useState } from 'react'
import PageLayout from './PageLayout'
import { GROUP_MATCHES, KNOCKOUT_MATCHES, GROUPS } from '../data/wc2026Matches'
import type { Match } from '../data/wc2026Matches'

type Tab = 'groupes' | 'eliminatoires'
type Predictions = Record<string, { home: number; away: number }>

const KO_ROUNDS = [
  { key: 'r32',   label: '8èmes'  },
  { key: 'r16',   label: 'Quarts' },
  { key: 'qf',    label: 'Demies' },
  { key: 'sf',    label: 'Semis'  },
  { key: 'final', label: 'Finale' },
] as const

export default function Paris({ onBack }: { onBack: () => void }) {
  const [tab,         setTab]         = useState<Tab>('groupes')
  const [activeGroup, setActiveGroup] = useState('A')
  const [matchday,    setMatchday]    = useState<1|2|3>(1)
  const [koRound,     setKoRound]     = useState<string>('r32')
  const [predictions, setPredictions] = useState<Predictions>({})
  const [confirmed,   setConfirmed]   = useState<Set<string>>(new Set())

  const setPrediction = (id: string, side: 'home'|'away', delta: number) => {
    setPredictions(prev => {
      const cur = prev[id] ?? { home: 0, away: 0 }
      return { ...prev, [id]: {
        home: side === 'home' ? Math.max(0, cur.home + delta) : cur.home,
        away: side === 'away' ? Math.max(0, cur.away + delta) : cur.away,
      }}
    })
    setConfirmed(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const confirm = (id: string) => setConfirmed(prev => new Set(prev).add(id))

  const groupMatches = GROUP_MATCHES.filter(m => m.group === activeGroup && m.matchday === matchday)
  const koMatches    = KNOCKOUT_MATCHES.filter(m => m.round === koRound)

  return (
    <PageLayout
      onBack={onBack}
      accentColor="#C89B3C"
      flag="🎯"
      title="PARIS"
      subtitle="Coupe du Monde 2026 · Pronostics"
    >
      {/* ── Main tabs ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0,
        background: 'var(--bg-fill)',
        borderRadius: 12, padding: 3,
        marginBottom: 20,
      }}>
        {(['groupes', 'eliminatoires'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '9px 0',
              borderRadius: 10, border: 'none',
              fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
              background: tab === t ? 'var(--bg-card)' : 'transparent',
              color: tab === t ? 'var(--text-1)' : 'var(--text-3)',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t === 'groupes' ? 'Phase de Groupes' : 'Éliminatoires'}
          </button>
        ))}
      </div>

      {/* ══ GROUP STAGE ══════════════════════════════════════════ */}
      {tab === 'groupes' && (
        <>
          {/* Group pills */}
          <div style={{
            display: 'flex', gap: 5, overflowX: 'auto',
            paddingBottom: 4, marginBottom: 14, scrollbarWidth: 'none',
          }}>
            {Object.keys(GROUPS).map(g => (
              <GroupPill key={g} label={g} active={activeGroup === g} onClick={() => setActiveGroup(g)} />
            ))}
          </div>

          <GroupBanner group={activeGroup} />

          {/* Matchday */}
          <div style={{
            display: 'flex', gap: 3,
            background: 'var(--bg-fill)',
            borderRadius: 10, padding: 3,
            marginBottom: 16,
          }}>
            {([1, 2, 3] as const).map(md => (
              <button
                key={md}
                onClick={() => setMatchday(md)}
                style={{
                  flex: 1, padding: '7px 0',
                  borderRadius: 8, border: 'none',
                  fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: matchday === md ? 'var(--bg-card)' : 'transparent',
                  color: matchday === md ? 'var(--text-1)' : 'var(--text-3)',
                  boxShadow: matchday === md ? 'var(--shadow-sm)' : 'none',
                }}
              >
                Journée {md}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groupMatches.map((m, i) => (
              <MatchCard key={m.id} match={m}
                prediction={predictions[m.id]} confirmed={confirmed.has(m.id)}
                delay={i * 55}
                onIncrement={(s, d) => setPrediction(m.id, s, d)}
                onConfirm={() => confirm(m.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ══ KNOCKOUT ═════════════════════════════════════════════ */}
      {tab === 'eliminatoires' && (
        <>
          <div style={{
            display: 'flex', gap: 5, overflowX: 'auto',
            paddingBottom: 4, marginBottom: 18, scrollbarWidth: 'none',
          }}>
            {KO_ROUNDS.map(r => (
              <button
                key={r.key}
                onClick={() => setKoRound(r.key)}
                style={{
                  flexShrink: 0, padding: '7px 14px',
                  borderRadius: 20,
                  border: `1px solid ${koRound === r.key ? '#C89B3C' : 'var(--border)'}`,
                  background: koRound === r.key ? 'rgba(200,155,60,0.1)' : 'var(--bg-card)',
                  color: koRound === r.key ? '#A07828' : 'var(--text-2)',
                  fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
                  cursor: 'pointer', transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  boxShadow: koRound === r.key ? 'none' : 'var(--shadow-sm)',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{
            padding: '12px 14px', marginBottom: 18,
            background: 'rgba(200,155,60,0.07)',
            border: '1px solid rgba(200,155,60,0.2)',
            borderRadius: 12,
            fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
          }}>
            Les équipes qualifiées seront révélées après la phase de groupes.
            Vos pronostics seront verrouillés au coup d'envoi.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {koMatches.map((m, i) => (
              <MatchCard key={m.id} match={m}
                prediction={predictions[m.id]} confirmed={confirmed.has(m.id)}
                delay={i * 45}
                onIncrement={(s, d) => setPrediction(m.id, s, d)}
                onConfirm={() => confirm(m.id)}
              />
            ))}
          </div>
        </>
      )}
    </PageLayout>
  )
}

// ─── GroupPill ────────────────────────────────────────────────────────────
function GroupPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, width: 34, height: 34,
      borderRadius: 9,
      border: `1px solid ${active ? '#C89B3C' : 'var(--border)'}`,
      background: active ? 'rgba(200,155,60,0.1)' : 'var(--bg-card)',
      color: active ? '#A07828' : 'var(--text-2)',
      fontFamily: "'Bebas Neue', cursive",
      fontSize: 16, letterSpacing: 1,
      cursor: 'pointer', transition: 'all 0.15s',
      boxShadow: active ? 'none' : 'var(--shadow-sm)',
    }}>
      {label}
    </button>
  )
}

// ─── GroupBanner ──────────────────────────────────────────────────────────
function GroupBanner({ group }: { group: string }) {
  const teams = GROUPS[group]
  if (!teams) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 14px', marginBottom: 16,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      boxShadow: 'var(--shadow-sm)',
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      <span style={{
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 13, letterSpacing: 2,
        color: '#A07828', flexShrink: 0,
      }}>
        GRP {group}
      </span>
      <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
      {teams.map((team, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <img
            src={`https://flagcdn.com/w40/${team.code}.png`}
            alt={team.name}
            style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover', border: '1px solid var(--border)' }}
          />
          <span style={{ fontSize: 10, color: 'var(--text-2)', fontWeight: 600, letterSpacing: 0.4 }}>
            {team.short}
          </span>
          {i < 3 && <span style={{ color: 'var(--text-3)', fontSize: 10 }}>·</span>}
        </div>
      ))}
    </div>
  )
}

// ─── MatchCard ────────────────────────────────────────────────────────────
interface MatchCardProps {
  match: Match; prediction?: { home: number; away: number }
  confirmed: boolean; delay: number
  onIncrement: (side: 'home' | 'away', delta: number) => void
  onConfirm: () => void
}

function MatchCard({ match, prediction, confirmed, delay, onIncrement, onConfirm }: MatchCardProps) {
  const pred  = prediction ?? { home: 0, away: 0 }
  const isTBD = match.home.code === 'un'

  return (
    <div style={{
      borderRadius: 16,
      overflow: 'hidden',
      background: 'var(--bg-card)',
      border: confirmed ? '1px solid rgba(200,155,60,0.5)' : '1px solid var(--border)',
      boxShadow: confirmed ? '0 4px 20px rgba(200,155,60,0.12), var(--shadow)' : 'var(--shadow)',
      animation: `fadeSlideUp .3s cubic-bezier(0.4,0,0.2,1) ${delay}ms both`,
      transition: 'border-color 0.22s, box-shadow 0.22s',
    }}>
      {/* Gold accent bar (confirmed) */}
      {confirmed && (
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg,transparent,#C89B3C 20%,#E8D080 50%,#C89B3C 80%,transparent)',
        }} />
      )}

      {/* Meta row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px 0',
        fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
        color: 'var(--text-3)', textTransform: 'uppercase',
      }}>
        <span>
          {match.round === 'group'
            ? `Groupe ${match.group} · J${match.matchday}`
            : KO_LABELS[match.round as string] ?? match.group}
        </span>
        <span>{match.date} · {match.time}</span>
      </div>

      {/* Venue */}
      <div style={{
        textAlign: 'center', fontSize: 9, color: 'var(--text-3)',
        letterSpacing: 0.5, marginBottom: 12, padding: '3px 16px 0',
      }}>
        {match.venue} · {match.city}
      </div>

      {/* Teams + score */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center', padding: '0 14px 14px', gap: 8,
      }}>
        <TeamBlock team={match.home} align="left" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ScoreControl
            value={pred.home} disabled={isTBD || confirmed}
            onUp={() => onIncrement('home', 1)} onDown={() => onIncrement('home', -1)}
          />
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 24, color: 'var(--text-3)',
            letterSpacing: 2, userSelect: 'none',
          }}>:</span>
          <ScoreControl
            value={pred.away} disabled={isTBD || confirmed}
            onUp={() => onIncrement('away', 1)} onDown={() => onIncrement('away', -1)}
          />
        </div>
        <TeamBlock team={match.away} align="right" />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
          <span style={{ color: '#A07828', fontWeight: 700 }}>+3</span> score exact
          &nbsp;·&nbsp;
          <span style={{ color: 'rgba(160,120,40,0.7)', fontWeight: 600 }}>+1</span> bon résultat
        </div>

        {!isTBD && (
          confirmed ? (
            <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>
              ✓ Enregistré
            </div>
          ) : (
            <button
              onClick={onConfirm}
              style={{
                padding: '6px 14px',
                background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
                border: 'none', borderRadius: 8,
                color: '#0D0800', fontSize: 11, fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(200,155,60,0.35)',
                transition: 'transform 0.1s',
              }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
              onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Confirmer
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ─── TeamBlock ────────────────────────────────────────────────────────────
function TeamBlock({ team, align }: { team: import('../data/wc2026Matches').Team; align: 'left' | 'right' }) {
  const isTBD = team.code === 'un'
  return (
    <div style={{
      display: 'flex',
      flexDirection: align === 'left' ? 'row' : 'row-reverse',
      alignItems: 'center', gap: 8,
    }}>
      {isTBD ? (
        <div style={{
          width: 34, height: 23, borderRadius: 4,
          background: 'var(--bg-fill)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: 'var(--text-3)', fontWeight: 700,
        }}>TBD</div>
      ) : (
        <img
          src={`https://flagcdn.com/w40/${team.code}.png`}
          alt={team.name}
          style={{
            width: 34, height: 23, objectFit: 'cover',
            borderRadius: 4, border: '1px solid var(--border)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        />
      )}
      <div style={{ textAlign: align }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 15, letterSpacing: 1.5,
          color: isTBD ? 'var(--text-3)' : 'var(--text-1)', lineHeight: 1,
        }}>
          {isTBD ? '???' : team.short}
        </div>
        <div style={{ fontSize: 8, color: 'var(--text-3)', letterSpacing: 0.3, marginTop: 2 }}>
          {isTBD ? 'À déterminer' : team.name}
        </div>
      </div>
    </div>
  )
}

// ─── ScoreControl ─────────────────────────────────────────────────────────
function ScoreControl({
  value, disabled, onUp, onDown,
}: { value: number; disabled: boolean; onUp: () => void; onDown: () => void }) {
  const btn: React.CSSProperties = {
    width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-fill)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-2)',
    fontSize: 16, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    lineHeight: 1, padding: 0,
    userSelect: 'none',
    opacity: disabled ? 0.3 : 1,
    transition: 'background 0.1s',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button style={btn} onClick={disabled ? undefined : onUp}
        onPointerDown={e => { if (!disabled) (e.currentTarget.style.background = 'rgba(200,155,60,0.15)') }}
        onPointerUp={e   => { if (!disabled) (e.currentTarget.style.background = 'var(--bg-fill)') }}
      >+</button>
      <div style={{
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 30, color: 'var(--text-1)', lineHeight: 1,
        minWidth: 26, textAlign: 'center',
      }}>
        {value}
      </div>
      <button style={btn} onClick={disabled ? undefined : onDown}
        onPointerDown={e => { if (!disabled) (e.currentTarget.style.background = 'rgba(200,155,60,0.15)') }}
        onPointerUp={e   => { if (!disabled) (e.currentTarget.style.background = 'var(--bg-fill)') }}
      >−</button>
    </div>
  )
}

const KO_LABELS: Record<string, string> = {
  r32: 'Huitièmes', r16: 'Quarts', qf: 'Demi-finales',
  sf: 'Demi-finales', '3rd': '3e place', final: 'Finale',
}
