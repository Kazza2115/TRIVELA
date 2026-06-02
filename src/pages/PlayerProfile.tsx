import { useState, useEffect, useMemo, useCallback } from 'react'
import PageLayout from './PageLayout'
import { ALL_MATCHES } from '../data/wc2026Matches'
import type { Match } from '../data/wc2026Matches'
import {
  getPublicBets, getResults, getRatings, getComments,
  rateBet, addComment, deleteComment, subscribeToPlayerSocial,
} from '../services/auth'
import type {
  UserProfile, PublicBet, MatchResult, BetRating, BetComment,
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
}

export default function PlayerProfile({ player, rank, currentUser, onBack }: PlayerProfileProps) {
  const [bets,     setBets]     = useState<PublicBet[]>([])
  const [myBets,   setMyBets]   = useState<PublicBet[]>([])
  const [results,  setResults]  = useState<Map<string, MatchResult>>(new Map())
  const [ratings,  setRatings]  = useState<BetRating[]>([])
  const [comments, setComments] = useState<BetComment[]>([])
  const [loading,  setLoading]  = useState(true)

  const isSelf = currentUser?.id === player.id

  const loadSocial = useCallback(async () => {
    const [r, c] = await Promise.all([getRatings(player.id), getComments(player.id)])
    setRatings(r); setComments(c)
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

  const flagUrl = `https://flagcdn.com/w40/${player.countryCode}.png`

  return (
    <PageLayout onBack={onBack} backLabel="Classement" accentColor={GOLD}
      flag={<img src={flagUrl} alt={player.countryName}
        style={{ width: 26, height: 18, borderRadius: 3, objectFit: 'cover', border: '1px solid var(--border)' }} />}
      title={player.pseudo}
      subtitle={`${rank ? `#${rank} · ` : ''}${player.score.toLocaleString()} pts · ${player.countryName}`}>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bets.map(bet => (
            <BetSocialCard
              key={bet.id}
              bet={bet}
              match={MATCH_BY_ID.get(bet.matchId)}
              result={results.get(bet.matchId)}
              ratings={ratings.filter(r => r.matchId === bet.matchId)}
              comments={comments.filter(c => c.matchId === bet.matchId)}
              currentUser={currentUser}
              isSelf={isSelf}
              targetUserId={player.id}
              onChanged={loadSocial}
            />
          ))}
        </div>
      )}
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
  currentUser: UserProfile | null
  isSelf: boolean
  targetUserId: string
  onChanged: () => void
}

function BetSocialCard({
  bet, match, result, ratings, comments, currentUser, isSelf, targetUserId, onChanged,
}: BetSocialCardProps) {
  const [open, setOpen]   = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy]   = useState(false)

  const homeName = match?.home.name ?? bet.home
  const awayName = match?.away.name ?? bet.away
  const homeFlag = match ? `https://flagcdn.com/w20/${match.home.code}.png` : null
  const awayFlag = match ? `https://flagcdn.com/w20/${match.away.code}.png` : null

  const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0
  const myRating = currentUser ? ratings.find(r => r.raterId === currentUser.id)?.rating ?? 0 : 0
  const pts = bet.points

  const rate = async (n: number) => {
    if (!currentUser || isSelf || busy) return
    setBusy(true)
    await rateBet(targetUserId, bet.matchId, currentUser.id, n)
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
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4, 5].map(n => {
            const filled = (currentUser && !isSelf ? myRating : Math.round(avg)) >= n
            return (
              <span key={n}
                onClick={() => rate(n)}
                style={{
                  fontSize: 15, lineHeight: 1,
                  cursor: currentUser && !isSelf ? 'pointer' : 'default',
                  color: filled ? GOLD : 'var(--text-3)', opacity: filled ? 1 : 0.4,
                }}>★</span>
            )
          })}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
          {ratings.length ? `${avg.toFixed(1)} (${ratings.length})` : 'Pas de note'}
        </span>

        <button onClick={() => setOpen(o => !o)} style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, color: GOLD,
        }}>
          💬 {comments.length}{open ? ' ▲' : ' ▼'}
        </button>
      </div>

      {/* Comments thread */}
      {open && (
        <div style={{ padding: '4px 14px 12px', borderTop: '1px solid var(--border)' }}>
          {comments.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', padding: '8px 0' }}>Aucun commentaire — soyez le premier.</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
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
          ))}

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
