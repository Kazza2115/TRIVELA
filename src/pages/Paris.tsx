import { useState, useEffect, useRef, useCallback } from 'react'
import PageLayout from './PageLayout'
import { GROUP_MATCHES, KNOCKOUT_MATCHES, GROUPS } from '../data/wc2026Matches'
import type { Match, Team } from '../data/wc2026Matches'
import { saveBet, saveFavorites, getBets, subscribeToResults, getLive, subscribeToLive } from '../services/auth'
import type { UserProfile, MatchResult, LiveScore } from '../services/auth'

const INPLAY = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'])

type Tab = 'poules' | 'phase' | 'eliminatoires'
type Predictions = Record<string, { home: number; away: number }>

const KO_ROUNDS = [
  { key: 'r32',   label: 'Tour 32' },
  { key: 'r16',   label: '8èmes'   },
  { key: 'qf',    label: 'Quarts'  },
  { key: 'sf',    label: 'Demies'  },
  { key: 'final', label: 'Finale'  },
] as const

const KO_LABELS: Record<string, string> = {
  r32: 'Tour des 32', r16: 'Huitièmes de finale', qf: 'Quarts de finale',
  sf: 'Demi-finales', '3rd': '3e place', final: 'Finale',
}

// ─── Time helpers — stored times are UTC, display in Europe/Zurich ───────────
const FR_MONTHS: Record<string, number> = {
  'Jan': 0, 'Fév': 1, 'Mar': 2, 'Avr': 3, 'Mai': 4, 'Juin': 5,
  'Juil': 6, 'Aoû': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Déc': 11,
}

function parseUTC(dateStr: string, timeStr: string): number | null {
  const parts = dateStr.split(' ')
  const day   = parseInt(parts[0], 10)
  const mon   = FR_MONTHS[parts[1]?.slice(0, 4)]
    ?? FR_MONTHS[parts[1]?.slice(0, 3)]
    ?? -1
  if (isNaN(day) || mon === -1) return null
  const [hh, mm] = timeStr.split(':').map(Number)
  return Date.UTC(2026, mon, day, hh, mm, 0)
}

/** Convert a stored UTC time string to Geneva local time (HH:MM, 24h). */
function toGenevaTime(dateStr: string, timeStr: string): string {
  const utc = parseUTC(dateStr, timeStr)
  if (utc === null) return timeStr
  return new Date(utc).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Zurich',
    hour12: false,
  })
}

/** Bet lockout — 1h30 before kickoff (kickoff stored as UTC). */
function isMatchLocked(match: Match): boolean {
  const utc = parseUTC(match.date, match.time)
  if (utc === null) return false
  return Date.now() >= utc - 90 * 60 * 1000
}

/** Fenêtre « en direct » : du coup d'envoi à +2h15 (tant qu'aucun résultat final). */
const LIVE_MS = 135 * 60 * 1000
function isMatchLive(match: Match, now: number): boolean {
  const utc = parseUTC(match.date, match.time)
  return utc !== null && now >= utc && now < utc + LIVE_MS
}

// ─── Classement d'un groupe (calculé à partir des résultats) ─────────────────
interface StandRow {
  team: Team; played: number; win: number; draw: number; loss: number
  gf: number; ga: number; pts: number
}
function computeStandings(group: string, results: Record<string, MatchResult>): StandRow[] {
  const teams = GROUPS[group] ?? []
  const map = new Map<string, StandRow>()
  teams.forEach(t => map.set(t.short, { team: t, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, pts: 0 }))
  GROUP_MATCHES.filter(m => m.group === group).forEach(m => {
    const r = results[m.id]
    if (!r) return
    const h = map.get(m.home.short), a = map.get(m.away.short)
    if (!h || !a) return
    h.played++; a.played++
    h.gf += r.homeScore; h.ga += r.awayScore
    a.gf += r.awayScore; a.ga += r.homeScore
    if (r.homeScore > r.awayScore)      { h.win++;  h.pts += 3; a.loss++ }
    else if (r.homeScore < r.awayScore) { a.win++;  a.pts += 3; h.loss++ }
    else                                { h.draw++; a.draw++;   h.pts++; a.pts++ }
  })
  return [...map.values()].sort((x, y) =>
    y.pts - x.pts ||
    (y.gf - y.ga) - (x.gf - x.ga) ||
    y.gf - x.gf ||
    x.team.name.localeCompare(y.team.name),
  )
}

/** Les 8 meilleurs 3es (parmi les 12 groupes) qualifiés. Ignore les équipes
 *  n'ayant pas encore joué pour ne pas afficher de faux qualifiés avant le tournoi. */
function bestThirds(results: Record<string, MatchResult>): Set<string> {
  const thirds: StandRow[] = []
  Object.keys(GROUPS).forEach(g => {
    const row = computeStandings(g, results)[2]
    if (row && row.played > 0) thirds.push(row)
  })
  thirds.sort((a, b) =>
    b.pts - a.pts ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    a.team.name.localeCompare(b.team.name),
  )
  return new Set(thirds.slice(0, 8).map(r => r.team.short))
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function Paris({ onBack, currentUser, onOpenAuth }: {
  onBack: () => void
  currentUser: UserProfile | null
  onOpenAuth: () => void
}) {
  const [tab,         setTab]         = useState<Tab>('phase')
  const [koRound,     setKoRound]     = useState<string>('r32')
  const [predictions, setPredictions] = useState<Predictions>({})
  const [confirmed,   setConfirmed]   = useState<Set<string>>(new Set())
  const [lockErrors,  setLockErrors]  = useState<Record<string, string>>({})
  const [favorites,   setFavorites]   = useState<string[]>([])
  const [results, setResults] = useState<Record<string, MatchResult>>({})

  // Sync all user-specific state on login/logout
  useEffect(() => {
    setFavorites(currentUser?.favorites ?? [])
    if (!currentUser) {
      setPredictions({})
      setConfirmed(new Set())
      return
    }
    getBets(currentUser.id).then(bets => {
      const preds: Predictions = {}
      const conf = new Set<string>()
      bets.forEach(b => {
        preds[b.matchId] = { home: b.homeScore, away: b.awayScore }
        conf.add(b.matchId)
      })
      setPredictions(preds)
      setConfirmed(conf)
    })
  }, [currentUser])

  useEffect(() => subscribeToResults(arr => {
    const map: Record<string, MatchResult> = {}
    arr.forEach(r => { map[r.matchId] = r })
    setResults(map)
  }), [])

  // Horloge — rafraîchit l'état "en direct / terminé" des matchs
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // Scores en direct + détection des buts (→ flamme sur l'équipe qui marque)
  const [live, setLive] = useState<Record<string, LiveScore>>({})
  const [goalFlash, setGoalFlash] = useState<Record<string, 'home' | 'away'>>({})
  const prevLive = useRef<Record<string, LiveScore>>({})

  const loadLive = useCallback(async () => {
    const arr = await getLive()
    const map: Record<string, LiveScore> = {}
    arr.forEach(l => { map[l.matchId] = l })
    const prev = prevLive.current
    for (const l of arr) {
      const p = prev[l.matchId]
      if (!p) continue
      const side: 'home' | 'away' | null =
        l.homeScore > p.homeScore ? 'home' : l.awayScore > p.awayScore ? 'away' : null
      if (side) {
        setGoalFlash(g => ({ ...g, [l.matchId]: side }))
        setTimeout(() => setGoalFlash(g => { const n = { ...g }; delete n[l.matchId]; return n }), 8000)
      }
    }
    prevLive.current = map
    setLive(map)
  }, [])

  useEffect(() => {
    loadLive()
    const unsub = subscribeToLive(loadLive)
    return unsub
  }, [loadLive])

  const toggleFavorite = (short: string) => {
    if (!currentUser) { onOpenAuth(); return }
    setFavorites(prev => {
      const next = prev.includes(short) ? prev.filter(s => s !== short) : [...prev, short]
      saveFavorites(currentUser.id, next)
      return next
    })
  }

  const setPrediction = (id: string, side: 'home' | 'away', delta: number) => {
    setPredictions(prev => {
      const cur = prev[id] ?? { home: 0, away: 0 }
      return { ...prev, [id]: {
        home: side === 'home' ? Math.max(0, cur.home + delta) : cur.home,
        away: side === 'away' ? Math.max(0, cur.away + delta) : cur.away,
      }}
    })
    setConfirmed(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const edit = (id: string) => {
    setConfirmed(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const confirm = async (id: string) => {
    if (!currentUser) { onOpenAuth(); return }
    const match = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES].find(m => m.id === id)
    if (!match) return
    const pred = predictions[id] ?? { home: 0, away: 0 }
    const { error } = await saveBet({
      userId: currentUser.id,
      matchId: id,
      home: match.home.name,
      away: match.away.name,
      homeScore: pred.home,
      awayScore: pred.away,
      stage: match.round === 'group'
        ? `Groupe ${match.group} · J${match.matchday}`
        : KO_LABELS[match.round as string] ?? String(match.round),
    })
    if (error) {
      setLockErrors(prev => ({ ...prev, [id]: error }))
      setTimeout(() => setLockErrors(prev => { const s = { ...prev }; delete s[id]; return s }), 3500)
    } else {
      setConfirmed(prev => new Set(prev).add(id))
    }
  }

  const koMatches = KNOCKOUT_MATCHES.filter(m => m.round === koRound)
  const thirdsQualified = bestThirds(results)

  return (
    <PageLayout onBack={onBack} accentColor="#C89B3C" flag="🎯" title="PARIS"
      subtitle="Coupe du Monde 2026 · Pronostics">

      {/* ── Auth gate banner ──────────────────────────────────── */}
      {!currentUser && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(200,155,60,0.07)',
          border: '1px solid rgba(200,155,60,0.3)',
          borderRadius: 14,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A07828', marginBottom: 2 }}>
              Connexion requise
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4 }}>
              Connectez-vous pour enregistrer vos pronostics.
            </div>
          </div>
          <button onClick={onOpenAuth} style={{
            flexShrink: 0, padding: '8px 16px',
            background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
            border: 'none', borderRadius: 10,
            color: '#0D0800', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(200,155,60,0.35)',
            transition: 'transform 0.12s',
          }}
            onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
            onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
          >
            Se connecter
          </button>
        </div>
      )}

      {/* ── Main tabs ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', background: 'var(--bg-fill)',
        borderRadius: 12, padding: 3, marginBottom: 20,
      }}>
        {([['poules', 'Poules'], ['phase', 'Phase de groupe'], ['eliminatoires', 'Éliminatoires']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px 2px', borderRadius: 10, border: 'none',
            fontSize: 11, fontWeight: 600, letterSpacing: 0.2, cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            background: tab === t ? 'var(--bg-card)' : 'transparent',
            color: tab === t ? 'var(--text-1)' : 'var(--text-3)',
            boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ POULES — classements par groupe ══════════════════════ */}
      {tab === 'poules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>V</span> victoires ·
            <span style={{ color: '#CA8A04', fontWeight: 700 }}>N</span> nuls ·
            <span style={{ color: '#dc2626', fontWeight: 700 }}>D</span> défaites.<br />
            Qualifiés : les <span style={{ color: '#A07828', fontWeight: 700 }}>2 premiers</span> de chaque groupe (or)
            + les <span style={{ color: '#5B8DEF', fontWeight: 700 }}>8 meilleurs 3es</span> (bleu).
          </div>
          {Object.keys(GROUPS).map(g => (
            <StandingsTable key={g} group={g} results={results}
              favorites={favorites} onToggleFavorite={toggleFavorite}
              thirdsQualified={thirdsQualified} />
          ))}
        </div>
      )}

      {/* ══ PHASE DE GROUPE — paris triés par journée ════════════ */}
      {tab === 'phase' && (
        <>
          {([1, 2, 3] as const).map(md => {
            const mdMatches = GROUP_MATCHES
              .filter(m => m.matchday === md)
              .sort((a, b) => (parseUTC(a.date, a.time) ?? 0) - (parseUTC(b.date, b.time) ?? 0))
            const dates = [...new Set(mdMatches.map(m => m.date))]
            const dateRange = dates.length > 1 ? `${dates[0]} – ${dates[dates.length - 1]}` : dates[0] ?? ''
            // Regroupe par date (en conservant l'ordre chronologique)
            const byDate: { date: string; matches: Match[] }[] = []
            mdMatches.forEach(m => {
              const last = byDate[byDate.length - 1]
              if (last && last.date === m.date) last.matches.push(m)
              else byDate.push({ date: m.date, matches: [m] })
            })
            return (
              <div key={md} style={{ marginBottom: 26 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  marginBottom: 12, marginTop: md === 1 ? 0 : 6,
                  padding: '9px 14px',
                  background: 'linear-gradient(90deg, rgba(200,155,60,0.10) 0%, rgba(200,155,60,0.03) 100%)',
                  borderLeft: '3px solid #C89B3C',
                  borderRadius: '0 10px 10px 0',
                }}>
                  <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 16, letterSpacing: 2, color: '#A07828' }}>
                    Journée {md}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(200,155,60,0.25)' }} />
                  {dateRange && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-2)', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>
                      {dateRange}
                    </span>
                  )}
                </div>

                {byDate.map(({ date, matches }, di) => (
                  <div key={date} style={{ marginBottom: 16 }}>
                    {/* Séparateur de date — bien visible */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      margin: di === 0 ? '2px 0 12px' : '20px 0 12px',
                      padding: '9px 14px', borderRadius: 12,
                      background: 'var(--bg-fill)',
                      border: '1px solid var(--border)',
                      borderLeft: '4px solid #5B8DEF',
                    }}>
                      <span style={{ fontSize: 16, lineHeight: 1 }}>📅</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', letterSpacing: 0.4 }}>
                        {date}
                      </span>
                      <div style={{ flex: 1 }} />
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--text-2)',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 999, padding: '3px 9px',
                      }}>
                        {matches.length} match{matches.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {matches.map((m, i) => (
                        <MatchCard key={m.id} match={m}
                          prediction={predictions[m.id]} confirmed={confirmed.has(m.id)}
                          lockError={lockErrors[m.id]}
                          result={results[m.id]} now={now}
                          liveData={live[m.id]} goalSide={goalFlash[m.id]}
                          delay={i * 30}
                          onIncrement={(s, d) => setPrediction(m.id, s, d)}
                          onConfirm={() => confirm(m.id)}
                          onEdit={() => edit(m.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
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
              <button key={r.key} onClick={() => setKoRound(r.key)} style={{
                flexShrink: 0, padding: '7px 14px', borderRadius: 20,
                border: `1px solid ${koRound === r.key ? '#C89B3C' : 'var(--border)'}`,
                background: koRound === r.key ? 'rgba(200,155,60,0.1)' : 'var(--bg-card)',
                color: koRound === r.key ? '#A07828' : 'var(--text-2)',
                fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
                cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                boxShadow: koRound === r.key ? 'none' : 'var(--shadow-sm)',
              }}>
                {r.label}
              </button>
            ))}
          </div>

          <div style={{
            padding: '12px 14px', marginBottom: 18,
            background: 'rgba(200,155,60,0.07)',
            border: '1px solid rgba(200,155,60,0.2)',
            borderRadius: 12, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
          }}>
            Les équipes qualifiées seront révélées après la phase de groupes.
            Vos pronostics seront verrouillés au coup d'envoi.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {koMatches.map((m, i) => (
              <MatchCard key={m.id} match={m}
                prediction={predictions[m.id]} confirmed={confirmed.has(m.id)}
                lockError={lockErrors[m.id]}
                result={results[m.id]}
                delay={i * 45}
                onIncrement={(s, d) => setPrediction(m.id, s, d)}
                onConfirm={() => confirm(m.id)}
                onEdit={() => edit(m.id)}
              />
            ))}
          </div>
        </>
      )}
    </PageLayout>
  )
}

// ─── StandingsTable — classement d'un groupe ────────────────────────────────
const STAND_COLS = '20px minmax(96px,1fr) 22px 22px 22px 22px 26px 26px 32px 30px'

function StandingsTable({ group, results, favorites, onToggleFavorite, thirdsQualified }: {
  group: string
  results: Record<string, MatchResult>
  favorites: string[]
  onToggleFavorite: (short: string) => void
  thirdsQualified: Set<string>
}) {
  const rows = computeStandings(group, results)
  const cell: React.CSSProperties = { fontSize: 11, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }
  const head: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textAlign: 'center', letterSpacing: 0.3 }

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 2, color: '#A07828',
      }}>
        Groupe {group}
      </div>

      <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ minWidth: 326 }}>
          {/* En-tête */}
          <div style={{
            display: 'grid', gridTemplateColumns: STAND_COLS, gap: 4, alignItems: 'center',
            padding: '6px 12px', borderBottom: '1px solid var(--border)',
          }}>
            <span style={head}>#</span>
            <span style={{ ...head, textAlign: 'left' }}>Équipe</span>
            <span style={head}>J</span>
            <span style={{ ...head, color: '#16a34a' }}>V</span>
            <span style={{ ...head, color: '#CA8A04' }}>N</span>
            <span style={{ ...head, color: '#dc2626' }}>D</span>
            <span style={head}>BP</span>
            <span style={head}>BC</span>
            <span style={head}>+/-</span>
            <span style={head}>Pts</span>
          </div>

          {/* Lignes */}
          {rows.map((r, i) => {
            const top2 = i < 2
            const thirdQual = i === 2 && thirdsQualified.has(r.team.short)
            const accent = top2 ? '#C89B3C' : thirdQual ? '#5B8DEF' : null
            const diff = r.gf - r.ga
            const isFav = favorites.includes(r.team.short)
            return (
              <div key={r.team.short} style={{
                display: 'grid', gridTemplateColumns: STAND_COLS, gap: 4, alignItems: 'center',
                padding: '8px 12px',
                borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                borderLeft: `3px solid ${accent ?? 'transparent'}`,
                background: top2 ? 'rgba(200,155,60,0.05)' : thirdQual ? 'rgba(91,141,239,0.06)' : 'transparent',
              }}>
                <span style={{ ...cell, fontWeight: 700,
                  color: top2 ? '#A07828' : thirdQual ? '#5B8DEF' : 'var(--text-3)' }}>{i + 1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <button onClick={() => onToggleFavorite(r.team.short)} title="Épingler"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontSize: 11, lineHeight: 1, opacity: isFav ? 1 : 0.22, flexShrink: 0 }}>⭐</button>
                  <img src={`https://flagcdn.com/w40/${r.team.code}.png`} alt={r.team.name}
                    style={{ width: 20, height: 14, borderRadius: 2, objectFit: 'cover', flexShrink: 0,
                      border: '1px solid var(--border)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.team.short}</span>
                </div>
                <span style={{ ...cell, color: 'var(--text-2)' }}>{r.played}</span>
                <span style={{ ...cell, fontWeight: 700, color: '#16a34a' }}>{r.win}</span>
                <span style={{ ...cell, fontWeight: 700, color: '#CA8A04' }}>{r.draw}</span>
                <span style={{ ...cell, fontWeight: 700, color: '#dc2626' }}>{r.loss}</span>
                <span style={{ ...cell, color: 'var(--text-2)' }}>{r.gf}</span>
                <span style={{ ...cell, color: 'var(--text-2)' }}>{r.ga}</span>
                <span style={{ ...cell, color: 'var(--text-2)' }}>{diff > 0 ? `+${diff}` : diff}</span>
                <span style={{ ...cell, fontFamily: "'Bebas Neue', cursive", fontSize: 16, color: '#C89B3C' }}>{r.pts}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── MatchCard ────────────────────────────────────────────────────────────
function calcPoints(result: MatchResult, pred: { home: number; away: number }): number {
  const { homeScore: rH, awayScore: rA } = result
  const { home: pH, away: pA } = pred
  if (rH === pH && rA === pA) return 5
  if (rH > rA && pH > pA) return 3
  if (rH < rA && pH < pA) return 3
  if (rH === rA) return 1   // match nul → +1 pour tout le monde
  return 0
}

interface MatchCardProps {
  match: Match
  prediction?: { home: number; away: number }
  confirmed: boolean
  lockError?: string
  result?: MatchResult
  liveData?: LiveScore
  goalSide?: 'home' | 'away'
  now?: number
  delay: number
  onIncrement: (side: 'home' | 'away', delta: number) => void
  onConfirm: () => void
  onEdit: () => void
}

function MatchCard({ match, prediction, confirmed, lockError, result, liveData, goalSide, now, delay, onIncrement, onConfirm, onEdit }: MatchCardProps) {
  const pred   = prediction ?? { home: 0, away: 0 }
  const isTBD  = match.home.code === 'un'
  const locked = isMatchLocked(match)

  const nowTs      = now ?? Date.now()
  const finished   = !!result
  const reallyLive = !!liveData && INPLAY.has(liveData.status)
  const live       = reallyLive || (!finished && isMatchLive(match, nowTs))
  const showCol    = finished || reallyLive || confirmed
  const homeWin    = (finished && result!.homeScore > result!.awayScore) || (reallyLive && goalSide === 'home')
  const awayWin    = (finished && result!.awayScore > result!.homeScore) || (reallyLive && goalSide === 'away')
  const entry      = `fadeSlideUp .3s cubic-bezier(0.4,0,0.2,1) ${delay}ms both`

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      background: finished ? 'var(--bg-fill)' : 'var(--bg-card)',
      border: live ? '1px solid rgba(220,38,38,0.6)'
        : confirmed && !finished ? '1px solid rgba(200,155,60,0.5)'
        : '1px solid var(--border)',
      boxShadow: live ? 'none'
        : confirmed && !finished ? '0 4px 20px rgba(200,155,60,0.12), var(--shadow)'
        : 'var(--shadow)',
      animation: live ? `${entry}, livePulse 1.6s ease-in-out infinite` : entry,
      transition: 'border-color 0.22s, box-shadow 0.22s, opacity 0.3s, filter 0.3s',
      opacity: finished ? 0.6 : locked ? 0.8 : 1,
      filter: finished ? 'grayscale(0.55)' : 'none',
    }}>
      {confirmed && !locked && (
        <div style={{ height: 3, background: 'linear-gradient(90deg,transparent,#C89B3C 20%,#E8D080 50%,#C89B3C 80%,transparent)' }} />
      )}
      {locked && (
        <div style={{ height: 3, background: 'linear-gradient(90deg,transparent,rgba(110,110,115,0.5) 20%,rgba(174,174,178,0.7) 50%,rgba(110,110,115,0.5) 80%,transparent)' }} />
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
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {live && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              color: '#dc2626', fontWeight: 800, fontSize: 9, letterSpacing: 0.5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626',
                animation: 'liveDot 1s ease-in-out infinite' }} />
              EN DIRECT
            </span>
          )}
          <span>{match.date}</span>
          <span style={{
            background: locked ? 'rgba(110,110,115,0.1)' : 'rgba(200,155,60,0.12)',
            border: `1px solid ${locked ? 'rgba(110,110,115,0.25)' : 'rgba(200,155,60,0.25)'}`,
            borderRadius: 5, padding: '1px 5px',
            color: locked ? 'var(--text-3)' : '#A07828', fontWeight: 700,
            display: 'flex', alignItems: 'baseline', gap: 3,
          }}>
            {toGenevaTime(match.date, match.time)}
            <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.65 }}>GVA</span>
          </span>
        </span>
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
        <TeamBlock team={match.home} align="left" fire={homeWin} />
        {showCol ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 88 }}>
            {/* Score — grand et centré (final, en direct, ou en attente) */}
            <div style={{
              fontFamily: "'Bebas Neue', cursive", fontSize: 30, letterSpacing: 2, lineHeight: 1,
              color: reallyLive ? '#dc2626' : finished ? 'var(--text-1)' : 'var(--text-3)',
              animation: (result || reallyLive) ? 'fadeIn 0.3s ease' : 'none',
            }}>
              {finished ? result!.homeScore : reallyLive ? liveData!.homeScore : '–'}
              <span style={{ color: 'var(--text-3)', margin: '0 4px' }}>:</span>
              {finished ? result!.awayScore : reallyLive ? liveData!.awayScore : '–'}
            </div>
            {/* Minute / EN DIRECT */}
            {reallyLive && (
              <div style={{
                marginTop: 4, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: '#dc2626',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626',
                  animation: 'liveDot 1s ease-in-out infinite' }} />
                {liveData!.elapsed != null ? `${liveData!.elapsed}'` : 'EN DIRECT'}
              </div>
            )}
            {/* Prono — petit, décalé sous le score */}
            {confirmed && (
              <div style={{
                marginTop: 5, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: 'var(--text-3)',
                animation: 'predShrinkDown 0.42s cubic-bezier(0.34,1.15,0.64,1)',
              }}>
                Prono <span style={{ color: 'var(--text-2)' }}>{pred.home}</span>
                <span style={{ opacity: 0.5 }}>–</span>
                <span style={{ color: 'var(--text-2)' }}>{pred.away}</span>
              </div>
            )}
            {confirmed && !result && !reallyLive && (
              <div style={{ marginTop: 2, fontSize: 8, color: 'var(--text-3)', opacity: 0.7, letterSpacing: 0.3 }}>
                en attente du résultat
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ScoreControl value={pred.home} disabled={isTBD || locked}
              onUp={() => onIncrement('home', 1)} onDown={() => onIncrement('home', -1)} />
            <span style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: 24, color: 'var(--text-3)', letterSpacing: 2, userSelect: 'none',
            }}>:</span>
            <ScoreControl value={pred.away} disabled={isTBD || locked}
              onUp={() => onIncrement('away', 1)} onDown={() => onIncrement('away', -1)} />
          </div>
        )}
        <TeamBlock team={match.away} align="right" fire={awayWin} />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {lockError ? (
            <span style={{ color: '#dc2626', fontWeight: 700 }}>🔒 {lockError}</span>
          ) : result ? (
            <span style={{ fontWeight: 700, color: 'var(--text-2)', letterSpacing: 0.3 }}>
              FT&thinsp;
              <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 13, letterSpacing: 1 }}>
                {result.homeScore}–{result.awayScore}
              </span>
            </span>
          ) : (
            <>
              <span style={{ color: '#A07828', fontWeight: 700 }}>+5</span> exact
              &nbsp;·&nbsp;
              <span style={{ color: 'rgba(160,120,40,0.7)', fontWeight: 600 }}>+3</span> bon résultat
              &nbsp;·&nbsp;
              <span style={{ color: 'rgba(160,120,40,0.5)', fontWeight: 600 }}>+1</span> si nul
            </>
          )}
        </div>
        {result && confirmed && prediction ? (() => {
          const pts = calcPoints(result, prediction)
          const colors: Record<number, string> = { 5: '#22c55e', 3: '#A07828', 1: '#6b7280', 0: '#dc2626' }
          return (
            <div style={{
              padding: '4px 10px', borderRadius: 8,
              background: pts === 5 ? 'rgba(34,197,94,0.12)' : pts === 3 ? 'rgba(200,155,60,0.12)' : 'rgba(110,110,115,0.1)',
              border: `1px solid ${pts > 0 ? (pts === 5 ? 'rgba(34,197,94,0.3)' : 'rgba(200,155,60,0.3)') : 'rgba(110,110,115,0.2)'}`,
              fontSize: 12, fontWeight: 700, color: colors[pts] ?? 'var(--text-3)',
            }}>
              {pts > 0 ? '+' : ''}{pts} pts
            </div>
          )
        })() : result ? (
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>terminé</div>
        ) : locked ? (
          <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 700, letterSpacing: 0.5 }}>
            🔒 Verrouillé
          </div>
        ) : !isTBD && (
          confirmed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓ Enregistré</div>
              <button onClick={onEdit} style={{
                padding: '5px 12px',
                background: 'var(--bg-fill)',
                border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text-2)', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', transition: 'opacity 0.1s',
              }}
                onPointerDown={e => (e.currentTarget.style.opacity = '0.5')}
                onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
              >
                Modifier
              </button>
            </div>
          ) : (
            <button onClick={onConfirm} style={{
              padding: '6px 14px',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              border: 'none', borderRadius: 8,
              color: '#0D0800', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(200,155,60,0.35)',
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
function TeamBlock({ team, align, fire }: { team: Team; align: 'left' | 'right'; fire?: boolean }) {
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
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={`https://flagcdn.com/w40/${team.code}.png`} alt={team.name}
            style={{
              width: 34, height: 23, objectFit: 'cover',
              borderRadius: 4, border: `1px solid ${fire ? 'rgba(245,130,30,0.8)' : 'var(--border)'}`,
              boxShadow: fire ? '0 0 10px rgba(245,130,30,0.6)' : '0 1px 4px rgba(0,0,0,0.1)',
            }} />
          {fire && (
            <span style={{
              position: 'absolute', top: -10, right: -7, fontSize: 15, lineHeight: 1,
              filter: 'drop-shadow(0 0 3px rgba(245,130,30,0.7))',
              animation: 'flameFlicker 0.7s ease-in-out infinite',
            }}>🔥</span>
          )}
        </div>
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
function ScoreControl({ value, disabled, onUp, onDown }:
  { value: number; disabled: boolean; onUp: () => void; onDown: () => void }) {
  const btn: React.CSSProperties = {
    width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-fill)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text-2)',
    fontSize: 16, fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    lineHeight: 1, padding: 0, userSelect: 'none',
    opacity: disabled ? 0.3 : 1, transition: 'background 0.1s',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button style={btn} onClick={disabled ? undefined : onUp}
        onPointerDown={e => { if (!disabled) e.currentTarget.style.background = 'rgba(200,155,60,0.15)' }}
        onPointerUp={e   => { if (!disabled) e.currentTarget.style.background = 'var(--bg-fill)' }}
      >+</button>
      <div style={{
        fontFamily: "'Bebas Neue', cursive",
        fontSize: 30, color: 'var(--text-1)', lineHeight: 1,
        minWidth: 26, textAlign: 'center',
      }}>
        {value}
      </div>
      <button style={btn} onClick={disabled ? undefined : onDown}
        onPointerDown={e => { if (!disabled) e.currentTarget.style.background = 'rgba(200,155,60,0.15)' }}
        onPointerUp={e   => { if (!disabled) e.currentTarget.style.background = 'var(--bg-fill)' }}
      >−</button>
    </div>
  )
}
