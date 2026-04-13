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
  const [tab,          setTab]          = useState<Tab>('groupes')
  const [activeGroup,  setActiveGroup]  = useState('A')
  const [matchday,     setMatchday]     = useState<1|2|3>(1)
  const [koRound,      setKoRound]      = useState<string>('r32')
  const [predictions,  setPredictions]  = useState<Predictions>({})
  const [confirmed,    setConfirmed]    = useState<Set<string>>(new Set())

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
    // Un pari modifié n'est plus "confirmé"
    setConfirmed(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const confirm = (id: string) => {
    setConfirmed(prev => new Set(prev).add(id))
  }

  // Filtered matches
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
      subtitle="Coupe du Monde 2026 · Faites vos pronostics"
    >
      {/* ── Main tabs ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {(['groupes', 'eliminatoires'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              border: 'none',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all .2s',
              background: tab === t
                ? 'linear-gradient(135deg,#C89B3C,#F0E6D2)'
                : 'rgba(255,255,255,.05)',
              color: tab === t ? '#1a0d00' : 'rgba(255,255,255,.45)',
              boxShadow: tab === t ? '0 4px 18px rgba(200,155,60,.4)' : 'none',
            }}
          >
            {t === 'groupes' ? '⚔ Phase de Groupes' : '🏆 Éliminatoires'}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'groupes' && (
        <>
          {/* Group selector */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8,
            marginBottom: 14,
            scrollbarWidth: 'none',
          }}>
            {Object.keys(GROUPS).map(g => (
              <GroupPill key={g} label={g} active={activeGroup === g} onClick={() => setActiveGroup(g)} />
            ))}
          </div>

          {/* Group standings mini-banner */}
          <GroupBanner group={activeGroup} />

          {/* Matchday tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {([1, 2, 3] as const).map(md => (
              <button
                key={md}
                onClick={() => setMatchday(md)}
                style={{
                  flex: 1, padding: '8px 0',
                  borderRadius: 8,
                  border: `1px solid ${matchday === md ? 'rgba(200,155,60,.6)' : 'rgba(255,255,255,.08)'}`,
                  background: matchday === md ? 'rgba(200,155,60,.12)' : 'rgba(255,255,255,.03)',
                  color: matchday === md ? '#C89B3C' : 'rgba(255,255,255,.4)',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700, fontSize: 11, letterSpacing: 1,
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                JOURNÉE {md}
              </button>
            ))}
          </div>

          {/* Match cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {groupMatches.map((m, i) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predictions[m.id]}
                confirmed={confirmed.has(m.id)}
                delay={i * 80}
                onIncrement={(side, delta) => setPrediction(m.id, side, delta)}
                onConfirm={() => confirm(m.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {tab === 'eliminatoires' && (
        <>
          {/* Round tabs */}
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6,
            marginBottom: 18, scrollbarWidth: 'none',
          }}>
            {KO_ROUNDS.map(r => (
              <button
                key={r.key}
                onClick={() => setKoRound(r.key)}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  borderRadius: 20,
                  border: `1px solid ${koRound === r.key ? 'rgba(200,155,60,.6)' : 'rgba(255,255,255,.08)'}`,
                  background: koRound === r.key ? 'rgba(200,155,60,.14)' : 'rgba(255,255,255,.03)',
                  color: koRound === r.key ? '#C89B3C' : 'rgba(255,255,255,.4)',
                  fontFamily: "'Inter', sans-serif",
                  fontWeight: 700, fontSize: 11, letterSpacing: 1,
                  cursor: 'pointer', transition: 'all .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* KO info banner */}
          <div style={{
            padding: '12px 16px', marginBottom: 18,
            background: 'rgba(200,155,60,.06)',
            border: '1px solid rgba(200,155,60,.18)',
            borderRadius: 12,
            fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.6,
          }}>
            Les équipes qualifiées seront révélées à l'issue de la phase de groupes.
            Pariez dès maintenant — vos pronostics seront verrouillés au coup d'envoi.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {koMatches.map((m, i) => (
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
        width: 36, height: 36,
        borderRadius: 10,
        border: `1px solid ${active ? '#C89B3C' : 'rgba(255,255,255,.1)'}`,
        background: active
          ? 'linear-gradient(135deg,rgba(200,155,60,.3),rgba(200,155,60,.1))'
          : 'rgba(255,255,255,.04)',
        color: active ? '#F0E6D2' : 'rgba(255,255,255,.35)',
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 17, letterSpacing: 1,
        cursor: 'pointer', transition: 'all .15s',
        boxShadow: active ? '0 0 10px rgba(200,155,60,.3)' : 'none',
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
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12,
      overflowX: 'auto', scrollbarWidth: 'none',
    }}>
      <span style={{
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 13, letterSpacing: 2,
        color: 'rgba(200,155,60,.7)',
        flexShrink: 0,
      }}>
        GROUPE {group}
      </span>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)', flexShrink: 0 }} />
      {teams.map((team, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <img
            src={`https://flagcdn.com/w40/${team.code}.png`}
            alt={team.name}
            style={{ width: 22, height: 15, borderRadius: 2, objectFit: 'cover', border: '1px solid rgba(255,255,255,.15)' }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', fontWeight: 600, letterSpacing: .5 }}>
            {team.short}
          </span>
          {i < 3 && <span style={{ color: 'rgba(255,255,255,.15)', fontSize: 10 }}>·</span>}
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
      border: confirmed ? '1px solid rgba(200,155,60,.45)' : '1px solid rgba(255,255,255,.08)',
      background: 'linear-gradient(160deg,rgba(14,26,52,.95),rgba(8,14,28,.98))',
      boxShadow: confirmed ? '0 4px 28px rgba(200,155,60,.14)' : '0 2px 12px rgba(0,0,0,.4)',
      animation: `fadeSlideUp .35s ease ${delay}ms both`,
      transition: 'box-shadow .2s',
    }}>
      {/* Accent line at top */}
      <div style={{
        height: 3,
        background: confirmed
          ? 'linear-gradient(90deg,#C89B3C,#F0E6D2 50%,#C89B3C)'
          : 'linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06))',
      }} />

      {/* Meta row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 6px',
        fontSize: 10, letterSpacing: 1,
        color: 'rgba(255,255,255,.3)',
        fontWeight: 600,
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
        color: 'rgba(255,255,255,.2)', letterSpacing: .8,
        marginBottom: 14,
      }}>
        {match.venue}, {match.city}
      </div>

      {/* Teams + predictor */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '0 16px 16px',
        gap: 8,
      }}>
        {/* Home team */}
        <TeamBlock team={match.home} align="left" />

        {/* Score predictor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ScoreControl
            value={pred.home}
            disabled={isTBD || confirmed}
            onUp={() => onIncrement('home', 1)}
            onDown={() => onIncrement('home', -1)}
          />
          <span style={{
            fontFamily: "'Bebas Neue', cursive",
            fontSize: 28, color: 'rgba(255,255,255,.25)',
            letterSpacing: 2, userSelect: 'none',
          }}>:</span>
          <ScoreControl
            value={pred.away}
            disabled={isTBD || confirmed}
            onUp={() => onIncrement('away', 1)}
            onDown={() => onIncrement('away', -1)}
          />
        </div>

        {/* Away team */}
        <TeamBlock team={match.away} align="right" />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderTop: '1px solid rgba(255,255,255,.05)',
        background: 'rgba(0,0,0,.2)',
      }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', lineHeight: 1.6 }}>
          <span style={{ color: 'rgba(200,155,60,.7)' }}>+3 pts</span> score exact
          &nbsp;·&nbsp;
          <span style={{ color: 'rgba(200,155,60,.5)' }}>+1 pt</span> bon résultat
        </div>

        {!isTBD && (
          confirmed ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: .5,
            }}>
              <span>✓</span> Enregistré
            </div>
          ) : (
            <button
              onClick={onConfirm}
              style={{
                padding: '6px 14px',
                background: 'linear-gradient(135deg,#C89B3C,#F0E6D2)',
                border: 'none', borderRadius: 8,
                color: '#1a0d00', fontSize: 11, fontWeight: 800,
                cursor: 'pointer', letterSpacing: .5,
                fontFamily: "'Inter', sans-serif",
                transition: 'all .15s',
              }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(.96)')}
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
          width: 36, height: 24,
          borderRadius: 4,
          background: 'rgba(255,255,255,.07)',
          border: '1px solid rgba(255,255,255,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: 'rgba(255,255,255,.25)', fontWeight: 700, letterSpacing: .5,
        }}>TBD</div>
      ) : (
        <img
          src={`https://flagcdn.com/w40/${team.code}.png`}
          alt={team.name}
          style={{
            width: 36, height: 24,
            objectFit: 'cover', borderRadius: 4,
            border: '1px solid rgba(255,255,255,.15)',
            boxShadow: '0 2px 8px rgba(0,0,0,.4)',
          }}
        />
      )}
      <div style={{ textAlign: align }}>
        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 15, letterSpacing: 1.5,
          color: isTBD ? 'rgba(255,255,255,.2)' : '#fff',
          lineHeight: 1,
        }}>
          {isTBD ? '???' : team.short}
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,.3)', letterSpacing: .5, marginTop: 2 }}>
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
    background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.1)',
    borderRadius: 8,
    color: 'rgba(255,255,255,.5)',
    fontSize: 16, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'all .12s',
    lineHeight: 1,
    padding: 0,
    userSelect: 'none',
    opacity: disabled ? .35 : 1,
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button style={btnStyle} onClick={disabled ? undefined : onUp}
        onPointerDown={e => { if (!disabled) (e.currentTarget.style.background = 'rgba(200,155,60,.25)') }}
        onPointerUp={e   => { if (!disabled) (e.currentTarget.style.background = 'rgba(255,255,255,.06)') }}
      >+</button>
      <div style={{
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 32, color: '#fff', lineHeight: 1,
        minWidth: 28, textAlign: 'center',
        textShadow: '0 0 12px rgba(200,155,60,.4)',
      }}>
        {value}
      </div>
      <button style={btnStyle} onClick={disabled ? undefined : onDown}
        onPointerDown={e => { if (!disabled) (e.currentTarget.style.background = 'rgba(200,155,60,.25)') }}
        onPointerUp={e   => { if (!disabled) (e.currentTarget.style.background = 'rgba(255,255,255,.06)') }}
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
