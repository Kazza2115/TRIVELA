import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import PageLayout from './PageLayout'
import { ALL_MATCHES } from '../data/wc2026Matches'
import type { Match } from '../data/wc2026Matches'
import {
  getPublicBets, getResults, getRatings, getComments, getCommentReactions,
  rateBet, addComment, deleteComment, reactToComment, unreactToComment,
  subscribeToPlayerSocial, setUserAdmin,
} from '../services/auth'
import type {
  UserProfile, PublicBet, MatchResult, BetRating, BetComment, CommentReaction,
} from '../services/auth'

// ─── Lookups & date helpers ─────────────────────────────────────────────────
const MATCH_BY_ID = new Map<string, Match>(ALL_MATCHES.map(m => [m.id, m]))

const FR_MONTHS: Record<string, number> = {
  Jan: 0, Fév: 1, Mar: 2, Avr: 3, Mai: 4, Juin: 5,
  Juil: 6, Aoû: 7, Sep: 8, Oct: 9, Nov: 10, Déc: 11,
}
function parseUTC(dateStr?: string, timeStr?: string): number | null {
  if (!dateStr || !timeStr) return null
  const parts = dateStr.split(' ')
  const day = parseInt(parts[0], 10)
  const mon = FR_MONTHS[parts[1]?.slice(0, 4)] ?? FR_MONTHS[parts[1]?.slice(0, 3)] ?? -1
  if (isNaN(day) || mon === -1) return null
  const [hh, mm] = timeStr.split(':').map(Number)
  return Date.UTC(2026, mon, day, hh, mm, 0)
}
function kickoffLabel(m?: Match): string {
  const utc = parseUTC(m?.date, m?.time)
  if (utc === null) return '—'
  return new Date(utc).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Zurich', hour12: false,
  })
}

const GOLD = '#C89B3C'

interface PlayerProfileProps {
  player: UserProfile
  rank: number | null
  currentUser: UserProfile | null
  onBack: () => void
  onEditProfile?: () => void
}

export default function PlayerProfile({ player, rank, currentUser, onBack, onEditProfile }: PlayerProfileProps) {
  const [bets,     setBets]     = useState<PublicBet[]>([])
  const [myBets,   setMyBets]   = useState<PublicBet[]>([])
  const [results,  setResults]  = useState<Map<string, MatchResult>>(new Map())
  const [ratings,  setRatings]  = useState<BetRating[]>([])
  const [comments, setComments] = useState<BetComment[]>([])
  const [reactions, setReactions] = useState<CommentReaction[]>([])
  const [loading,  setLoading]  = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [targetAdmin, setTargetAdmin] = useState(player.isAdmin)
  const [adminBusy, setAdminBusy] = useState(false)

  const isSelf = currentUser?.id === player.id

  const toggleAdmin = async () => {
    if (adminBusy) return
    setAdminBusy(true)
    const { error } = await setUserAdmin(player.id, !targetAdmin)
    if (error) alert(error); else setTargetAdmin(v => !v)
    setAdminBusy(false)
  }

  const loadSocial = useCallback(async () => {
    const [r, c] = await Promise.all([getRatings(player.id), getComments(player.id)])
    setRatings(r); setComments(c)
    setReactions(await getCommentReactions(c.map(x => x.id)))
  }, [player.id])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [b, res] = await Promise.all([getPublicBets(player.id), getResults()])
      if (!alive) return
      setBets(b)
      setResults(new Map(res.map(r => [r.matchId, r])))
      if (currentUser && currentUser.id !== player.id) setMyBets(await getPublicBets(currentUser.id))
      await loadSocial()
      if (alive) setLoading(false)
    })()
    const unsub = subscribeToPlayerSocial(player.id, loadSocial)
    return () => { alive = false; unsub() }
  }, [player.id, currentUser, loadSocial])

  // ── Stats (sur paris réglés) ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const settled = bets.filter(b => b.points !== null)
    const exact = settled.filter(b => b.points === 5).length
    const good  = settled.filter(b => b.points === 3).length
    const nul   = settled.filter(b => b.points === 1).length
    const hits  = exact + good + nul
    const pts   = settled.reduce((s, b) => s + (b.points ?? 0), 0)
    return {
      total: bets.length, settled: settled.length, exact, good, nul, pts,
      accuracy: settled.length ? Math.round((hits / settled.length) * 100) : 0,
    }
  }, [bets])

  // ── Face-à-face vs moi (matchs réglés communs) ────────────────────────────
  const h2h = useMemo(() => {
    if (isSelf || !currentUser) return null
    const mine = new Map(myBets.filter(b => b.points !== null).map(b => [b.matchId, b.points ?? 0]))
    let me = 0, them = 0, shared = 0
    for (const b of bets) {
      if (b.points === null || !mine.has(b.matchId)) continue
      shared++; them += b.points ?? 0; me += mine.get(b.matchId) ?? 0
    }
    return shared ? { shared, me, them } : null
  }, [bets, myBets, isSelf, currentUser])

  // ── Paris regroupés par phase / groupe ────────────────────────────────────
  const sections = useMemo(() => {
    const roundOrder: Record<string, number> = { r32: 100, r16: 101, qf: 102, sf: 103, '3rd': 104, final: 105 }
    const roundLabel: Record<string, string> = {
      r32: '16es de finale', r16: '8es de finale', qf: 'Quarts de finale',
      sf: 'Demi-finales', '3rd': 'Petite finale', final: 'Finale',
    }
    const sectionOf = (m: Match) =>
      m.round === 'group'
        ? { label: `Groupe ${m.group}`, order: m.group.charCodeAt(0) - 65 }
        : { label: roundLabel[m.round] ?? 'Phase finale', order: roundOrder[m.round] ?? 899 }

    const map = new Map<string, { label: string; order: number; bets: PublicBet[]; pts: number }>()
    for (const bet of bets) {
      const m = MATCH_BY_ID.get(bet.matchId)
      const { label, order } = m ? sectionOf(m) : { label: bet.stage || 'Autres', order: 900 }
      let sec = map.get(label)
      if (!sec) { sec = { label, order, bets: [], pts: 0 }; map.set(label, sec) }
      sec.bets.push(bet)
      sec.pts += bet.points ?? 0
    }
    const arr = [...map.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    const kt = (id: string) => { const m = MATCH_BY_ID.get(id); return parseUTC(m?.date, m?.time) ?? 0 }
    const md = (id: string) => MATCH_BY_ID.get(id)?.matchday ?? 0
    for (const sec of arr) sec.bets.sort((x, y) => md(x.matchId) - md(y.matchId) || kt(x.matchId) - kt(y.matchId))
    return arr
  }, [bets])

  // À l'arrivée sur la page, toutes les sections sont repliées (une seule fois).
  const initCollapsed = useRef(false)
  useEffect(() => {
    if (!loading && !initCollapsed.current && sections.length) {
      setCollapsed(new Set(sections.map(s => s.label)))
      initCollapsed.current = true
    }
  }, [loading, sections])

  const toggleSection = (label: string) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(label)) next.delete(label); else next.add(label)
    return next
  })

  const flagUrl = `https://flagcdn.com/w40/${player.countryCode}.png`

  return (
    <PageLayout onBack={onBack} backLabel="Classement" accentColor={GOLD}
      flag={<img src={flagUrl} alt={player.countryName}
        style={{ width: 26, height: 18, borderRadius: 3, objectFit: 'cover', border: '1px solid var(--border)' }} />}
      title={player.pseudo}
      subtitle={`${rank ? `#${rank} · ` : ''}${player.score.toLocaleString()} pts · ${player.countryName}`}>

      {/* Contenu centré au milieu, quelle que soit la largeur d'écran */}
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>

      {/* ── Modifier mon profil (soi-même) ── */}
      {isSelf && onEditProfile && (
        <button onClick={onEditProfile} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', marginBottom: 14, padding: '11px 14px', borderRadius: 12,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          color: 'var(--text-1)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
        }}>⚙️ Modifier mon profil</button>
      )}

      {/* ── Barre admin (visible par les admins, sur les autres joueurs) ── */}
      {currentUser?.isAdmin && !isSelf && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          padding: '10px 14px', borderRadius: 12,
          background: 'rgba(200,155,60,0.07)', border: '1px solid rgba(200,155,60,0.25)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
            {targetAdmin ? '👑 Administrateur' : 'Joueur standard'}
          </span>
          <button onClick={toggleAdmin} disabled={adminBusy} style={{
            marginLeft: 'auto', padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
            border: targetAdmin ? '1px solid rgba(239,68,68,0.3)' : 'none',
            background: targetAdmin ? 'rgba(239,68,68,0.08)' : 'linear-gradient(135deg,#C89B3C,#E8D080)',
            color: targetAdmin ? '#dc2626' : '#0D0800', fontSize: 12, fontWeight: 700,
            opacity: adminBusy ? 0.6 : 1,
          }}>{targetAdmin ? 'Retirer admin' : 'Promouvoir admin'}</button>
        </div>
      )}

      {/* ── Stats band ──────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16,
      }}>
        {([
          ['Pronos', stats.total, 'var(--text-1)'],
          ['Exacts', stats.exact, '#16a34a'],
          ['Bons', stats.good, GOLD],
          ['Réussite', `${stats.accuracy}%`, 'var(--text-1)'],
        ] as const).map(([label, val, color]) => (
          <div key={label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '10px 6px', textAlign: 'center', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 700, letterSpacing: 0.5,
              textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Face-à-face ─────────────────────────────────────────── */}
      {h2h && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', marginBottom: 16,
          background: 'linear-gradient(135deg, rgba(200,155,60,0.10), rgba(200,155,60,0.03))',
          border: '1px solid rgba(200,155,60,0.3)', borderRadius: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>
            Face-à-face<br /><span style={{ fontSize: 9, color: 'var(--text-3)' }}>{h2h.shared} match(s) commun(s)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Bebas Neue', cursive" }}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Vous</span>
            <span style={{ fontSize: 24, color: h2h.me >= h2h.them ? '#16a34a' : 'var(--text-2)' }}>{h2h.me}</span>
            <span style={{ fontSize: 14, color: 'var(--text-3)' }}>—</span>
            <span style={{ fontSize: 24, color: h2h.them > h2h.me ? '#16a34a' : 'var(--text-2)' }}>{h2h.them}</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 60, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.pseudo}</span>
          </div>
        </div>
      )}

      {/* ── Bets list ───────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontSize: 13 }}>Chargement…</div>
      ) : bets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎯</div>
          <div style={{ fontSize: 13 }}>{player.pseudo} n'a pas encore de pronostic.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sections.map(sec => {
            const isCollapsed = collapsed.has(sec.label)
            return (
              <div key={sec.label}>
                <button onClick={() => toggleSection(sec.label)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 12px', marginBottom: 8, cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(200,155,60,0.12), rgba(200,155,60,0.03))',
                  border: '1px solid rgba(200,155,60,0.3)', borderRadius: 10,
                }}>
                  <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 16, letterSpacing: 0.5, color: GOLD }}>
                    {sec.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)' }}>
                    {sec.bets.length} prono{sec.bets.length > 1 ? 's' : ''}
                  </span>
                  {sec.pts > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#16a34a' }}>+{sec.pts} pts</span>
                  )}
                  <span style={{ marginLeft: 'auto', color: GOLD, fontSize: 11 }}>{isCollapsed ? '▼' : '▲'}</span>
                </button>
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sec.bets.map(bet => (
                      <BetSocialCard
                        key={bet.id}
                        bet={bet}
                        match={MATCH_BY_ID.get(bet.matchId)}
                        result={results.get(bet.matchId)}
                        ratings={ratings.filter(r => r.matchId === bet.matchId)}
                        comments={comments.filter(c => c.matchId === bet.matchId)}
                        reactions={reactions}
                        currentUser={currentUser}
                        isSelf={isSelf}
                        targetUserId={player.id}
                        onChanged={loadSocial}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      </div>
    </PageLayout>
  )
}

// ─── Bet card with rating + comments ─────────────────────────────────────────
interface BetSocialCardProps {
  bet: PublicBet
  match?: Match
  result?: MatchResult
  ratings: BetRating[]
  comments: BetComment[]
  reactions: CommentReaction[]
  currentUser: UserProfile | null
  isSelf: boolean
  targetUserId: string
  onChanged: () => void
}

function BetSocialCard({
  bet, match, result, ratings, comments, reactions, currentUser, isSelf, targetUserId, onChanged,
}: BetSocialCardProps) {
  const [open, setOpen]   = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy]   = useState(false)
  const [err,  setErr]    = useState('')

  const homeName = match?.home.name ?? bet.home
  const awayName = match?.away.name ?? bet.away
  const homeFlag = match ? `https://flagcdn.com/w20/${match.home.code}.png` : null
  const awayFlag = match ? `https://flagcdn.com/w20/${match.away.code}.png` : null

  const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0
  const myRating = currentUser ? ratings.find(r => r.raterId === currentUser.id)?.rating ?? 0 : 0
  const pts = bet.points

  const rate = async (n: number) => {
    if (!currentUser || isSelf || busy) return
    setBusy(true); setErr('')
    const { error } = await rateBet(targetUserId, bet.matchId, currentUser.id, n)
    if (error) setErr(error)
    await onChanged()
    setBusy(false)
  }
  const react = async (commentId: string, value: 1 | -1, mine: number) => {
    if (!currentUser || busy) return
    setBusy(true)
    if (mine === value) await unreactToComment(commentId, currentUser.id)
    else await reactToComment(commentId, currentUser.id, value)
    await onChanged()
    setBusy(false)
  }
  const send = async () => {
    if (!currentUser || !draft.trim() || busy) return
    setBusy(true)
    const { error } = await addComment(targetUserId, bet.matchId, currentUser.id, currentUser.pseudo, draft)
    if (!error) { setDraft(''); await onChanged() }
    setBusy(false)
  }
  const remove = async (id: string) => { setBusy(true); await deleteComment(id); await onChanged(); setBusy(false) }

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
    }}>
      {/* Row : teams + prediction */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
            fontWeight: 700, color: 'var(--text-1)' }}>
            {homeFlag && <img src={homeFlag} alt="" style={{ width: 18, height: 12, borderRadius: 2, objectFit: 'cover' }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeName}</span>
            <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>vs</span>
            {awayFlag && <img src={awayFlag} alt="" style={{ width: 18, height: 12, borderRadius: 2, objectFit: 'cover' }} />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayName}</span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 3, letterSpacing: 0.3 }}>
            {bet.stage} · {kickoffLabel(match)}
          </div>
        </div>

        {/* Prediction / masked */}
        {bet.revealed ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, color: 'var(--text-1)', lineHeight: 1 }}>
              {bet.homeScore}<span style={{ color: 'var(--text-3)' }}>:</span>{bet.awayScore}
            </div>
            {result && (
              <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>
                réel {result.homeScore}:{result.awayScore}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right', maxWidth: 96 }}>
            🔒 Caché<br />jusqu'au coup d'envoi
          </div>
        )}

        {/* Points badge */}
        {pts !== null && (
          <div style={{
            minWidth: 30, textAlign: 'center', padding: '3px 6px', borderRadius: 8,
            fontFamily: "'Bebas Neue', cursive", fontSize: 16,
            background: pts === 5 ? 'rgba(34,197,94,0.14)' : pts >= 3 ? 'rgba(200,155,60,0.14)' : 'rgba(110,110,115,0.1)',
            border: `1px solid ${pts === 5 ? 'rgba(34,197,94,0.35)' : pts >= 3 ? 'rgba(200,155,60,0.3)' : 'rgba(110,110,115,0.2)'}`,
            color: pts === 5 ? '#16a34a' : pts >= 3 ? '#A07828' : 'var(--text-3)',
          }}>+{pts}</div>
        )}
      </div>

      {/* Rating + comment toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
        borderTop: '1px solid var(--border)', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)' }}>
          {currentUser && !isSelf ? 'Noter :' : 'Note reçue :'}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const showVal   = currentUser && !isSelf ? myRating : Math.round(avg)
            const filled    = showVal >= n
            const clickable = !!currentUser && !isSelf
            return (
              <span key={n}
                onClick={() => rate(n)}
                title={clickable ? `Noter ${n}/5` : undefined}
                style={{
                  fontSize: 18, lineHeight: 1,
                  cursor: clickable ? 'pointer' : 'default',
                  color: filled ? GOLD : 'var(--text-3)', opacity: filled ? 1 : 0.6,
                }}>{filled ? '★' : '☆'}</span>
            )
          })}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {ratings.length ? `${avg.toFixed(1)} (${ratings.length})` : '—'}
        </span>

        <button onClick={() => setOpen(o => !o)} style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, color: GOLD,
        }}>
          💬 {comments.length}{open ? ' ▲' : ' ▼'}
        </button>
      </div>

      {/* Rating feedback */}
      {err && (
        <div style={{ padding: '0 14px 8px', fontSize: 11, color: '#dc2626', wordBreak: 'break-word' }}>{err}</div>
      )}
      {isSelf && (
        <div style={{ padding: '0 14px 8px', fontSize: 10, color: 'var(--text-3)' }}>
          Vous ne pouvez pas noter vos propres pronostics.
        </div>
      )}

      {/* Comments thread */}
      {open && (
        <div style={{ padding: '4px 14px 12px', borderTop: '1px solid var(--border)' }}>
          {comments.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '8px 0' }}>Aucun commentaire — soyez le premier.</div>
          )}
          {comments.map(c => {
            const likes    = reactions.filter(r => r.commentId === c.id && r.value === 1).length
            const dislikes = reactions.filter(r => r.commentId === c.id && r.value === -1).length
            const mine     = currentUser ? reactions.find(r => r.commentId === c.id && r.userId === currentUser.id)?.value ?? 0 : 0
            return (
              <div key={c.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>{c.authorPseudo}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-1)', marginLeft: 6, wordBreak: 'break-word' }}>{c.body}</span>
                  </div>
                  {currentUser?.id === c.authorId && (
                    <button onClick={() => remove(c.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 12,
                    }}>✕</button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 14, marginTop: 5 }}>
                  <button onClick={() => react(c.id, 1, mine)} disabled={!currentUser || busy} style={{
                    background: 'none', border: 'none', cursor: currentUser ? 'pointer' : 'default',
                    fontSize: 12, fontWeight: 700, padding: 0,
                    color: mine === 1 ? '#16a34a' : 'var(--text-3)',
                  }}>👍 {likes}</button>
                  <button onClick={() => react(c.id, -1, mine)} disabled={!currentUser || busy} style={{
                    background: 'none', border: 'none', cursor: currentUser ? 'pointer' : 'default',
                    fontSize: 12, fontWeight: 700, padding: 0,
                    color: mine === -1 ? '#dc2626' : 'var(--text-3)',
                  }}>👎 {dislikes}</button>
                </div>
              </div>
            )
          })}

          {currentUser ? (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                maxLength={280}
                placeholder="Votre commentaire…"
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 10,
                  border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-1)',
                  fontSize: 13, outline: 'none',
                }} />
              <button onClick={send} disabled={busy || !draft.trim()} style={{
                padding: '8px 14px', borderRadius: 10, border: 'none',
                background: draft.trim() ? 'linear-gradient(135deg,#C89B3C,#E8D080)' : 'var(--border)',
                color: draft.trim() ? '#0D0800' : 'var(--text-3)', fontWeight: 700, fontSize: 13,
                cursor: draft.trim() ? 'pointer' : 'default',
              }}>Envoyer</button>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>Connectez-vous pour commenter.</div>
          )}
        </div>
      )}
    </div>
  )
}
