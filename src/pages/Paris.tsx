import { useState } from 'react'
import PageLayout from './PageLayout'
import { GROUP_MATCHES, KNOCKOUT_MATCHES, GROUPS } from '../data/wc2026Matches'
import type { Match } from '../data/wc2026Matches'

// ─── Types ────────────────────────────────────────────────────────────────
type Tab = 'groupes' | 'eliminatoires'
type Predictions = Record<string, { home: number; away: number }>

const KO_ROUNDS = [
  { key: 'r32',   label: '8èmes'  },
  { key: 'r16',   label: 'Quarts' },
  { key: 'qf',    label: 'Demies' },
  { key: 'sf',    label: 'Semis'  },
  { key: 'final', label: 'Finale' },
] as const

// ─── Component ───────────────────────────────────────────────────────────
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
      return {
        ...prev,
        [id]: {
          home: side === 'home' ? Math.max(0, cur.home + delta) : cur.home,
          away: side === 'away' ? Math.max(0, cur.away + delta) : cur.away,
        },
      }
    })
    setConfirmed(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const confirm = (id: string) => setConfirmed(prev => new Set(prev).add(id))

  const groupMatches = GROUP_MATCHES.filter(
    m => m.group === activeGroup && m.matchday === matchday,
  )
  const koMatches = KNOCKOUT_MATCHES.filter(m => m.round === koRound)

  return (
    <PageLayout
      onBack={onBack}
      accentColor="#C89B3C"
      flag="🎯"
      title="PARIS"
      subtitle="Coupe du Monde 2026 · Pronostics"
    >
      {/* ── Main tabs ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12, padding: 4,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {(['groupes', 'eliminatoires'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '9px 0',
              borderRadius: 9,
              border: 'none',
              fontFamily: '-apple-system, Inter, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: 0.6,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
              background: tab === t ? 'rgba(200,155,60,0.18)' : 'transparent',
              color: tab === t ? '#E8D080' : 'rgba(245,245,247,0.38)',
              boxShadow: tab === t ? 'inset 0 0 0 1px rgba(200,155,60,0.3)' : 'none',
            }}
          >
            {t === 'groupes' ? 'Phase de Groupes' : 'Éliminatoires'}
          </button>
        ))}
      </div>

      {/* ═══════════ GROUP STAGE ═══════════════════════════════════ */}
      {tab === 'groupes' && (
        <>
          {/* Group selector */}
          <div style={{
            display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4,
            marginBottom: 14, scrollbarWidth: 'none',
          }}>
            {Object.keys(GROUPS).map(g => (
              <GroupPill key={g} label={g} active={activeGroup === g} onClick={() => setActiveGroup(g)} />
            ))}
          </div>

          {/* Group banner */}
          <GroupBanner group={activeGroup} />

          {/* Matchday tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {([1, 2, 3] as const).map(md => (
              <button
                key={md}
                onClick={() => setMatchday(md)}
                style={{
                  flex: 1, padding: '8px 0',
                  borderRadius: 9,
                  border: `1px solid ${matchday === md ? 'rgba(200,155,60,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: matchday === md ? 'rgba(200,155,60,0.1)' : 'transparent',
                  color: matchday === md ? '#C89B3C' : 'rgba(245,245,247,0.38)',
                  fontFamily: '-apple-system, Inter, sans-serif',
                  fontWeight: 600, fontSize: 11, letterSpacing: 0.8,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                J{md}
              </button>
            ))}
          </div>

          {/* Match cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groupMatches.map((m, i) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predictions[m.id]}
                confirmed={confirmed.has(m.id)}
                delay={i * 60}
                onIncrement={(side, delta) => setPrediction(m.id, side, delta)}
                onConfirm={() => confirm(m.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ═══════════ KNOCKOUT ══════════════════════════════════════ */}
      {tab === 'eliminatoires' && (
        <>
          {/* Round tabs */}
          <div style={{
            display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4,
            marginBottom: 18, scrollbarWidth: 'none',
          }}>
            {KO_ROUNDS.map(r => (
              <button
                key={r.key}
                onClick={() => setKoRound(r.key)}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  borderRadius: 20,
                  border: `1px solid ${koRound === r.key ? 'rgba(200,155,60,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: koRound === r.key ? 'rgba(200,155,60,0.1)' : 'transparent',
                  color: koRound === r.key ? '#C89B3C' : 'rgba(245,245,247,0.38)',
                  fontFamily: '-apple-system, Inter, sans-serif',
                  fontWeight: 600, fontSize: 11, letterSpacing: 0.8,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Info banner */}
          <div style={{
            padding: '11px 15px', marginBottom: 18,
            background: 'rgba(200,155,60,0.05)',
            border: '1px solid rgba(200,155,60,0.15)',
            borderRadius: 11,
            fontSize: 11, color: 'rgba(245,245,247,0.42)', lineHeight: 1.6,
            fontFamily: '-apple-system, Inter, sans-serif',
          }}>
            Les équipes qualifiées seront révélées après la phase de groupes.
            Vos pronostics seront verrouillés au coup d'envoi.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {koMatches.map((m, i) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predictions[m.id]}
                confirmed={confirmed.has(m.id)}
                delay={i * 50}
                onIncrement={(side, delta) => setPrediction(m.id, side, delta)}
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
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 34, height: 34,
        borderRadius: 9,
        border: `1px solid ${active ? 'rgba(200,155,60,0.55)' : 'rgba(255,255,255,0.09)'}`,
        background: active ? 'rgba(200,155,60,0.14)' : 'transparent',
        color: active ? '#E8D080' : 'rgba(245,245,247,0.35)',
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 16, letterSpacing: 1,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
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
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 11,
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      <span style={{
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 13, letterSpacing: 2,
        color: 'rgba(200,155,60,0.65)',
        flexShrink: 0,
      }}>
        GRP {group}
      </span>
      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.09)', flexShrink: 0 }} />
      {teams.map((team, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <img
            src={`https://flagcdn.com/w40/${team.code}.png`}
            alt={team.name}
            style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.12)' }}
          />
          <span style={{
            fontSize: 10, color: 'rgba(245,245,247,0.52)',
            fontWeight: 600, letterSpacing: 0.4,
            fontFamily: '-apple-system, Inter, sans-serif',
          }}>
            {team.short}
          </span>
          {i < 3 && <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>·</span>}
        </div>
      ))}
    </div>
  )
}

// ─── MatchCard ────────────────────────────────────────────────────────────
interface MatchCardProps {
  match: Match
  prediction?: { home: number; away: number }
  confirmed: boolean
  delay: number
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
      border: confirmed
        ? '1px solid rgba(200,155,60,0.4)'
        : '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(255,255,255,0.045)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      boxShadow: confirmed
        ? '0 4px 24px rgba(200,155,60,0.1), 0 1px 4px rgba(0,0,0,0.3)'
        : '0 2px 8px rgba(0,0,0,0.25)',
      animation: `fadeSlideUp .3s cubic-bezier(0.4,0,0.2,1) ${delay}ms both`,
      transition: 'border-color 0.25s, box-shadow 0.25s',
    }}>

      {/* Confirmed accent line */}
      {confirmed && (
        <div style={{
          height: 2,
          background: 'linear-gradient(90deg,transparent,#C89B3C 30%,#E8D080 50%,#C89B3C 70%,transparent)',
        }} />
      )}

      {/* Meta */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 4px',
        fontSize: 10, letterSpacing: 0.8,
        color: 'rgba(245,245,247,0.28)',
        fontWeight: 600,
        fontFamily: '-apple-system, Inter, sans-serif',
      }}>
        <span style={{ textTransform: 'uppercase' }}>
          {match.round === 'group'
            ? `Groupe ${match.group} · J${match.matchday}`
            : GROUPS_KO_LABEL[match.round as string] ?? match.group}
        </span>
        <span>{match.date} · {match.time}</span>
      </div>

      {/* Venue */}
      <div style={{
        textAlign: 'center', fontSize: 9,
        color: 'rgba(245,245,247,0.18)', letterSpacing: 0.6,
        marginBottom: 12,
        fontFamily: '-apple-system, Inter, sans-serif',
      }}>
        {match.venue} · {match.city}
      </div>

      {/* Teams + predictor */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '0 14px 14px',
        gap: 8,
      }}>
        <TeamBlock team={match.home} align="left" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <ScoreControl
            value={pred.home}
            disabled={isTBD || confirmed}
            onUp={() => onIncrement('home', 1)}
            onDown={() => onIncrement('home', -1)}
          />
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 26, color: 'rgba(245,245,247,0.2)',
            letterSpacing: 2, userSelect: 'none',
          }}>:</span>
          <ScoreControl
            value={pred.away}
            disabled={isTBD || confirmed}
            onUp={() => onIncrement('away', 1)}
            onDown={() => onIncrement('away', -1)}
          />
        </div>

        <TeamBlock team={match.away} align="right" />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 16px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{
          fontSize: 10, color: 'rgba(245,245,247,0.28)', lineHeight: 1.5,
          fontFamily: '-apple-system, Inter, sans-serif',
        }}>
          <span style={{ color: 'rgba(200,155,60,0.75)' }}>+3</span> score exact
          &nbsp;·&nbsp;
          <span style={{ color: 'rgba(200,155,60,0.5)' }}>+1</span> bon résultat
        </div>

        {!isTBD && (
          confirmed ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 10, color: '#4ade80', fontWeight: 700,
              fontFamily: '-apple-system, Inter, sans-serif',
            }}>
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
                fontFamily: '-apple-system, Inter, sans-serif',
                transition: 'transform 0.12s, opacity 0.12s',
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
      alignItems: 'center',
      gap: 8,
    }}>
      {isTBD ? (
        <div style={{
          width: 34, height: 23,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: 'rgba(245,245,247,0.22)',
          fontWeight: 700, letterSpacing: 0.5,
          fontFamily: '-apple-system, Inter, sans-serif',
        }}>TBD</div>
      ) : (
        <img
          src={`https://flagcdn.com/w40/${team.code}.png`}
          alt={team.name}
          style={{
            width: 34, height: 23,
            objectFit: 'cover', borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        />
      )}
      <div style={{ textAlign: align }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 15, letterSpacing: 1.5,
          color: isTBD ? 'rgba(245,245,247,0.2)' : 'rgba(245,245,247,0.92)',
          lineHeight: 1,
        }}>
          {isTBD ? '???' : team.short}
        </div>
        <div style={{
          fontSize: 8, color: 'rgba(245,245,247,0.28)',
          letterSpacing: 0.4, marginTop: 2,
          fontFamily: '-apple-system, Inter, sans-serif',
        }}>
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
  const btnStyle: React.CSSProperties = {
    width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: 'rgba(245,245,247,0.55)',
    fontSize: 16, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background 0.1s',
    lineHeight: 1, padding: 0,
    userSelect: 'none',
    opacity: disabled ? 0.3 : 1,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button style={btnStyle} onClick={disabled ? undefined : onUp}
        onPointerDown={e => { if (!disabled) (e.currentTarget.style.background = 'rgba(200,155,60,0.2)') }}
        onPointerUp={e   => { if (!disabled) (e.currentTarget.style.background = 'rgba(255,255,255,0.06)') }}
      >+</button>
      <div style={{
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 30, color: 'rgba(245,245,247,0.9)', lineHeight: 1,
        minWidth: 26, textAlign: 'center',
      }}>
        {value}
      </div>
      <button style={btnStyle} onClick={disabled ? undefined : onDown}
        onPointerDown={e => { if (!disabled) (e.currentTarget.style.background = 'rgba(200,155,60,0.2)') }}
        onPointerUp={e   => { if (!disabled) (e.currentTarget.style.background = 'rgba(255,255,255,0.06)') }}
      >−</button>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────
const GROUPS_KO_LABEL: Record<string, string> = {
  r32:   'Huitièmes de finale',
  r16:   'Quarts de finale',
  qf:    'Demi-finales',
  sf:    'Demi-finales',
  '3rd': 'Troisième place',
  final: 'Finale',
}
