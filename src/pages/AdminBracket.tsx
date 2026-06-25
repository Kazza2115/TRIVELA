import { useState, useEffect, useMemo, useCallback } from 'react'
import PageLayout from './PageLayout'
import { KNOCKOUT_MATCHES, ALL_TEAMS, teamByShort, matchKickoffUTC } from '../data/wc2026Matches'
import type { Match, Team } from '../data/wc2026Matches'
import { getKnockoutTeams, adminSetKnockout, pingLiveWorker } from '../services/auth'
import type { UserProfile } from '../services/auth'

const GOLD = '#C89B3C'
const KO_LABELS: Record<string, string> = {
  r32: 'Tour des 32', r16: 'Huitièmes', qf: 'Quarts', sf: 'Demi-finales', '3rd': '3e place', final: 'Finale',
}
const ROUND_ORDER: { key: string; label: string }[] = [
  { key: 'r32', label: 'Tour des 32' }, { key: 'r16', label: 'Huitièmes' },
  { key: 'qf', label: 'Quarts' }, { key: 'sf', label: 'Demi-finales' },
  { key: '3rd', label: '3e place' }, { key: 'final', label: 'Finale' },
]
function fmtDateTime(m: Match): string {
  const k = matchKickoffUTC(m)
  if (k == null) return ''
  return new Date(k).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })
}

type Assign = { home: string | null; away: string | null; source?: string }

export default function AdminBracket({ onBack, currentUser }: {
  onBack: () => void
  currentUser: UserProfile | null
}) {
  const [assign, setAssign] = useState<Record<string, Assign>>({})
  const [open, setOpen] = useState<string | null>(null)   // clé "matchId:side" du sélecteur ouvert
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    getKnockoutTeams().then(rows => {
      const next: Record<string, Assign> = {}
      for (const [id, r] of Object.entries(rows)) next[id] = { home: r.home_short, away: r.away_short, source: r.source }
      setAssign(next)
    })
  }, [])
  useEffect(() => { if (currentUser?.isAdmin) load() }, [currentUser, load])

  const byRound = useMemo(() => {
    const g: Record<string, Match[]> = {}
    for (const m of KNOCKOUT_MATCHES) (g[m.round as string] ||= []).push(m)
    return g
  }, [])

  const save = async (matchId: string, home: string | null, away: string | null) => {
    setSaving(matchId); setMsg(null)
    // MAJ optimiste.
    setAssign(prev => ({ ...prev, [matchId]: { home, away, source: 'admin' } }))
    const { error } = await adminSetKnockout({ matchId, homeShort: home, awayShort: away })
    setSaving(null)
    if (error) { setMsg({ ok: false, text: error }); load() }
    else setMsg({ ok: true, text: 'Affiche enregistrée.' })
  }

  const pick = (matchId: string, side: 'home' | 'away', short: string | null) => {
    const cur = assign[matchId] ?? { home: null, away: null }
    const next = side === 'home' ? { home: short, away: cur.away } : { home: cur.home, away: short }
    setOpen(null); setQuery('')
    save(matchId, next.home, next.away)
  }

  const refreshFromApi = async () => {
    setRefreshing(true); setMsg(null)
    pingLiveWorker()   // force un passage du worker → auto-remplissage depuis l'API
    setTimeout(() => { load(); setRefreshing(false); setMsg({ ok: true, text: 'Bracket resynchronisé depuis l’API.' }) }, 4000)
  }

  if (!currentUser?.isAdmin) {
    return (
      <PageLayout onBack={onBack} accentColor={GOLD} flag="🏆" title="BRACKET" subtitle="Réservé aux administrateurs">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 40 }}>🔒</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Accès réservé aux administrateurs</div>
        </div>
      </PageLayout>
    )
  }

  const filtered = query.trim()
    ? ALL_TEAMS.filter(t => t.name.toLowerCase().includes(query.trim().toLowerCase()) || t.short.toLowerCase().includes(query.trim().toLowerCase()))
    : ALL_TEAMS

  return (
    <PageLayout onBack={onBack} accentColor={GOLD} flag="🏆" title="COMPOSER LE BRACKET" subtitle="Affecter les équipes aux phases éliminatoires">
      <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, padding: '11px 14px', marginBottom: 14,
        background: 'rgba(200,155,60,0.07)', border: '1px solid rgba(200,155,60,0.25)', borderRadius: 12 }}>
        Le bracket se remplit <b>automatiquement depuis l'API</b> au fil des qualifications.
        Ici, vous pouvez fixer ou corriger une affiche à la main — un choix manuel est <b>prioritaire</b> et
        ne sera plus écrasé par l'API. Laissez « — » pour rendre la main à l'API.
      </div>

      <button onClick={refreshFromApi} disabled={refreshing} style={{
        width: '100%', marginBottom: 18, padding: '10px 0', borderRadius: 10, border: `1px solid ${GOLD}`,
        background: refreshing ? 'var(--bg-fill)' : 'rgba(200,155,60,0.12)', color: '#A07828',
        fontSize: 12, fontWeight: 800, letterSpacing: 0.3, cursor: refreshing ? 'default' : 'pointer',
      }}>{refreshing ? 'Synchronisation…' : '⟳ Rafraîchir depuis l’API'}</button>

      {ROUND_ORDER.map(({ key, label }) => {
        const list = byRound[key]
        if (!list?.length) return null
        return (
          <div key={key} style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 16, letterSpacing: 1.4, color: '#A07828', marginBottom: 10 }}>
              {label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {list.map(m => {
                const a = assign[m.id] ?? { home: null, away: null }
                const isApi = a.source === 'api'
                return (
                  <div key={m.id} style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--bg-card)',
                    border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{KO_LABELS[m.round as string]} · {fmtDateTime(m)}</span>
                      {(a.home || a.away) && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                          background: isApi ? 'rgba(91,141,239,0.14)' : 'rgba(200,155,60,0.16)',
                          color: isApi ? '#5B8DEF' : '#A07828' }}>{isApi ? 'auto (API)' : 'manuel'}</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
                      <TeamSelect open={open === `${m.id}:home`} short={a.home}
                        onToggle={() => { setOpen(o => o === `${m.id}:home` ? null : `${m.id}:home`); setQuery('') }}
                        onPick={s => pick(m.id, 'home', s)} filtered={filtered} query={query} setQuery={setQuery} />
                      <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, color: 'var(--text-3)' }}>vs</span>
                      <TeamSelect open={open === `${m.id}:away`} short={a.away} align="right"
                        onToggle={() => { setOpen(o => o === `${m.id}:away` ? null : `${m.id}:away`); setQuery('') }}
                        onPick={s => pick(m.id, 'away', s)} filtered={filtered} query={query} setQuery={setQuery} />
                    </div>
                    {saving === m.id && <div style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 8 }}>Enregistrement…</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {msg && (
        <div style={{ position: 'sticky', bottom: 12, marginTop: 4, fontSize: 12, fontWeight: 700, textAlign: 'center',
          padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-sm)', color: msg.ok ? '#16a34a' : '#dc2626' }}>
          {msg.ok ? '✓ ' : '⚠️ '}{msg.text}
        </div>
      )}
    </PageLayout>
  )
}

function TeamSelect({ open, short, align, onToggle, onPick, filtered, query, setQuery }: {
  open: boolean; short: string | null; align?: 'right'
  onToggle: () => void; onPick: (short: string | null) => void
  filtered: Team[]; query: string; setQuery: (q: string) => void
}) {
  const team = teamByShort(short)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 7,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        padding: '9px 11px', borderRadius: 11, cursor: 'pointer',
        background: 'var(--bg-fill)', border: `1px solid ${open ? GOLD : 'var(--border)'}`,
      }}>
        {team ? (
          <>
            <img src={`https://flagcdn.com/w20/${team.code}.png`} alt="" style={flagStyle} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{team.short}</span>
          </>
        ) : <span style={{ fontSize: 13, color: 'var(--text-3)' }}>— choisir —</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40, maxHeight: 300, overflowY: 'auto',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.25)', padding: 6 }}>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une équipe…"
            style={{ width: '100%', padding: '8px 10px', marginBottom: 6, borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-fill)', color: 'var(--text-1)', fontSize: 13, boxSizing: 'border-box' }} />
          <button onClick={() => onPick(null)} style={rowStyle(false)}>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>— (TBD / rendre à l'API)</span>
          </button>
          {filtered.map(t => (
            <button key={t.short} onClick={() => onPick(t.short)} style={rowStyle(t.short === short)}>
              <img src={`https://flagcdn.com/w20/${t.code}.png`} alt="" style={flagStyle} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{t.name} <span style={{ color: 'var(--text-3)' }}>· {t.short}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const flagStyle: React.CSSProperties = { width: 22, height: 15, borderRadius: 3, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }

function rowStyle(on: boolean): React.CSSProperties {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 10,
    cursor: 'pointer', textAlign: 'left', background: on ? 'rgba(200,155,60,0.12)' : 'transparent',
    border: `1px solid ${on ? 'rgba(200,155,60,0.3)' : 'transparent'}`,
  }
}
