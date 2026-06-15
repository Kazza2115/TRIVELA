import { useState, useEffect, useMemo, useCallback } from 'react'
import PageLayout from './PageLayout'
import { GROUP_MATCHES, KNOCKOUT_MATCHES, matchKickoffUTC } from '../data/wc2026Matches'
import type { Match } from '../data/wc2026Matches'
import { getMentionables, getResults, adminGetBet, adminSetBet } from '../services/auth'
import type { UserProfile } from '../services/auth'

const GOLD = '#C89B3C'
const KO_LABELS: Record<string, string> = {
  r32: 'Tour des 32', r16: 'Huitièmes', qf: 'Quarts', sf: 'Demi-finales', '3rd': '3e place', final: 'Finale',
}
const stageLabel = (m: Match) => m.round === 'group' ? `Groupe ${m.group} · J${m.matchday}` : KO_LABELS[m.round as string] ?? m.group
function fmtDateTime(m: Match): string {
  const k = matchKickoffUTC(m)
  if (k == null) return ''
  return new Date(k).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })
}

interface Player { id: string; pseudo: string; countryCode: string }

export default function AdminBets({ onBack, currentUser }: {
  onBack: () => void
  currentUser: UserProfile | null
}) {
  const [players, setPlayers] = useState<Player[]>([])
  const [settled, setSettled] = useState<Set<string>>(new Set())
  const [selPlayer, setSelPlayer] = useState<Player | null>(null)
  const [selMatchId, setSelMatchId] = useState<string>('')
  const [score, setScore] = useState<{ home: number; away: number }>({ home: 0, away: 0 })
  const [existing, setExisting] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [matchOpen, setMatchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!currentUser?.isAdmin) return
    getMentionables().then(ps => setPlayers(ps.sort((a, b) => a.pseudo.localeCompare(b.pseudo, 'fr', { sensitivity: 'base' }))))
    getResults().then(rs => setSettled(new Set(rs.map(r => r.matchId))))
  }, [currentUser])

  // Matchs éditables : équipes connues + non encore réglés, triés par coup d'envoi.
  const matches = useMemo(() => [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]
    .filter(m => m.home.code !== 'un' && m.away.code !== 'un' && !settled.has(m.id))
    .sort((a, b) => (matchKickoffUTC(a) ?? 0) - (matchKickoffUTC(b) ?? 0)), [settled])

  const match = matches.find(m => m.id === selMatchId) ?? null

  // Pré-remplit le score à partir du prono existant (ou 0-0).
  const loadExisting = useCallback(() => {
    if (!selPlayer || !selMatchId) return
    adminGetBet(selPlayer.id, selMatchId).then(b => {
      setScore(b ? { home: b.home, away: b.away } : { home: 0, away: 0 })
      setExisting(!!b)
    })
  }, [selPlayer, selMatchId])
  useEffect(() => { loadExisting() }, [loadExisting])

  const filtered = query.trim()
    ? players.filter(p => p.pseudo.toLowerCase().includes(query.trim().toLowerCase()))
    : players

  const save = async () => {
    if (!selPlayer || !match) return
    setSaving(true); setMsg(null)
    const { error } = await adminSetBet({
      userId: selPlayer.id, matchId: match.id,
      home: match.home.name, away: match.away.name,
      homeScore: score.home, awayScore: score.away,
      stage: stageLabel(match),
    })
    setSaving(false)
    if (error) setMsg({ ok: false, text: error })
    else { setMsg({ ok: true, text: `Pronostic enregistré pour ${selPlayer.pseudo} : ${match.home.short} ${score.home}–${score.away} ${match.away.short}` }); setExisting(true) }
  }

  if (!currentUser?.isAdmin) {
    return (
      <PageLayout onBack={onBack} accentColor={GOLD} flag="✏️" title="ÉDITER PRONOS" subtitle="Réservé aux administrateurs">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 40 }}>🔒</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Accès réservé aux administrateurs</div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout onBack={onBack} accentColor={GOLD} flag="✏️" title="ÉDITER PRONOS" subtitle="Saisir / corriger le pronostic d'un joueur">
      <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, padding: '11px 14px', marginBottom: 16,
        background: 'rgba(200,155,60,0.07)', border: '1px solid rgba(200,155,60,0.25)', borderRadius: 12 }}>
        Permet d'ajouter ou corriger le pronostic d'un joueur (ex. oubli avant le blocage). Le verrou de temps est ignoré,
        mais un match <b>déjà joué</b> ne peut pas être modifié.
      </div>

      {/* ── Joueur ─────────────────────────────────────────────── */}
      <Label>Joueur</Label>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Picker onClick={() => setPlayerOpen(o => !o)} open={playerOpen}>
          {selPlayer ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={`https://flagcdn.com/w20/${selPlayer.countryCode}.png`} alt="" style={flagStyle} />
              <b style={{ fontSize: 14, color: 'var(--text-1)' }}>{selPlayer.pseudo}</b>
            </span>
          ) : <span style={{ color: 'var(--text-3)' }}>Choisir un joueur</span>}
        </Picker>
        {playerOpen && (
          <Dropdown>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher…"
              style={{ width: '100%', padding: '8px 10px', marginBottom: 6, borderRadius: 8, border: '1px solid var(--border)',
                background: 'var(--bg-fill)', color: 'var(--text-1)', fontSize: 13, boxSizing: 'border-box' }} />
            {filtered.map(p => (
              <button key={p.id} onClick={() => { setSelPlayer(p); setPlayerOpen(false); setQuery(''); setMsg(null) }} style={rowStyle(p.id === selPlayer?.id)}>
                <img src={`https://flagcdn.com/w20/${p.countryCode}.png`} alt="" style={flagStyle} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{p.pseudo}</span>
              </button>
            ))}
            {filtered.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 8 }}>Aucun joueur.</div>}
          </Dropdown>
        )}
      </div>

      {/* ── Match ──────────────────────────────────────────────── */}
      <Label>Match (non joué)</Label>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Picker onClick={() => setMatchOpen(o => !o)} open={matchOpen}>
          {match ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={`https://flagcdn.com/w20/${match.home.code}.png`} alt="" style={flagStyle} />
              <img src={`https://flagcdn.com/w20/${match.away.code}.png`} alt="" style={flagStyle} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{match.home.short} – {match.away.short}</span>
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>· {fmtDateTime(match)}</span>
            </span>
          ) : <span style={{ color: 'var(--text-3)' }}>Choisir un match</span>}
        </Picker>
        {matchOpen && (
          <Dropdown>
            {matches.map(m => (
              <button key={m.id} onClick={() => { setSelMatchId(m.id); setMatchOpen(false); setMsg(null) }} style={rowStyle(m.id === selMatchId)}>
                <img src={`https://flagcdn.com/w20/${m.home.code}.png`} alt="" style={flagStyle} />
                <img src={`https://flagcdn.com/w20/${m.away.code}.png`} alt="" style={flagStyle} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{m.home.short} – {m.away.short}</span>
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--text-3)' }}>{stageLabel(m)} · {fmtDateTime(m)}</span>
                </span>
              </button>
            ))}
            {matches.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-3)', padding: 8 }}>Aucun match éditable.</div>}
          </Dropdown>
        )}
      </div>

      {/* ── Score ──────────────────────────────────────────────── */}
      {selPlayer && match && (
        <div style={{ padding: '16px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          {existing && <div style={{ fontSize: 10, color: '#A07828', fontWeight: 700, marginBottom: 10, textAlign: 'center' }}>Pronostic existant — sera corrigé</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
            <Side code={match.home.code} short={match.home.short} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Stepper value={score.home} onChange={v => setScore(s => ({ ...s, home: v }))} />
              <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 24, color: 'var(--text-3)' }}>:</span>
              <Stepper value={score.away} onChange={v => setScore(s => ({ ...s, away: v }))} />
            </div>
            <Side code={match.away.code} short={match.away.short} right />
          </div>

          <button onClick={save} disabled={saving} style={{
            width: '100%', marginTop: 16, padding: '11px 0', borderRadius: 10, border: 'none',
            background: saving ? 'var(--bg-fill)' : 'linear-gradient(135deg,#C89B3C,#E8D080)',
            color: saving ? 'var(--text-3)' : '#0D0800', fontSize: 13, fontWeight: 800, letterSpacing: 0.4,
            cursor: saving ? 'default' : 'pointer', boxShadow: saving ? 'none' : '0 2px 8px rgba(200,155,60,0.35)',
          }}>{saving ? 'Enregistrement…' : `Enregistrer le pronostic`}</button>

          {msg && (
            <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, lineHeight: 1.5, textAlign: 'center',
              color: msg.ok ? '#16a34a' : '#dc2626' }}>
              {msg.ok ? '✓ ' : '⚠️ '}{msg.text}
            </div>
          )}
        </div>
      )}
    </PageLayout>
  )
}

const flagStyle: React.CSSProperties = { width: 22, height: 15, borderRadius: 3, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-3)', textTransform: 'uppercase', padding: '0 2px 6px' }}>{children}</div>
}

function Picker({ children, onClick, open }: { children: React.ReactNode; onClick: () => void; open: boolean }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '12px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
      background: 'var(--bg-card)', border: `1px solid ${open ? GOLD : 'var(--border)'}`, boxShadow: 'var(--shadow-sm)',
    }}>
      {children}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}><path d="M9 18l6-6-6-6" /></svg>
    </button>
  )
}

function Dropdown({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40, maxHeight: 320, overflowY: 'auto',
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', padding: 6 }}>
      {children}
    </div>
  )
}

function rowStyle(on: boolean): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10,
    cursor: 'pointer', textAlign: 'left', background: on ? 'rgba(200,155,60,0.12)' : 'transparent',
    border: `1px solid ${on ? 'rgba(200,155,60,0.3)' : 'transparent'}`,
  }
}

function Side({ code, short, right }: { code: string; short: string; right?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, order: right ? 2 : 0 }}>
      <img src={`https://flagcdn.com/w40/${code}.png`} alt="" style={{ width: 40, height: 27, borderRadius: 4, objectFit: 'cover', border: '1px solid var(--border)' }} />
      <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 16, letterSpacing: 1, color: 'var(--text-1)' }}>{short}</span>
    </div>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const btn: React.CSSProperties = {
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-fill)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)',
    fontSize: 18, fontWeight: 700, lineHeight: 1, padding: 0, cursor: 'pointer', userSelect: 'none',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <button style={btn} onClick={() => onChange(value + 1)}>+</button>
      <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, color: 'var(--text-1)', lineHeight: 1, minWidth: 22, textAlign: 'center' }}>{value}</span>
      <button style={btn} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
    </div>
  )
}
