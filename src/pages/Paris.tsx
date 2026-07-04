import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import PageLayout from './PageLayout'
import { GROUP_MATCHES, GROUPS, ALL_MATCHES, matchKickoffUTC, knockoutWithTeams, applySchedule } from '../data/wc2026Matches'
import { pointsBadge, ptsLabel } from '../utils/pointsBadge'
import type { Match, Team } from '../data/wc2026Matches'
import { saveBet, saveFavorites, getBets, subscribeToResults, getResults, getLive, subscribeToLive, getMatchGoals, getMatchCards, subscribeToMatchGoals, getMatchTrends, getKnockoutTeams, getMatchSchedule, getMatchPlayerBets } from '../services/auth'
import type { KnockoutTeamRow, PlayerBet } from '../services/auth'
import type { UserProfile, MatchResult, LiveScore, Scorer, RedCard, MatchTrend } from '../services/auth'
import { track } from '../services/analytics'
import TrendBar from '../components/TrendBar'

const INPLAY = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP'])

type Tab = 'poules' | 'phase' | 'eliminatoires'
type Predictions = Record<string, { home: number; away: number }>

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

// Date d'un match EN HEURE DE GENÈVE (ex. « 15 Juin »). Les horaires sont stockés
// en UTC ; un match à 23:00 UTC le 14 est en réalité le 15 à 01:00 à Genève → on
// doit afficher la date locale, sinon elle ne colle pas avec l'heure affichée.
const FR_MONTHS_CAP = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
function toGenevaDate(dateStr: string, timeStr: string): string {
  const utc = parseUTC(dateStr, timeStr)
  if (utc === null) return dateStr
  const iso = new Date(utc).toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' }) // "2026-06-15"
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${FR_MONTHS_CAP[m - 1] ?? ''}`.trim()
}

/** Bet lockout — 30 min before kickoff (kickoff stored as UTC). */
function isMatchLocked(match: Match): boolean {
  const utc = parseUTC(match.date, match.time)
  if (utc === null) return false
  return Date.now() >= utc - 30 * 60 * 1000
}

/** Fenêtre « en direct » : du coup d'envoi à +2h15 (tant qu'aucun résultat final). */
const LIVE_MS = 135 * 60 * 1000
const KICKOFF_MS = new Map<string, number | null>(ALL_MATCHES.map(m => [m.id, matchKickoffUTC(m)]))
function inLiveWindow(id: string, now: number): boolean {
  const k = KICKOFF_MS.get(id)
  return k != null && now >= k && now < k + LIVE_MS
}

// Cache local des scores live → réaffiche le dernier score immédiatement au rechargement
const LIVE_CACHE_KEY = 'trivela-live'
function loadCachedLive(): Record<string, LiveScore> {
  try {
    const obj = JSON.parse(localStorage.getItem(LIVE_CACHE_KEY) || '{}') as Record<string, LiveScore>
    const now = Date.now()
    const out: Record<string, LiveScore> = {}
    for (const [id, l] of Object.entries(obj)) if (inLiveWindow(id, now)) out[id] = l
    return out
  } catch { return {} }
}

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
    if (row) thirds.push(row)
  })
  const played = thirds.filter(r => r.played > 0)
  // Avant tout match : tous les 3es sont en lice → tous affichés en bleu.
  if (played.length === 0) return new Set(thirds.map(r => r.team.short))
  played.sort((a, b) =>
    b.pts - a.pts ||
    (b.gf - b.ga) - (a.gf - a.ga) ||
    b.gf - a.gf ||
    a.team.name.localeCompare(b.team.name),
  )
  return new Set(played.slice(0, 8).map(r => r.team.short))
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function Paris({ onBack, currentUser, onOpenAuth, focus, onOpenTrends }: {
  onBack: () => void
  currentUser: UserProfile | null
  onOpenAuth: () => void
  focus?: { id: string; nonce: number } | null
  onOpenTrends?: (matchId: string) => void
}) {
  const [tab,         setTab]         = useState<Tab>('phase')
  const [predictions, setPredictions] = useState<Predictions>({})
  const [qualifiers,  setQualifiers]  = useState<Record<string, string>>({})   // KO : qualifié choisi par match
  const [confirmed,   setConfirmed]   = useState<Set<string>>(new Set())
  const [lockErrors,  setLockErrors]  = useState<Record<string, string>>({})
  const [favorites,   setFavorites]   = useState<string[]>([])
  const [results, setResults] = useState<Record<string, MatchResult>>({})

  // Sync all user-specific state on login/logout
  useEffect(() => {
    setFavorites(currentUser?.favorites ?? [])
    if (!currentUser) {
      setPredictions({})
      setQualifiers({})
      setConfirmed(new Set())
      return
    }
    getBets(currentUser.id).then(bets => {
      const preds: Predictions = {}
      const quals: Record<string, string> = {}
      const conf = new Set<string>()
      bets.forEach(b => {
        preds[b.matchId] = { home: b.homeScore, away: b.awayScore }
        if (b.qualifier) quals[b.matchId] = b.qualifier
        conf.add(b.matchId)
      })
      setPredictions(preds)
      setQualifiers(quals)
      setConfirmed(conf)
    })
  }, [currentUser])

  useEffect(() => {
    const apply = (arr: MatchResult[]) => {
      const map: Record<string, MatchResult> = {}
      arr.forEach(r => { map[r.matchId] = r })
      setResults(map)
    }
    const unsub = subscribeToResults(apply)
    // Filet de sécurité si un push Realtime est manqué (websocket tombé, etc.)
    const iv = setInterval(() => { getResults().then(apply) }, 30000)
    return () => { unsub(); clearInterval(iv) }
  }, [])

  // Tendance TRIVELA (agrégat des pronos par match) — rafraîchie périodiquement.
  const [trends, setTrends] = useState<Record<string, MatchTrend>>({})
  useEffect(() => {
    const load = () => getMatchTrends().then(setTrends).catch(() => {})
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [])

  // Horloge — rafraîchit l'état "en direct / terminé" des matchs
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // Scores en direct + détection des buts (→ flamme sur l'équipe qui marque)
  const [live, setLive] = useState<Record<string, LiveScore>>(loadCachedLive)
  const [goalFlash, setGoalFlash] = useState<Record<string, 'home' | 'away'>>({})
  const prevLive = useRef<Record<string, LiveScore>>({})
  const liveRef  = useRef<Record<string, LiveScore>>(live)   // dernier affichage (anti-flicker), initialisé depuis le cache

  const loadLive = useCallback(async () => {
    const arr = await getLive()
    const real: Record<string, LiveScore> = {}
    arr.forEach(l => { real[l.matchId] = l })
    const prev = prevLive.current
    for (const l of arr) {
      const p = prev[l.matchId]
      if (!p) continue
      const side: 'home' | 'away' | null =
        l.homeScore > p.homeScore ? 'home' : l.awayScore > p.awayScore ? 'away' : null
      if (side) {
        setGoalFlash(g => ({ ...g, [l.matchId]: side }))
        setTimeout(() => setGoalFlash(g => { const n = { ...g }; delete n[l.matchId]; return n }), 30000)
      }
    }
    prevLive.current = real
    // Anti-flicker : si une ligne live disparaît brièvement (creux API) alors que le
    // match est toujours dans son créneau, on garde le dernier score live affiché.
    const now = Date.now()
    const display: Record<string, LiveScore> = { ...real }
    for (const [id, last] of Object.entries(liveRef.current)) {
      if (!display[id] && inLiveWindow(id, now)) display[id] = last
    }
    liveRef.current = display
    setLive(display)
    try { localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(display)) } catch { /* quota */ }
  }, [])

  useEffect(() => {
    loadLive()
    const unsub = subscribeToLive(loadLive)
    // Filet de sécurité : si un push Realtime est manqué (onglet en arrière-plan,
    // coupure réseau, souscription tombée), on resynchronise le score régulièrement.
    const iv = setInterval(loadLive, 15000)
    return () => { unsub(); clearInterval(iv) }
  }, [loadLive])

  // Buteurs (⚽) + cartons rouges (🟥) — live + matchs terminés
  const [goals, setGoals] = useState<Record<string, Scorer[]>>({})
  const [cards, setCards] = useState<Record<string, RedCard[]>>({})
  const loadGoals = useCallback(async () => {
    const [g, c] = await Promise.all([getMatchGoals(), getMatchCards()])
    setGoals(g); setCards(c)
  }, [])
  useEffect(() => {
    loadGoals()
    const unsub = subscribeToMatchGoals(loadGoals)
    const iv = setInterval(loadGoals, 20000)   // même filet de sécurité pour buteurs + cartons
    return () => { unsub(); clearInterval(iv) }
  }, [loadGoals])

  // Affectations d'équipes des phases éliminatoires (bracket rempli au fil des qualifs).
  const [koTeams, setKoTeams] = useState<Record<string, KnockoutTeamRow>>({})
  const [koLoaded, setKoLoaded] = useState(false)            // 1re lecture du bracket faite ?
  // Cible de saut initial vers une affiche éliminatoire (ouverture sur le prochain match).
  const [koFocus, setKoFocus] = useState<{ id: string; nonce: number } | null>(null)
  const [schedule, setSchedule] = useState<Record<string, string>>({})   // match_id → coup d'envoi (API)
  useEffect(() => {
    let alive = true
    const load = () => {
      getKnockoutTeams().then(t => { if (alive) { setKoTeams(t); setKoLoaded(true) } })
      getMatchSchedule().then(s => { if (alive) setSchedule(s) })
    }
    load()
    const iv = setInterval(load, 60000)
    return () => { alive = false; clearInterval(iv) }
  }, [])
  // Matchs éliminatoires : vraies équipes (TBD sinon) + vraies dates (match_schedule / API).
  const koMatches = useMemo(() => applySchedule(knockoutWithTeams(
    Object.fromEntries(Object.entries(koTeams).map(([id, r]) => [id, { home_short: r.home_short, away_short: r.away_short }]))
  ), schedule), [koTeams, schedule])

  // Saut vers un match (bouton "EN DIRECT")
  useEffect(() => {
    if (!focus) return
    setTab('phase')
    const t = setTimeout(() => {
      document.getElementById(`match-${focus.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    return () => clearTimeout(t)
  }, [focus])

  // À l'ouverture de la page : on se place DIRECTEMENT sur le PROCHAIN match de tout le
  // tournoi — en cours, sinon le prochain à venir, sinon le dernier joué — qu'il soit en
  // phase de groupes ou en éliminatoires. On bascule sur le bon onglet puis on défile.
  // Une seule fois, après le 1er chargement du bracket, et si aucun saut "EN DIRECT" demandé.
  const didInitialScroll = useRef(false)
  useEffect(() => {
    if (didInitialScroll.current || focus || !koLoaded) return
    const nowTs = Date.now()
    const cand = [...GROUP_MATCHES, ...koMatches]
      .filter(m => m.home.code !== 'un' && m.away.code !== 'un')
      .map(m => ({ id: m.id, k: KICKOFF_MS.get(m.id) }))
      .filter((x): x is { id: string; k: number } => x.k != null)
    if (!cand.length) return
    const live = cand.find(x => nowTs >= x.k - 5 * 60000 && nowTs < x.k + 135 * 60000)
    const upcoming = cand.filter(x => x.k >= nowTs).sort((a, b) => a.k - b.k)[0]
    const lastPast = [...cand].sort((a, b) => b.k - a.k)[0]
    const targetId = (live ?? upcoming ?? lastPast)?.id
    if (!targetId) return
    didInitialScroll.current = true
    const isKo = !GROUP_MATCHES.some(m => m.id === targetId)
    if (isKo) {
      // Vue éliminatoires : KnockoutView passe en mode Liste et défile jusqu'à l'affiche.
      setTab('eliminatoires')
      setKoFocus({ id: targetId, nonce: nowTs })
    } else {
      setTab('phase')
      setTimeout(() => {
        document.getElementById(`match-${targetId}`)?.scrollIntoView({ behavior: 'auto', block: 'center' })
      }, 350)
    }
  }, [koLoaded, koMatches, focus])

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

  // KO : choix de l'équipe qui se qualifie (pertinent surtout pour un prono nul).
  const setQualifier = (id: string, short: string) => {
    setQualifiers(prev => (prev[id] === short ? prev : { ...prev, [id]: short }))
    setConfirmed(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const edit = (id: string) => {
    setConfirmed(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const confirm = async (id: string) => {
    if (!currentUser) { onOpenAuth(); return }
    const match = [...GROUP_MATCHES, ...koMatches].find(m => m.id === id)
    if (!match) return
    const pred = predictions[id] ?? { home: 0, away: 0 }
    // Qualifié : pour un prono non-nul il est implicite (le vainqueur) → on n'enregistre le
    // choix explicite que pour un prono nul sur un match éliminatoire.
    const isDrawKo = match.round !== 'group' && pred.home === pred.away
    const { error } = await saveBet({
      userId: currentUser.id,
      matchId: id,
      home: match.home.name,
      away: match.away.name,
      homeScore: pred.home,
      awayScore: pred.away,
      qualifier: isDrawKo ? (qualifiers[id] ?? null) : null,
      stage: match.round === 'group'
        ? `Groupe ${match.group} · J${match.matchday}`
        : KO_LABELS[match.round as string] ?? String(match.round),
    })
    if (error) {
      setLockErrors(prev => ({ ...prev, [id]: error }))
      setTimeout(() => setLockErrors(prev => { const s = { ...prev }; delete s[id]; return s }), 3500)
    } else {
      track('bet_placed', { matchId: id, stage: match.round, home: pred.home, away: pred.away })
      setConfirmed(prev => new Set(prev).add(id))
    }
  }

  const thirdsQualified = bestThirds(results)

  // Matchs en direct (données live EN JEU — HT inclus — ou créneau horaire, non terminés).
  // On exige un statut « in-play » : une ligne live résiduelle (FT/périmée) ne compte plus
  // comme « en direct », même si elle n'a pas encore été nettoyée côté serveur.
  const isLiveNow = (m: Match) =>
    m.home.code !== 'un' && !results[m.id] &&
    ((!!live[m.id] && INPLAY.has(live[m.id].status)) || isMatchLive(m, now))
  const liveList = [...GROUP_MATCHES, ...koMatches].filter(isLiveNow)

  return (
    <PageLayout onBack={onBack} accentColor="#C89B3C" flag="🎯" title="PARIS"
      subtitle="Coupe du Monde 2026 · Pronostics">

      {/* ── Rubrique EN DIRECT (en haut) — les matchs restent aussi dans les journées ── */}
      {liveList.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
            padding: '8px 14px', borderRadius: 12,
            background: 'linear-gradient(90deg, rgba(220,38,38,0.14) 0%, rgba(220,38,38,0.03) 100%)',
            border: '1px solid rgba(220,38,38,0.35)', borderLeft: '4px solid #dc2626',
          }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#dc2626',
              animation: 'liveDot 1s ease-in-out infinite' }} />
            <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 17, letterSpacing: 2, color: '#dc2626' }}>
              EN DIRECT{liveList.length > 1 ? ` · ${liveList.length}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liveList.map(m => (
              <LiveHeroCard key={`live-${m.id}`} match={m} domId={`live-${m.id}`}
                live={live[m.id] ?? { matchId: m.id, status: 'LIVE', elapsed: null, homeScore: 0, awayScore: 0 }}
                goalSide={goalFlash[m.id]} scorers={goals[m.id]} redCards={cards[m.id]}
                prediction={predictions[m.id]} confirmed={confirmed.has(m.id)} />
            ))}
          </div>
        </div>
      )}

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
            const gd = (m: Match) => toGenevaDate(m.date, m.time)   // date locale (Genève)
            const dates = [...new Set(mdMatches.map(gd))]
            const dateRange = dates.length > 1 ? `${dates[0]} – ${dates[dates.length - 1]}` : dates[0] ?? ''
            // Regroupe par date locale (en conservant l'ordre chronologique)
            const byDate: { date: string; matches: Match[] }[] = []
            mdMatches.forEach(m => {
              const d = gd(m)
              const last = byDate[byDate.length - 1]
              if (last && last.date === d) last.matches.push(m)
              else byDate.push({ date: d, matches: [m] })
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
                        <MatchCard key={m.id} match={m} domId={`match-${m.id}`}
                          prediction={predictions[m.id]} confirmed={confirmed.has(m.id)}
                          lockError={lockErrors[m.id]}
                          result={results[m.id]} now={now}
                          liveData={live[m.id]} goalSide={goalFlash[m.id]}
                          scorers={goals[m.id]} redCards={cards[m.id]}
                          trend={trends[m.id]} onOpenTrends={onOpenTrends} showPlayers
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

      {/* ══ KNOCKOUT — tableau de tournoi responsive + paris inline ═══ */}
      {tab === 'eliminatoires' && (
        <KnockoutView
          koMatches={koMatches}
          results={results} live={live} goals={goals} cards={cards} goalFlash={goalFlash}
          predictions={predictions} confirmed={confirmed} lockErrors={lockErrors} now={now}
          trends={trends} onOpenTrends={onOpenTrends} koFocus={koFocus}
          qualifiers={qualifiers} koTeams={koTeams} onSetQualifier={setQualifier}
          onIncrement={setPrediction} onConfirm={confirm} onEdit={edit}
        />
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
// ── Bonus « qualifié » KO (déduit du bracket, comme côté serveur) ───────────
const KO_QUALIFIER_BONUS = 2
type KoAssign = Record<string, { home_short: string | null; away_short: string | null }>
const KO_NEXT_SLOT: Record<string, string> = {
  'r32-1': 'r16-1', 'r32-2': 'r16-1', 'r32-3': 'r16-2', 'r32-4': 'r16-2',
  'r32-5': 'r16-3', 'r32-6': 'r16-3', 'r32-7': 'r16-4', 'r32-8': 'r16-4',
  'r32-9': 'r16-5', 'r32-10': 'r16-5', 'r32-11': 'r16-6', 'r32-12': 'r16-6',
  'r32-13': 'r16-7', 'r32-14': 'r16-7', 'r32-15': 'r16-8', 'r32-16': 'r16-8',
  'r16-1': 'qf-1', 'r16-2': 'qf-1', 'r16-3': 'qf-2', 'r16-4': 'qf-2',
  'r16-5': 'qf-3', 'r16-6': 'qf-3', 'r16-7': 'qf-4', 'r16-8': 'qf-4',
  'qf-1': 'sf-1', 'qf-2': 'sf-1', 'qf-3': 'sf-2', 'qf-4': 'sf-2',
  'sf-1': 'final', 'sf-2': 'final',
}
const isKoMatch = (id: string) => /^(r32|r16|qf|sf|3rd|final)/.test(id)
const upShort = (s?: string | null) => (s ?? '').toUpperCase()
/** Vainqueur aux tirs au but d'un match KO nul réglé (code court), sinon null. */
function tabWinnerShort(match: Match | undefined, result: MatchResult | undefined, ko?: KoAssign): string | null {
  if (!match || !result || !ko || !isKoMatch(match.id)) return null
  if (result.homeScore !== result.awayScore) return null   // pas un nul → pas de T.A.B.
  return koActualQual(match.id, result.homeScore, result.awayScore, ko)
}
function koActualQual(id: string, rH: number, rA: number, ko: KoAssign): string | null {
  const me = ko[id]; if (!me) return null
  if (rH > rA) return upShort(me.home_short) || null
  if (rA > rH) return upShort(me.away_short) || null
  const nx = ko[KO_NEXT_SLOT[id]]; if (!nx) return null
  const mine = new Set([me.home_short, me.away_short].filter(Boolean).map(upShort))
  for (const t of [nx.home_short, nx.away_short]) if (t && mine.has(upShort(t))) return upShort(t)
  return null
}
function calcPoints(result: MatchResult, pred: { home: number; away: number },
  match?: Match, qualifier?: string | null, ko?: KoAssign): number {
  const { homeScore: rH, awayScore: rA } = result
  const { home: pH, away: pA } = pred
  const base =
    rH === pH && rA === pA ? 5 :
    rH > rA && pH > pA ? 3 :
    rH < rA && pH < pA ? 3 :
    rH === rA && pH === pA ? 4 : 0   // nul correctement pronostiqué (score inexact)
  // KO décisif ou hors KO → barème seul. KO nul (T.A.B.) → règles spéciales ci-dessous.
  if (!match || !ko || !isKoMatch(match.id) || rH !== rA) return base
  const Q = koActualQual(match.id, rH, rA, ko)   // équipe qui se qualifie
  if (!Q) return base
  if (pH === pA) {                                // prono nul → +2 si bon qualifié choisi
    const pick = qualifier ? upShort(qualifier) : null
    return base + (pick && pick === Q ? KO_QUALIFIER_BONUS : 0)
  }
  // prono vainqueur sur un match nul → +3 « bon vainqueur » si l'équipe choisie passe aux T.A.B.
  const predWinner = pH > pA ? upShort(match.home.short) : upShort(match.away.short)
  return base + (predWinner && predWinner === Q ? 3 : 0)
}

interface MatchCardProps {
  match: Match
  prediction?: { home: number; away: number }
  confirmed: boolean
  lockError?: string
  result?: MatchResult
  liveData?: LiveScore
  goalSide?: 'home' | 'away'
  scorers?: Scorer[]
  redCards?: RedCard[]
  now?: number
  domId?: string
  trend?: MatchTrend
  onOpenTrends?: (matchId: string) => void
  showPlayers?: boolean
  delay: number
  qualifier?: string | null
  koTeams?: KoAssign
  onIncrement: (side: 'home' | 'away', delta: number) => void
  onSetQualifier?: (short: string) => void
  onConfirm: () => void
  onEdit: () => void
}

function MatchCard({ match, prediction, confirmed, lockError, result, liveData, goalSide, scorers, redCards, now, domId, trend, onOpenTrends, showPlayers, delay, qualifier, koTeams, onIncrement, onSetQualifier, onConfirm, onEdit }: MatchCardProps) {
  const pred   = prediction ?? { home: 0, away: 0 }
  const isTBD  = match.home.code === 'un'
  const locked = isMatchLocked(match)
  // KO + prono nul : on propose de choisir l'équipe qui se qualifie (bonus +2 si correct).
  const showQualifier = !isTBD && match.round !== 'group' && pred.home === pred.away && !result

  const nowTs      = now ?? Date.now()
  const finished   = !!result
  const reallyLive = !finished && !!liveData && INPLAY.has(liveData.status)
  const live       = reallyLive || (!finished && isMatchLive(match, nowTs))
  const showCol    = finished || live || confirmed
  // Flamme uniquement en direct, sur l'équipe qui vient de marquer (jamais sur un match terminé)
  const homeFlame  = reallyLive && goalSide === 'home'
  const awayFlame  = reallyLive && goalSide === 'away'
  const entry      = `fadeSlideUp .3s cubic-bezier(0.4,0,0.2,1) ${delay}ms both`

  return (
    <div id={domId} style={{
      borderRadius: 16, overflow: 'hidden', position: 'relative',
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
      {/* Drapeaux des deux pays en fond — simple, sans effet — seulement en direct */}
      {live && !isTBD && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
          <img src={`https://flagcdn.com/${match.home.code}.svg`} alt="" style={{
            position: 'absolute', left: 0, top: 0, height: '100%', width: '46%', objectFit: 'cover', opacity: 0.42,
            WebkitMaskImage: 'linear-gradient(to right, #000 0%, #000 8%, transparent 60%)',
            maskImage: 'linear-gradient(to right, #000 0%, #000 8%, transparent 60%)',
          }} />
          <img src={`https://flagcdn.com/${match.away.code}.svg`} alt="" style={{
            position: 'absolute', right: 0, top: 0, height: '100%', width: '46%', objectFit: 'cover', opacity: 0.42,
            WebkitMaskImage: 'linear-gradient(to left, #000 0%, #000 8%, transparent 60%)',
            maskImage: 'linear-gradient(to left, #000 0%, #000 8%, transparent 60%)',
          }} />
        </div>
      )}

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
          <span>{toGenevaDate(match.date, match.time)}</span>
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
        <TeamBlock team={match.home} align="left" fire={homeFlame} />
        {showCol ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 88 }}>
            {/* Score — grand et centré (final, en direct, ou en attente) */}
            <div style={{
              fontFamily: "'Bebas Neue', cursive", fontSize: 30, letterSpacing: 2, lineHeight: 1,
              color: live ? '#dc2626' : finished ? 'var(--text-1)' : 'var(--text-3)',
              animation: (result || live) ? 'fadeIn 0.3s ease' : 'none',
            }}>
              {finished ? result!.homeScore : live ? (liveData?.homeScore ?? 0) : '–'}
              <span style={{ color: 'var(--text-3)', margin: '0 4px' }}>:</span>
              {finished ? result!.awayScore : live ? (liveData?.awayScore ?? 0) : '–'}
            </div>
            {/* Minute / EN DIRECT */}
            {live && !finished && (
              <div style={{
                marginTop: 4, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: '#dc2626',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626',
                  animation: 'liveDot 1s ease-in-out infinite' }} />
                {liveData?.elapsed != null ? `${liveData.elapsed}'` : 'EN DIRECT'}
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
            {confirmed && !result && !live && (
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
        <TeamBlock team={match.away} align="right" fire={awayFlame} />
      </div>

      {/* Buteurs ⚽ + cartons rouges 🟥 */}
      {((scorers && scorers.length > 0) || (redCards && redCards.length > 0)) && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px',
          padding: '0 16px 12px', alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {scorers?.filter(s => s.side === 'home').map((s, i) => (
              <div key={`g${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
                <span style={{ fontSize: 12 }}>⚽</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scorerShort(s)}</span>
              </div>
            ))}
            {redCards?.filter(c => c.side === 'home').map((c, i) => (
              <div key={`r${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
                <span style={{ fontSize: 11 }}>🟥</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cardShort(c)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
            {scorers?.filter(s => s.side === 'away').map((s, i) => (
              <div key={`g${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scorerShort(s)}</span>
                <span style={{ fontSize: 12 }}>⚽</span>
              </div>
            ))}
            {redCards?.filter(c => c.side === 'away').map((c, i) => (
              <div key={`r${i}`} style={{ display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cardShort(c)}</span>
                <span style={{ fontSize: 11 }}>🟥</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tendance TRIVELA — agrégat des pronos (remplace l'ancien barème +5/+4/+3) */}
      {!isTBD && !finished && (
        <div style={{ padding: '2px 16px 10px' }}>
          <TrendBar compact
            homeTeam={match.home} awayTeam={match.away}
            home={trend?.homeWin ?? 0} draw={trend?.draw ?? 0} away={trend?.awayWin ?? 0}
            total={trend?.total ?? 0}
            label="Tendance Trivela"
            emptyHint="Aucun prono — sois le premier !"
            onClick={onOpenTrends ? () => onOpenTrends(match.id) : undefined}
          />
        </div>
      )}

      {/* KO + prono nul : qui se qualifie ? (bonus +2) */}
      {showQualifier && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-3)',
            textTransform: 'uppercase', marginBottom: 6 }}>
            Qui se qualifie ? <span style={{ color: '#A07828' }}>+2 si correct</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[match.home, match.away].map(t => {
              const on = qualifier === t.short
              return (
                <button key={t.short} disabled={locked} onClick={() => onSetQualifier?.(t.short)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 8px', borderRadius: 9, cursor: locked ? 'default' : 'pointer',
                  background: on ? 'rgba(200,155,60,0.14)' : 'var(--bg-fill)',
                  border: `1px solid ${on ? '#C89B3C' : 'var(--border)'}`,
                  color: on ? '#A07828' : 'var(--text-2)', fontSize: 12, fontWeight: 700,
                }}>
                  <img src={`https://flagcdn.com/w20/${t.code}.png`} alt="" style={{ width: 18, height: 12, borderRadius: 2, objectFit: 'cover' }} />
                  {t.short}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {lockError ? (
            <span style={{ color: '#dc2626', fontWeight: 700 }}>🔒 {lockError}</span>
          ) : result ? (
            <span style={{ fontWeight: 700, color: 'var(--text-2)', letterSpacing: 0.3, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>
                FT&thinsp;
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 13, letterSpacing: 1 }}>
                  {result.homeScore}–{result.awayScore}
                </span>
              </span>
              {(() => {
                const tw = tabWinnerShort(match, result, koTeams)
                const name = tw === upShort(match.home.short) ? match.home.short
                  : tw === upShort(match.away.short) ? match.away.short : null
                return name ? (
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, padding: '1px 7px', borderRadius: 5, letterSpacing: 0.3,
                    color: '#A07828', background: 'rgba(200,155,60,0.14)',
                  }}>🥅 {name} aux t.a.b.</span>
                ) : null
              })()}
            </span>
          ) : null}
        </div>
        {result && confirmed && prediction ? (() => {
          const pts = calcPoints(result, prediction, match, qualifier, koTeams)
          const bd = pointsBadge(pts)
          return (
            <div className={bd.className} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, ...bd.style }}>
              {ptsLabel(pts)} pts
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
      {result && showPlayers && <MatchPlayers matchId={match.id} />}
    </div>
  )
}

// ─── Récap des pronos joueur par joueur (badges +6/+7 spéciaux) ──────────────
// Affiché sous un match TERMINÉ de l'onglet Paris : chaque joueur, son prono et ses
// points, avec la pastille dorée (+6) / feu (+7) identique à Tendances. Chargement
// paresseux + cache mémoire (dédoublonne les appels quand plusieurs cartes s'affichent).
const _playerBetsCache = new Map<string, PlayerBet[]>()
function MatchPlayers({ matchId }: { matchId: string }) {
  const [open, setOpen] = useState(false)
  const [bets, setBets] = useState<PlayerBet[] | null>(_playerBetsCache.get(matchId) ?? null)
  // Chargement paresseux : on n'interroge l'API que lorsque le joueur ouvre le bloc.
  useEffect(() => {
    if (!open || _playerBetsCache.has(matchId)) return
    let alive = true
    getMatchPlayerBets(matchId).then(b => { _playerBetsCache.set(matchId, b); if (alive) setBets(b) })
    return () => { alive = false }
  }, [open, matchId])
  const rows = (bets ?? []).filter(b => b.revealed && b.homeScore != null)
    .sort((a, b) => (b.points ?? -1) - (a.points ?? -1))
  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-3)', textTransform: 'uppercase',
      }}>
        <span style={{ fontSize: 11, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▸</span>
        Pronostics des joueurs
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'none', letterSpacing: 0 }}>
          {open ? 'masquer' : 'afficher'}
        </span>
      </button>
      {open && rows.length > 0 && (
        <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(b => {
            const pts = b.points ?? 0
            const bd = pointsBadge(pts)
            return (
              <div key={b.userId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src={`https://flagcdn.com/w20/${b.countryCode}.png`} alt="" style={{ width: 18, height: 12, borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.pseudo}</span>
                {b.qualifier && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: '#A07828', whiteSpace: 'nowrap' }}>🥅 {b.qualifier}</span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                  {b.homeScore}–{b.awayScore}
                </span>
                <span className={bd.className} style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, minWidth: 30, textAlign: 'center', ...bd.style }}>
                  {ptsLabel(pts)}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {open && bets != null && rows.length === 0 && (
        <div style={{ padding: '0 16px 10px', fontSize: 11, color: 'var(--text-3)' }}>Aucun prono à afficher.</div>
      )}
    </div>
  )
}

// ─── TeamBlock ────────────────────────────────────────────────────────────
// ─── LiveHeroCard — grande carte du match en direct (mise en avant) ──────────

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
              borderRadius: 4, border: `${fire ? 2 : 1}px solid ${fire ? 'rgba(245,130,30,0.95)' : 'var(--border)'}`,
              boxShadow: fire ? '0 0 18px 3px rgba(245,130,30,0.85)' : '0 1px 4px rgba(0,0,0,0.1)',
            }} />
          {fire && (
            <span style={{
              position: 'absolute', top: -16, left: '50%', marginLeft: -13, fontSize: 26, lineHeight: 1,
              filter: 'drop-shadow(0 0 6px rgba(245,130,30,1)) drop-shadow(0 0 12px rgba(245,90,10,0.7))',
              animation: 'flameFlicker 0.55s ease-in-out infinite', pointerEvents: 'none',
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

// ─── Buteurs — affichage compact « ⚽ Nom min' » ────────────────────────────
function scorerShort(s: Scorer): string {
  const parts = s.player.trim().split(/\s+/)
  const name = parts.length > 1 ? parts[parts.length - 1] : s.player
  const tag = s.og ? ' csc' : s.pen ? ' (P)' : ''
  const min = s.minute != null ? ` ${s.minute}'` : ''
  return `${name}${tag}${min}`
}

// ─── Cartons rouges — affichage compact « 🟥 Nom min' » ─────────────────────
function cardShort(c: RedCard): string {
  const parts = c.player.trim().split(/\s+/)
  const name = parts.length > 1 ? parts[parts.length - 1] : c.player
  const min = c.minute != null ? ` ${c.minute}'` : ''
  return `${name}${min}`
}

// ─── Knockout bracket — double tableau de tournoi ──────────────────────────
function MiniTeam({ team, score, win, dim, fire }: {
  team: Team; score: number | null; win: boolean; dim: boolean; fire?: boolean
}) {
  const isTBD = team.code === 'un'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: dim ? 0.45 : 1 }}>
      {isTBD ? (
        <div style={{
          width: 18, height: 12, borderRadius: 2, flexShrink: 0,
          background: 'var(--bg-fill)', border: '1px solid var(--border)',
        }} />
      ) : (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={`https://flagcdn.com/w20/${team.code}.png`} alt={team.short}
            style={{
              width: 18, height: 12, objectFit: 'cover', borderRadius: 2,
              border: `${fire ? 2 : 1}px solid ${fire ? 'rgba(245,130,30,0.95)' : 'var(--border)'}`,
              boxShadow: fire ? '0 0 12px 2px rgba(245,130,30,0.85)' : undefined,
            }} />
          {fire && (
            <span style={{
              position: 'absolute', top: -13, left: '50%', marginLeft: -8, fontSize: 15, lineHeight: 1,
              filter: 'drop-shadow(0 0 5px rgba(245,130,30,1))',
              animation: 'flameFlicker 0.55s ease-in-out infinite', pointerEvents: 'none',
            }}>🔥</span>
          )}
        </div>
      )}
      <span style={{
        fontFamily: "'Bebas Neue', cursive", fontSize: 12, letterSpacing: 0.8,
        fontWeight: win ? 800 : 500,
        color: isTBD ? 'var(--text-3)' : 'var(--text-1)',
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {isTBD ? '—' : team.short}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
        color: win ? 'var(--text-1)' : 'var(--text-2)', minWidth: 8, textAlign: 'right',
      }}>
        {score != null ? score : ''}
      </span>
    </div>
  )
}

// Données + handlers partagés par la vue éliminatoires (desktop & mobile).
interface KOData {
  koMatches: Match[]
  results: Record<string, MatchResult>
  live: Record<string, LiveScore>
  goals: Record<string, Scorer[]>
  cards: Record<string, RedCard[]>
  goalFlash: Record<string, 'home' | 'away'>
  predictions: Predictions
  confirmed: Set<string>
  lockErrors: Record<string, string>
  now: number
  trends: Record<string, MatchTrend>
  onOpenTrends?: (matchId: string) => void
  koFocus?: { id: string; nonce: number } | null
  qualifiers: Record<string, string>
  koTeams: KoAssign
  onIncrement: (id: string, side: 'home' | 'away', delta: number) => void
  onSetQualifier: (id: string, short: string) => void
  onConfirm: (id: string) => void
  onEdit: (id: string) => void
}

// ─── Stepper compact pour parier dans une case ─────────────────────────────
function MiniStepper({ value, onUp, onDown }: { value: number; onUp: () => void; onDown: () => void }) {
  const btn: React.CSSProperties = {
    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 6,
    color: 'var(--text-2)', fontSize: 14, fontWeight: 700, lineHeight: 1, padding: 0,
    cursor: 'pointer', userSelect: 'none', flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button style={btn} onClick={onDown}>−</button>
      <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 17, minWidth: 14, textAlign: 'center', color: 'var(--text-1)' }}>{value}</span>
      <button style={btn} onClick={onUp}>+</button>
    </div>
  )
}

// Bloc de pari inline (steppers + bouton) réutilisé dans chaque case.
function BetArea({ match, data }: { match: Match; data: KOData }) {
  const id = match.id
  const pred = data.predictions[id] ?? { home: 0, away: 0 }
  const confirmed = data.confirmed.has(id)
  const lockError = data.lockErrors[id]
  const isTBD = match.home.code === 'un'
  const locked = isMatchLocked(match)
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-2)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 64,
  }
  return (
    <div onClick={e => e.stopPropagation()} style={{
      marginTop: 6, paddingTop: 7, borderTop: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {isTBD ? (
        <div style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', fontWeight: 600 }}>
          Équipes à venir
        </div>
      ) : locked ? (
        <div style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', fontWeight: 700, letterSpacing: 0.4 }}>
          🔒 Verrouillé
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={labelStyle}>{match.home.short}</span>
            <MiniStepper value={pred.home}
              onUp={() => data.onIncrement(id, 'home', 1)} onDown={() => data.onIncrement(id, 'home', -1)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={labelStyle}>{match.away.short}</span>
            <MiniStepper value={pred.away}
              onUp={() => data.onIncrement(id, 'away', 1)} onDown={() => data.onIncrement(id, 'away', -1)} />
          </div>
          {match.round !== 'group' && pred.home === pred.away && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 0.3, textAlign: 'center' }}>
                QUALIFIÉ ? <span style={{ color: '#A07828' }}>+2</span>
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[match.home, match.away].map(t => {
                  const on = data.qualifiers[id] === t.short
                  return (
                    <button key={t.short} onClick={() => data.onSetQualifier(id, t.short)} style={{
                      flex: 1, padding: '3px 0', borderRadius: 6, cursor: 'pointer', fontSize: 9.5, fontWeight: 800,
                      background: on ? 'rgba(200,155,60,0.16)' : 'var(--bg-fill)',
                      border: `1px solid ${on ? '#C89B3C' : 'var(--border)'}`, color: on ? '#A07828' : 'var(--text-2)',
                    }}>{t.short}</button>
                  )
                })}
              </div>
            </div>
          )}
          {confirmed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>✓ {pred.home}–{pred.away}</span>
              <button onClick={() => data.onEdit(id)} style={{
                padding: '3px 9px', background: 'var(--bg-fill)', border: '1px solid var(--border)',
                borderRadius: 7, color: 'var(--text-2)', fontSize: 10, fontWeight: 600, cursor: 'pointer',
              }}>Modifier</button>
            </div>
          ) : (
            <button onClick={() => data.onConfirm(id)} style={{
              width: '100%', padding: '6px 0', borderRadius: 8, cursor: 'pointer',
              background: 'linear-gradient(135deg, #C89B3C, #A07828)', border: 'none',
              color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
            }}>PARIER</button>
          )}
          {lockError && (
            <div style={{ fontSize: 9, color: '#dc2626', textAlign: 'center', fontWeight: 600 }}>{lockError}</div>
          )}
        </>
      )}
    </div>
  )
}

function BracketCell({ match, data, expanded, alwaysBet, onSelect }: {
  match: Match; data: KOData; expanded: boolean; alwaysBet?: boolean
  onSelect: (id: string) => void
}) {
  const id = match.id
  const result = data.results[id]
  const liveScore = data.live[id]
  const isLive = !!liveScore && INPLAY.has(liveScore.status)
  const hs = result ? result.homeScore : isLive ? liveScore!.homeScore : null
  const as = result ? result.awayScore : isLive ? liveScore!.awayScore : null
  const decided = !!result && hs != null && as != null
  const homeWin = decided && (hs as number) > (as as number)
  const awayWin = decided && (as as number) > (hs as number)
  const flashSide = data.goalFlash[id]
  const fireHome = isLive && flashSide === 'home'
  const fireAway = isLive && flashSide === 'away'
  const confirmed = data.confirmed.has(id)
  const pred = data.predictions[id]
  const showBet = !!alwaysBet && !result && !isLive
  const pts = result && confirmed && pred ? calcPoints(result, pred, match, data.qualifiers[id], data.koTeams) : null
  const tabWin = tabWinnerShort(match, result, data.koTeams)
  const tabWinName = tabWin === upShort(match.home.short) ? match.home.short
    : tabWin === upShort(match.away.short) ? match.away.short : null
  return (
    <div onClick={() => onSelect(id)} style={{
      width: '100%', display: 'flex', flexDirection: 'column', gap: 3,
      padding: '6px 7px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
      background: expanded ? 'rgba(200,155,60,0.12)' : 'var(--bg-card)',
      border: `1px solid ${isLive ? 'rgba(220,38,38,0.85)' : expanded ? '#C89B3C' : 'var(--border)'}`,
      boxShadow: isLive ? '0 0 10px rgba(220,38,38,0.3)' : 'var(--shadow-sm)',
      animation: isLive ? 'livePulse 1.6s ease-in-out infinite' : undefined,
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      <MiniTeam team={match.home} score={hs} win={homeWin || tabWin === upShort(match.home.short)} dim={awayWin || (!!tabWin && tabWin === upShort(match.away.short))} fire={fireHome} />
      <div style={{ height: 1, background: 'var(--sep)' }} />
      <MiniTeam team={match.away} score={as} win={awayWin || tabWin === upShort(match.away.short)} dim={homeWin || (!!tabWin && tabWin === upShort(match.home.short))} fire={fireAway} />
      {/* Pas de liste de buteurs ici : elle ferait exploser la hauteur des cases et
          désaligne tout le tableau (surtout avec les tireurs aux t.a.b.). Les buteurs
          restent visibles en vue Liste et dans la carte du match sélectionné. */}
      {tabWinName && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 1 }}>
          <span style={{
            fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 5, letterSpacing: 0.3,
            color: '#A07828', background: 'rgba(200,155,60,0.14)', whiteSpace: 'nowrap',
          }}>🥅 {tabWinName} aux t.a.b.</span>
        </div>
      )}
      {result && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
          {pts != null ? (() => {
            const bd = pointsBadge(pts)
            return <span className={bd.className} style={{ fontSize: 9, padding: '1px 7px', borderRadius: 6, ...bd.style }}>{ptsLabel(pts)} pts</span>
          })() : (
            <span style={{ fontSize: 8, color: 'var(--text-3)', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>terminé</span>
          )}
        </div>
      )}
      {showBet && <BetArea match={match} data={data} />}
    </div>
  )
}

// ─── Lignes de branche du tournoi (géométrie en %) ─────────────────────────
const KO_LINE = 'var(--text-3)'

function connLines(pairs: number, side: 'left' | 'right') {
  // pairs === 0 → simple trait horizontal (demie → finale)
  if (pairs === 0) {
    return [
      <div key="s" style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: 0, borderTop: `2px solid ${KO_LINE}` }} />,
    ]
  }
  const N = pairs
  const stubLeft = side === 'left' ? '0' : '50%'
  const outLeft  = side === 'left' ? '50%' : '0'
  const out: React.ReactNode[] = []
  for (let i = 0; i < N; i++) {
    const topC = ((4 * i + 1) / (4 * N)) * 100
    const botC = ((4 * i + 3) / (4 * N)) * 100
    const midC = ((4 * i + 2) / (4 * N)) * 100
    out.push(<div key={`t${i}`} style={{ position: 'absolute', top: `${topC}%`, left: stubLeft, width: '50%', height: 0, borderTop: `2px solid ${KO_LINE}` }} />)
    out.push(<div key={`b${i}`} style={{ position: 'absolute', top: `${botC}%`, left: stubLeft, width: '50%', height: 0, borderTop: `2px solid ${KO_LINE}` }} />)
    out.push(<div key={`v${i}`} style={{ position: 'absolute', top: `${topC}%`, left: '50%', width: 0, height: `${botC - topC}%`, borderLeft: `2px solid ${KO_LINE}` }} />)
    out.push(<div key={`o${i}`} style={{ position: 'absolute', top: `${midC}%`, left: outLeft, width: '50%', height: 0, borderTop: `2px solid ${KO_LINE}` }} />)
  }
  return out
}

const KO_HEAD_H = 22

function ConnectorColumn({ pairs, side, width }: { pairs: number; side: 'left' | 'right'; width: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, minWidth: width, height: '100%' }}>
      <div style={{ height: KO_HEAD_H }} />
      <div style={{ flex: 1, position: 'relative' }}>{connLines(pairs, side)}</div>
    </div>
  )
}

function RoundColumn({ label, ids, width, data, selected, onSelect }: {
  label: string; ids: string[]; width: number; data: KOData
  selected: string; onSelect: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, minWidth: width, height: '100%' }}>
      <div style={{
        height: KO_HEAD_H, fontSize: 9, fontWeight: 700, color: 'var(--text-3)',
        textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ flex: 1, display: 'grid', gridTemplateRows: `repeat(${ids.length}, 1fr)` }}>
        {ids.map(id => {
          const m = data.koMatches.find(x => x.id === id)
          if (!m) return null
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
              <BracketCell match={m} data={data} expanded={selected === id} onSelect={onSelect} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Vue desktop : vraie branche de tournoi (double tableau + lignes) ───────
function DesktopBracket({ data }: { data: KOData }) {
  const [selected, setSelected] = useState<string>('final')
  const onSelect = (id: string) => setSelected(id)
  const W = 118   // largeur d'une colonne de matchs
  const CW = 22   // largeur d'une colonne de connecteurs
  const BR_H = 704   // hauteur : ~85px par case de 32es → une case réglée (équipes + t.a.b. + pts) tient sans déborder
  const finalMatch = data.koMatches.find(m => m.id === 'final')!
  const thirdMatch = data.koMatches.find(m => m.id === '3rd')!
  const sel = data.koMatches.find(m => m.id === selected)
  const colP = { data, selected, onSelect }
  const minW = 8 * W + 8 * CW + W + 16

  // Zoom : par défaut le tableau est AJUSTÉ à la largeur de l'écran (vue d'ensemble
  // complète), puis on peut agrandir pour lire et faire défiler. Indispensable sur
  // téléphone où le tableau (≈1250px) ne tient pas.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number | null>(null)   // null → suit l'ajustement
  const [fit, setFit] = useState(1)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => { const w = el.clientWidth; if (w > 0) setFit(Math.min(1, +(w / minW).toFixed(3))) }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [minW])
  const scale = zoom ?? fit
  const clampZoom = (z: number) => Math.max(Math.min(fit, 1), Math.min(1.4, +z.toFixed(3)))
  const zBtn: React.CSSProperties = {
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-fill)',
    color: 'var(--text-1)', fontSize: 16, fontWeight: 800, cursor: 'pointer', lineHeight: 1, padding: 0,
  }
  return (
    <>
      {/* Barre de zoom : « Ajuster » = tout le tableau à l'écran ; +/− pour lire. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <button onClick={() => setZoom(fit)} style={{
          height: 30, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: Math.abs(scale - fit) < 0.005 ? 'rgba(200,155,60,0.16)' : 'var(--bg-fill)',
          color: Math.abs(scale - fit) < 0.005 ? '#A07828' : 'var(--text-1)', fontSize: 12, fontWeight: 800, cursor: 'pointer',
        }}>⤢ Ajuster</button>
        <button onClick={() => setZoom(clampZoom(scale - 0.15))} style={zBtn} aria-label="Dézoomer">−</button>
        <span style={{ minWidth: 42, textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(scale * 100)}%</span>
        <button onClick={() => setZoom(clampZoom(scale + 0.15))} style={zBtn} aria-label="Zoomer">+</button>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>glissez pour explorer</span>
      </div>
      {/* Carte pannable : le tableau (large + haut) tient dans une zone bornée qu'on
          fait défiler dans les 2 sens (◀▶ et ▲▼), et zoomable via la barre ci-dessus. */}
      <div ref={scrollRef} style={{
        overflow: 'auto', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x pan-y', overscrollBehavior: 'contain',
        maxHeight: 'min(74vh, 760px)', paddingBottom: 8,
        border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)',
      }}>
        <div style={{ width: minW * scale, height: BR_H * scale, position: 'relative', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 0, width: minW, minWidth: minW, height: BR_H, alignItems: 'stretch', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {/* ── Côté gauche ── */}
          <RoundColumn {...colP} width={W} label="32es" ids={['r32-1', 'r32-2', 'r32-3', 'r32-4', 'r32-5', 'r32-6', 'r32-7', 'r32-8']} />
          <ConnectorColumn pairs={4} side="left" width={CW} />
          <RoundColumn {...colP} width={W} label="8es" ids={['r16-1', 'r16-2', 'r16-3', 'r16-4']} />
          <ConnectorColumn pairs={2} side="left" width={CW} />
          <RoundColumn {...colP} width={W} label="Quarts" ids={['qf-1', 'qf-2']} />
          <ConnectorColumn pairs={1} side="left" width={CW} />
          <RoundColumn {...colP} width={W} label="Demies" ids={['sf-1']} />
          <ConnectorColumn pairs={0} side="left" width={CW} />

          {/* ── Centre : finale + 3e place ── */}
          <div style={{ display: 'flex', flexDirection: 'column', width: W, minWidth: W, height: '100%' }}>
            <div style={{
              height: KO_HEAD_H, fontSize: 9, fontWeight: 800, color: '#A07828',
              textAlign: 'center', letterSpacing: 0.6, textTransform: 'uppercase',
            }}>🏆 Finale</div>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, transform: 'translateY(-50%)' }}>
                <BracketCell match={finalMatch} data={data} expanded={selected === 'final'} onSelect={onSelect} />
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                <div style={{
                  fontSize: 8, fontWeight: 700, color: 'var(--text-3)', textAlign: 'center',
                  letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase',
                }}>3e place</div>
                <BracketCell match={thirdMatch} data={data} expanded={selected === '3rd'} onSelect={onSelect} />
              </div>
            </div>
          </div>

          {/* ── Côté droit ── */}
          <ConnectorColumn pairs={0} side="right" width={CW} />
          <RoundColumn {...colP} width={W} label="Demies" ids={['sf-2']} />
          <ConnectorColumn pairs={1} side="right" width={CW} />
          <RoundColumn {...colP} width={W} label="Quarts" ids={['qf-3', 'qf-4']} />
          <ConnectorColumn pairs={2} side="right" width={CW} />
          <RoundColumn {...colP} width={W} label="8es" ids={['r16-5', 'r16-6', 'r16-7', 'r16-8']} />
          <ConnectorColumn pairs={4} side="right" width={CW} />
          <RoundColumn {...colP} width={W} label="32es" ids={['r32-9', 'r32-10', 'r32-11', 'r32-12', 'r32-13', 'r32-14', 'r32-15', 'r32-16']} />
        </div>
        </div>
      </div>

      {/* Pari sur le match sélectionné dans le tableau */}
      {sel && (
        <div style={{ marginTop: 14 }}>
          <div style={{
            fontFamily: "'Bebas Neue', cursive", fontSize: 15, letterSpacing: 1.5,
            color: '#A07828', marginBottom: 8,
          }}>
            {KO_LABELS[sel.round as string] ?? sel.group} — votre pronostic
          </div>
          <MatchCard match={sel} domId={`match-${sel.id}`}
            prediction={data.predictions[sel.id]} confirmed={data.confirmed.has(sel.id)}
            lockError={data.lockErrors[sel.id]}
            result={data.results[sel.id]} now={data.now}
            liveData={data.live[sel.id]} goalSide={data.goalFlash[sel.id]}
            scorers={data.goals[sel.id]} redCards={data.cards[sel.id]}
            trend={data.trends[sel.id]} onOpenTrends={data.onOpenTrends} showPlayers
            delay={0} qualifier={data.qualifiers[sel.id]} koTeams={data.koTeams}
            onIncrement={(s, d) => data.onIncrement(sel.id, s, d)}
            onSetQualifier={(s) => data.onSetQualifier(sel.id, s)}
            onConfirm={() => data.onConfirm(sel.id)}
            onEdit={() => data.onEdit(sel.id)}
          />
        </div>
      )}
    </>
  )
}

// ─── Vue « Liste » : exactement comme la phase de groupes (cartes par date) ──
const KO_ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', '3rd', 'final'] as const

function KnockoutList({ data }: { data: KOData }) {
  // On n'affiche que les affiches dont les équipes sont connues (les autres restent
  // « À venir » dans le tableau). Présentation identique à la phase de groupes :
  // en-tête de tour → séparateur de date → cartes empilées, dans l'ordre des dates.
  const known = data.koMatches.filter(m => m.home.code !== 'un' && m.away.code !== 'un')
  if (known.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
        Les affiches s'afficheront ici dès que les équipes seront connues.
      </div>
    )
  }
  return (
    <>
      {KO_ROUND_ORDER.map(round => {
        const roundMatches = known
          .filter(m => m.round === round)
          .sort((a, b) => (parseUTC(a.date, a.time) ?? 0) - (parseUTC(b.date, b.time) ?? 0))
        if (!roundMatches.length) return null
        const gd = (m: Match) => toGenevaDate(m.date, m.time)
        const dates = [...new Set(roundMatches.map(gd))]
        const dateRange = dates.length > 1 ? `${dates[0]} – ${dates[dates.length - 1]}` : dates[0] ?? ''
        // Regroupe par date locale (ordre chronologique conservé)
        const byDate: { date: string; matches: Match[] }[] = []
        roundMatches.forEach(m => {
          const d = gd(m)
          const last = byDate[byDate.length - 1]
          if (last && last.date === d) last.matches.push(m)
          else byDate.push({ date: d, matches: [m] })
        })
        return (
          <div key={round} style={{ marginBottom: 26 }}>
            {/* En-tête du tour (équivalent de « Journée X ») */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              padding: '9px 14px',
              background: 'linear-gradient(90deg, rgba(200,155,60,0.10) 0%, rgba(200,155,60,0.03) 100%)',
              borderLeft: '3px solid #C89B3C', borderRadius: '0 10px 10px 0',
            }}>
              <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 16, letterSpacing: 2, color: '#A07828' }}>
                {KO_LABELS[round]}
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
                {/* Séparateur de date */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  margin: di === 0 ? '2px 0 12px' : '20px 0 12px',
                  padding: '9px 14px', borderRadius: 12,
                  background: 'var(--bg-fill)', border: '1px solid var(--border)',
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
                    <MatchCard key={m.id} match={m} domId={`match-${m.id}`}
                      prediction={data.predictions[m.id]} confirmed={data.confirmed.has(m.id)}
                      lockError={data.lockErrors[m.id]}
                      result={data.results[m.id]} now={data.now}
                      liveData={data.live[m.id]} goalSide={data.goalFlash[m.id]}
                      scorers={data.goals[m.id]} redCards={data.cards[m.id]}
                      trend={data.trends[m.id]} onOpenTrends={data.onOpenTrends} showPlayers
                      delay={i * 30} qualifier={data.qualifiers[m.id]} koTeams={data.koTeams}
                      onIncrement={(s, d) => data.onIncrement(m.id, s, d)}
                      onSetQualifier={(s) => data.onSetQualifier(m.id, s)}
                      onConfirm={() => data.onConfirm(m.id)}
                      onEdit={() => data.onEdit(m.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}

function KnockoutView(data: KOData) {
  const [view, setView] = useState<'bracket' | 'list'>('bracket')
  // Ouverture sur le prochain match : on bascule en vue Liste (scroll vertical fiable)
  // puis on défile jusqu'à l'affiche ciblée.
  const koFocus = data.koFocus
  useEffect(() => {
    if (!koFocus) return
    setView('list')
    const t = setTimeout(() => {
      document.getElementById(`match-${koFocus.id}`)?.scrollIntoView({ behavior: 'auto', block: 'center' })
    }, 420)
    return () => clearTimeout(t)
  }, [koFocus?.nonce])   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div style={{
        padding: '11px 14px', margin: '0 0 12px',
        background: 'rgba(200,155,60,0.07)',
        border: '1px solid rgba(200,155,60,0.2)',
        borderRadius: 12, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        {view === 'bracket'
          ? 'Touchez un match du tableau (faites défiler ◀ ▶ ▲ ▼) pour pronostiquer juste en dessous. Vue « Liste » plus pratique sur téléphone.'
          : 'Tous les matchs à élimination directe, les uns après les autres, dans l’ordre des dates.'}{' '}
        Les drapeaux des qualifiés apparaissent après la phase de groupes.
      </div>

      {/* Bascule Tableau (branche de tournoi) / Liste */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {([['bracket', '🏆 Tableau'], ['list', '☰ Liste']] as const).map(([k, lbl]) => {
          const on = view === k
          return (
            <button key={k} onClick={() => setView(k)} style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${on ? '#C89B3C' : 'var(--border)'}`,
              background: on ? 'rgba(200,155,60,0.12)' : 'var(--bg-card)',
              color: on ? '#A07828' : 'var(--text-2)',
              fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
            }}>{lbl}</button>
          )
        })}
      </div>

      {view === 'bracket' ? <DesktopBracket data={data} /> : <KnockoutList data={data} />}
    </>
  )
}

// ─── Carte live mise en avant (rubrique EN DIRECT en haut) ─────────────────
function HeroTeam({ team, align, fire }: { team: Team; align: 'left' | 'right'; fire?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      order: align === 'left' ? 0 : 2 }}>
      <div style={{ position: 'relative' }}>
        <img src={`https://flagcdn.com/w80/${team.code}.png`} alt={team.name}
          style={{ width: 56, height: 38, objectFit: 'cover', borderRadius: 6,
            border: `${fire ? 2 : 1}px solid ${fire ? 'rgba(245,130,30,0.95)' : 'var(--border)'}`,
            boxShadow: fire ? '0 0 22px 4px rgba(245,130,30,0.85)' : '0 2px 8px rgba(0,0,0,0.18)' }} />
        {fire && (
          <span style={{ position: 'absolute', top: -22, left: '50%', marginLeft: -17, fontSize: 34, lineHeight: 1,
            filter: 'drop-shadow(0 0 7px rgba(245,130,30,1)) drop-shadow(0 0 14px rgba(245,90,10,0.7))',
            animation: 'flameFlicker 0.55s ease-in-out infinite', pointerEvents: 'none' }}>🔥</span>
        )}
      </div>
      <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 1, color: 'var(--text-1)' }}>
        {team.short}
      </span>
    </div>
  )
}

function LiveHeroCard({ match, live, goalSide, scorers, redCards, prediction, confirmed, domId }: {
  match: Match; live: LiveScore; goalSide?: 'home' | 'away'; scorers?: Scorer[]; redCards?: RedCard[]
  prediction?: { home: number; away: number }; confirmed: boolean; domId?: string
}) {
  const pred = prediction ?? { home: 0, away: 0 }
  const stage = match.round === 'group'
    ? (match.group === 'Amical' ? 'Match amical' : `Groupe ${match.group} · J${match.matchday}`)
    : KO_LABELS[match.round as string] ?? match.group
  const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(live.status)
  return (
    <div id={domId} style={{
      position: 'relative', overflow: 'hidden', borderRadius: 18, padding: '12px 16px 16px',
      background: 'linear-gradient(160deg, rgba(220,38,38,0.14), var(--bg-card) 70%)',
      border: '1.5px solid rgba(220,38,38,0.55)',
      boxShadow: '0 10px 34px rgba(220,38,38,0.28)',
      animation: 'livePulse 1.6s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6,
        fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#dc2626' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626',
          animation: 'liveDot 1s ease-in-out infinite' }} />
        EN DIRECT{live.elapsed != null ? ` · ${live.elapsed}'` : (isLive ? '' : ` · ${live.status}`)}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '6px 0 8px' }}>
        <HeroTeam team={match.home} align="left" fire={goalSide === 'home'} />
        <div style={{ order: 1, fontFamily: "'Bebas Neue', cursive", fontSize: 48, lineHeight: 1, color: '#dc2626',
          animation: 'fadeIn 0.3s ease' }}>
          {live.homeScore}<span style={{ color: 'var(--text-3)', margin: '0 6px' }}>:</span>{live.awayScore}
        </div>
        <HeroTeam team={match.away} align="right" fire={goalSide === 'away'} />
      </div>

      {((scorers && scorers.length > 0) || (redCards && redCards.length > 0)) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', margin: '8px 0 4px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {scorers?.filter(s => s.side === 'home').map((s, i) => (
              <div key={`g${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-2)', fontWeight: 600 }}>
                <span>⚽</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scorerShort(s)}</span>
              </div>
            ))}
            {redCards?.filter(c => c.side === 'home').map((c, i) => (
              <div key={`r${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-2)', fontWeight: 600 }}>
                <span>🟥</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cardShort(c)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
            {scorers?.filter(s => s.side === 'away').map((s, i) => (
              <div key={`g${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-2)', fontWeight: 600 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scorerShort(s)}</span><span>⚽</span>
              </div>
            ))}
            {redCards?.filter(c => c.side === 'away').map((c, i) => (
              <div key={`r${i}`} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-2)', fontWeight: 600 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cardShort(c)}</span><span>🟥</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 9, color: 'var(--text-3)', letterSpacing: 0.4 }}>
        {stage} · {match.venue} · {match.city}
      </div>
      {confirmed && (
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>
          Ton prono <span style={{ color: 'var(--text-2)' }}>{pred.home}–{pred.away}</span>
        </div>
      )}
    </div>
  )
}
