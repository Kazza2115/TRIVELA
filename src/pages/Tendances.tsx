import { useState, useEffect, useMemo, useCallback } from 'react'
import PageLayout from './PageLayout'
import TrendBar, { trendPercents } from '../components/TrendBar'
import { GROUP_MATCHES, knockoutWithTeams, matchKickoffUTC, teamByShort } from '../data/wc2026Matches'
import type { Match } from '../data/wc2026Matches'
import {
  getMatchTrends, getMatchOdds, getMatchPlayerBets, getKnockoutTeams,
} from '../services/auth'
import type { UserProfile, MatchTrend, MatchOdds, PlayerBet, KnockoutTeamRow } from '../services/auth'
import { pointsBadge, ptsLabel } from '../utils/pointsBadge'

const KO_LABELS: Record<string, string> = {
  r32: 'Tour des 32', r16: 'Huitièmes', qf: 'Quarts', sf: 'Demi-finales', '3rd': '3e place', final: 'Finale',
}

// Matchs sélectionnables : phase de groupes + éliminatoires, ces dernières avec leurs vraies
// équipes injectées depuis le bracket (knockout_teams). On ne garde que les affiches dont les
// deux équipes sont connues (les KO restent TBD tant que le bracket ne les a pas remplies).
function selectableMatches(koTeams: Record<string, KnockoutTeamRow>): Match[] {
  const assign = Object.fromEntries(
    Object.entries(koTeams).map(([id, r]) => [id, { home_short: r.home_short, away_short: r.away_short }]),
  )
  return [...GROUP_MATCHES, ...knockoutWithTeams(assign)]
    .filter(m => m.home.code !== 'un' && m.away.code !== 'un')
    .sort((a, b) => (matchKickoffUTC(a) ?? 0) - (matchKickoffUTC(b) ?? 0))
}

function fmtDateTime(m: Match): string {
  const k = matchKickoffUTC(m)
  if (k == null) return ''
  return new Date(k).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich',
  })
}

function stageLabel(m: Match): string {
  return m.round === 'group' ? `Groupe ${m.group} · J${m.matchday}` : KO_LABELS[m.round as string] ?? m.group
}

export default function Tendances({ onBack, focusMatchId, currentUser }: {
  onBack: () => void
  focusMatchId?: string | null
  currentUser: UserProfile | null
}) {
  // Bracket éliminatoire : on charge les affectations d'équipes pour faire apparaître les KO.
  const [koTeams, setKoTeams] = useState<Record<string, KnockoutTeamRow>>({})
  useEffect(() => {
    let alive = true
    const load = () => getKnockoutTeams().then(t => { if (alive) setKoTeams(t) }).catch(() => {})
    load()
    const iv = setInterval(load, 60000)
    return () => { alive = false; clearInterval(iv) }
  }, [])
  const matches = useMemo(() => selectableMatches(koTeams), [koTeams])

  // Sélection par défaut : le match demandé, sinon le plus proche (en cours / à venir), sinon le dernier.
  const defaultId = useMemo(() => {
    if (focusMatchId && matches.some(m => m.id === focusMatchId)) return focusMatchId
    const now = Date.now()
    const withK = matches.map(m => ({ id: m.id, k: matchKickoffUTC(m) ?? 0 }))
    const live = withK.find(x => now >= x.k - 5 * 60000 && now < x.k + 135 * 60000)
    const upcoming = withK.filter(x => x.k >= now).sort((a, b) => a.k - b.k)[0]
    const lastPast = [...withK].sort((a, b) => b.k - a.k)[0]
    return (live ?? upcoming ?? lastPast)?.id ?? matches[0]?.id ?? ''
  }, [focusMatchId, matches])

  const [selectedId, setSelectedId] = useState(defaultId)
  useEffect(() => { setSelectedId(defaultId) }, [defaultId])

  const [pickerOpen, setPickerOpen] = useState(false)
  const [trends, setTrends] = useState<Record<string, MatchTrend>>({})
  const [odds, setOdds] = useState<Record<string, MatchOdds>>({})
  const [playerBets, setPlayerBets] = useState<PlayerBet[]>([])
  const [loadingBets, setLoadingBets] = useState(false)

  // Agrégats globaux (tendance + cotes) — rafraîchis périodiquement.
  useEffect(() => {
    const load = () => {
      getMatchTrends().then(setTrends).catch(() => {})
      getMatchOdds().then(setOdds).catch(() => {})
    }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [])

  // Détail des pronos du match sélectionné (rechargé à chaque changement de match).
  const loadBets = useCallback(() => {
    if (!selectedId) return
    setLoadingBets(true)
    getMatchPlayerBets(selectedId)
      .then(setPlayerBets)
      .catch(() => setPlayerBets([]))
      .finally(() => setLoadingBets(false))
  }, [selectedId])
  useEffect(() => { loadBets() }, [loadBets])

  const match = matches.find(m => m.id === selectedId)
  const trend = trends[selectedId]
  const odd = odds[selectedId]
  const kickoff = match ? matchKickoffUTC(match) : null
  const started = kickoff != null && Date.now() >= kickoff

  const gold = '#C89B3C'

  return (
    <PageLayout onBack={onBack} accentColor={gold} flag="📊" title="TENDANCES"
      subtitle="Pronostics Trivela & cotes bookmakers">

      {/* ── Sélecteur de match ─────────────────────────────────── */}
      <div style={{ position: 'relative', marginBottom: 18 }}>
        <button onClick={() => setPickerOpen(o => !o)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
          background: 'var(--bg-card)', border: `1px solid ${pickerOpen ? gold : 'var(--border)'}`,
          boxShadow: 'var(--shadow-sm)', textAlign: 'left',
        }}>
          {match ? (
            <>
              <MatchFlags match={match} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', letterSpacing: 0.3 }}>
                  {match.home.short} – {match.away.short}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                  {stageLabel(match)} · {fmtDateTime(match)}
                </div>
              </div>
            </>
          ) : <span style={{ color: 'var(--text-3)' }}>Choisir un match</span>}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, transform: pickerOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {pickerOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
            maxHeight: 340, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)', padding: 6,
          }}>
            {matches.map(m => {
              const on = m.id === selectedId
              return (
                <button key={m.id} onClick={() => { setSelectedId(m.id); setPickerOpen(false) }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  background: on ? 'rgba(200,155,60,0.12)' : 'transparent',
                  border: `1px solid ${on ? 'rgba(200,155,60,0.3)' : 'transparent'}`,
                }}>
                  <MatchFlags match={m} small />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: on ? gold : 'var(--text-1)' }}>
                      {m.home.short} – {m.away.short}
                    </span>
                    <span style={{ display: 'block', fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>
                      {stageLabel(m)} · {fmtDateTime(m)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {match && (
        <>
          {/* ── Tendance TRIVELA ───────────────────────────────── */}
          <Section title="🏆 Tendance Trivela" subtitle="Ce que pronostiquent les joueurs Trivela">
            <TrendBar
              homeTeam={match.home} awayTeam={match.away}
              home={trend?.homeWin ?? 0} draw={trend?.draw ?? 0} away={trend?.awayWin ?? 0}
              total={trend?.total ?? 0}
              emptyHint="Aucun pronostic Trivela pour ce match (encore)."
            />
          </Section>

          {/* ── Tendance mondiale (bookmakers) ─────────────────── */}
          <Section title="🌍 Tendance mondiale"
            subtitle={odd ? `Consensus de ${odd.bookmakers} bookmaker${odd.bookmakers > 1 ? 's' : ''}` : 'Cotes des bookmakers'}>
            {odd ? (
              <TrendBar
                homeTeam={match.home} awayTeam={match.away}
                home={odd.homePct} draw={odd.drawPct} away={odd.awayPct}
              />
            ) : (
              <div style={{
                fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6,
                padding: '10px 12px', borderRadius: 10, background: 'var(--bg-fill)',
                border: '1px dashed var(--border)',
              }}>
                Cotes bookmakers bientôt disponibles pour ce match.
              </div>
            )}
          </Section>

          {/* ── Pronostic des joueurs (menu déroulant) ─────────── */}
          <PlayerPronos
            match={match} started={started} loading={loadingBets}
            bets={playerBets} trend={trend} currentUserId={currentUser?.id ?? null}
            onReload={loadBets}
          />
        </>
      )}
    </PageLayout>
  )
}

// ─── Drapeaux d'un match (home vs away) ────────────────────────────────────
function MatchFlags({ match, small }: { match: Match; small?: boolean }) {
  const w = small ? 22 : 28
  const h = Math.round(w * 0.67)
  const img = (code: string) => (
    <img src={`https://flagcdn.com/w40/${code}.png`} alt="" style={{
      width: w, height: h, borderRadius: 3, objectFit: 'cover', border: '1px solid var(--border)',
    }} />
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      {img(match.home.code)}{img(match.away.code)}
    </div>
  )
}

// ─── Bloc de section avec titre ────────────────────────────────────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 14, padding: '14px 16px', borderRadius: 16,
      background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 1.5, color: 'var(--text-1)' }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

// ─── Pronostic des joueurs — groupé par issue (révélé au coup d'envoi) ──────
type Outcome = 'home' | 'draw' | 'away'

function PlayerPronos({ match, started, loading, bets, trend, currentUserId, onReload }: {
  match: Match; started: boolean; loading: boolean; bets: PlayerBet[]
  trend?: MatchTrend; currentUserId: string | null; onReload: () => void
}) {
  const [open, setOpen] = useState(true)
  const gold = '#C89B3C'

  // Regroupe les pronos révélés par issue.
  const groups = useMemo(() => {
    const g: Record<Outcome, PlayerBet[]> = { home: [], draw: [], away: [] }
    for (const b of bets) {
      if (!b.revealed || b.homeScore == null || b.awayScore == null) continue
      const o: Outcome = b.homeScore > b.awayScore ? 'home' : b.homeScore < b.awayScore ? 'away' : 'draw'
      g[o].push(b)
    }
    const bySort = (a: PlayerBet, b: PlayerBet) =>
      (b.points ?? -1) - (a.points ?? -1) || a.pseudo.localeCompare(b.pseudo, 'fr', { sensitivity: 'base' })
    g.home.sort(bySort); g.draw.sort(bySort); g.away.sort(bySort)
    return g
  }, [bets])

  const total = trend?.total ?? bets.length
  const pctOf = trendPercents(trend?.homeWin ?? 0, trend?.draw ?? 0, trend?.awayWin ?? 0)

  return (
    <div style={{
      marginBottom: 14, borderRadius: 16, overflow: 'hidden',
      background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', cursor: 'pointer', background: 'transparent', border: 'none', textAlign: 'left',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 1.5, color: 'var(--text-1)' }}>
            👥 Pronostic des joueurs
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
            {total} prono{total > 1 ? 's' : ''}{started ? ' · groupés par issue' : ' · révélés au coup d\'envoi'}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: '0 14px 16px' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 2px' }}>Chargement…</div>
          ) : !started ? (
            // Avant le coup d'envoi : on ne dévoile PAS qui a pronostiqué quoi (anti-copie).
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px', borderRadius: 12,
              background: 'var(--bg-fill)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
                Les pronostics détaillés de chaque joueur seront <b>révélés au coup d'envoi</b>.<br />
                <span style={{ color: 'var(--text-3)' }}>
                  Pour l'instant : {total} joueur{total > 1 ? 's ont' : ' a'} pronostiqué
                  {pctOf.leader && ` · tendance ${pctOf[pctOf.leader]}%`}.
                </span>
              </div>
            </div>
          ) : total === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 2px', fontStyle: 'italic' }}>
              Aucun pronostic pour ce match.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <OutcomeColumn label={match.home.name} flag={match.home.code}
                bets={groups.home} currentUserId={currentUserId} accent="#16a34a" />
              <OutcomeColumn label="Match nul" flag={null} showQualifier
                bets={groups.draw} currentUserId={currentUserId} accent="#CA8A04" />
              <OutcomeColumn label={match.away.name} flag={match.away.code}
                bets={groups.away} currentUserId={currentUserId} accent="#dc2626" />
            </div>
          )}

          {started && !loading && (
            <button onClick={onReload} style={{
              marginTop: 12, width: '100%', padding: '7px 0', borderRadius: 9, cursor: 'pointer',
              background: 'var(--bg-fill)', border: '1px solid var(--border)',
              color: 'var(--text-3)', fontSize: 11, fontWeight: 600,
            }}>↻ Rafraîchir</button>
          )}
          <div style={{ marginTop: 10, fontSize: 9, color: 'var(--text-3)', textAlign: 'center', letterSpacing: 0.3 }}>
            Tendance Trivela accentuée en <span style={{ color: gold, fontWeight: 700 }}>or</span> ·
            ton pronostic est surligné.
          </div>
        </div>
      )}
    </div>
  )
}

// Colonne d'une issue : libellé (drapeau + nom) + liste des joueurs ayant pronostiqué cette issue.
function OutcomeColumn({ label, flag, bets, currentUserId, accent, showQualifier }: {
  label: string; flag: string | null; bets: PlayerBet[]
  currentUserId: string | null; accent: string; showQualifier?: boolean
}) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        background: 'var(--bg-fill)', borderLeft: `3px solid ${accent}`,
      }}>
        {flag
          ? <img src={`https://flagcdn.com/w40/${flag}.png`} alt="" style={{ width: 24, height: 16, borderRadius: 3, objectFit: 'cover', border: '1px solid var(--border)' }} />
          : <span style={{ fontSize: 16 }}>🤝</span>}
        <span style={{ flex: 1, fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{label}</span>
        <span style={{
          fontSize: 11, fontWeight: 800, color: accent,
          background: 'var(--bg-card)', border: `1px solid ${accent}55`, borderRadius: 999, padding: '2px 9px',
        }}>{bets.length}</span>
      </div>
      {bets.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '8px 12px', fontStyle: 'italic' }}>
          Aucun joueur
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {bets.map((b, i) => {
            const me = b.userId === currentUserId
            return (
              <div key={b.userId} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                background: me ? 'rgba(200,155,60,0.10)' : 'transparent',
              }}>
                <img src={`https://flagcdn.com/w20/${b.countryCode}.png`} alt="" style={{
                  width: 18, height: 12, borderRadius: 2, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0,
                }} />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 12, fontWeight: me ? 800 : 600,
                  color: me ? '#A07828' : 'var(--text-1)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{b.pseudo}{me ? ' (toi)' : ''}</span>
                <span style={{
                  fontFamily: "'Bebas Neue', cursive", fontSize: 15, letterSpacing: 1,
                  color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums',
                }}>{b.homeScore}–{b.awayScore}</span>
                {showQualifier && b.qualifier && (() => {
                  const qt = teamByShort(b.qualifier)
                  return (
                    <span title={`Qualifié choisi : ${qt?.name ?? b.qualifier}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      fontSize: 10, fontWeight: 800, letterSpacing: 0.3, padding: '1px 7px', borderRadius: 999,
                      color: '#A07828', background: 'rgba(200,155,60,0.12)', border: '1px solid rgba(200,155,60,0.35)',
                    }}>
                      🥅 {qt?.code && <img src={`https://flagcdn.com/w20/${qt.code}.png`} alt="" style={{ width: 15, height: 10, borderRadius: 2, objectFit: 'cover' }} />}
                      {b.qualifier}
                    </span>
                  )
                })()}
                {b.points != null && (() => {
                  const bd = pointsBadge(b.points)
                  return (
                    <span className={bd.className} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 6, ...bd.style }}>
                      {ptsLabel(b.points)}
                    </span>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
