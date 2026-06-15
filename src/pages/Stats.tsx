import { useState, useEffect, useCallback } from 'react'
import PageLayout from './PageLayout'
import { getAdminStats } from '../services/auth'
import type { UserProfile, AdminStats, StatBucket, StatPoint } from '../services/auth'

const GOLD = '#C89B3C'

const EVENT_LABELS: Record<string, string> = {
  '$pageview': 'Pages vues', nav_click: 'Navigation', chat_open: 'Chat ouvert',
  chat_message: 'Message chat', bet_placed: 'Pari placé', trends_open: 'Tendances',
  competition_open: 'Compétition', live_click: 'Clic « EN DIRECT »', auth_open: 'Connexion (ouverture)',
  notifications_open: 'Notifications',
}
const PATH_LABELS: Record<string, string> = {
  globe: 'Accueil (Globe)', paris: 'Paris', classement: 'Classement', actualites: 'Actualités',
  competition: 'Compétition', tendances: 'Tendances', chat: 'Chat', stats: 'Statistiques',
}
const eventLabel = (e: string) => EVENT_LABELS[e] ?? e
const pathLabel  = (p: string) => PATH_LABELS[p] ?? p

const PERIODS: { days: number; label: string }[] = [
  { days: 7, label: '7 j' }, { days: 30, label: '30 j' }, { days: 90, label: '90 j' }, { days: 365, label: '1 an' },
]

// "YYYY-MM-DD" → Date (UTC).
const parseBucket = (s: string) => new Date(s + 'T00:00:00Z')
const axisLabel = (s: string) => { const d = parseBucket(s); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}` }
function fullLabel(s: string, bucket: StatBucket): string {
  const d = parseBucket(s)
  if (bucket === 'week') return `Semaine du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
}

export default function Stats({ onBack, currentUser }: {
  onBack: () => void
  currentUser: UserProfile | null
}) {
  const [days, setDays] = useState(30)
  const [bucket, setBucket] = useState<StatBucket>('day')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback((d: number, b: StatBucket) => {
    setLoading(true); setError(null)
    getAdminStats(d, b)
      .then(({ stats, error }) => { if (error) setError(error); else setStats(stats ?? null) })
      .catch(() => setError('Erreur réseau.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (currentUser?.isAdmin) load(days, bucket); else setLoading(false) }, [currentUser, days, bucket, load])

  if (!currentUser?.isAdmin) {
    return (
      <PageLayout onBack={onBack} accentColor={GOLD} flag="📈" title="STATISTIQUES" subtitle="Réservé aux administrateurs">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 40 }}>🔒</span>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Accès réservé aux administrateurs</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Cette page n'est visible que par les admins de Trivela.</div>
        </div>
      </PageLayout>
    )
  }

  const periodLabel = PERIODS.find(p => p.days === days)?.label ?? `${days} j`

  return (
    <PageLayout onBack={onBack} accentColor={GOLD} flag="📈" title="STATISTIQUES" subtitle="Vue d'ensemble · trivela.ch">

      {/* ── Contrôles : période + granularité ───────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Segmented options={PERIODS.map(p => ({ key: String(p.days), label: p.label }))}
          value={String(days)} onChange={k => setDays(Number(k))} />
        <Segmented options={[{ key: 'day', label: 'Jour' }, { key: 'week', label: 'Semaine' }]}
          value={bucket} onChange={k => setBucket(k as StatBucket)} />
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '20px 4px' }}>Chargement…</div>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', borderRadius: 14,
          background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.3)' }}>
          <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700 }}>Impossible de charger les statistiques</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{error}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Vérifie que <b>db-admin-stats.sql</b> est bien appliqué dans Supabase.
          </div>
          <button onClick={() => load(days, bucket)} style={btnStyle}>↻ Réessayer</button>
        </div>
      ) : stats ? (
        <>
          {/* ── KPIs fenêtre ─────────────────────────────────────── */}
          <SectionTitle>Sur {periodLabel === '1 an' ? '1 an' : `les ${periodLabel}`}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
            <Kpi label="Visiteurs uniques" value={stats.visitorsWindow} accent={GOLD} />
            <Kpi label="Sessions" value={stats.sessionsWindow} />
            <Kpi label="Actions / évènements" value={stats.eventsWindow} />
            <Kpi label="Pronostics placés" value={stats.betsWindow} accent="#16a34a" />
          </div>

          {/* ── Graphe interactif (cliquable) ────────────────────── */}
          <Card title={`Visiteurs par ${bucket === 'week' ? 'semaine' : 'jour'}`} subtitle="Touchez une barre pour le détail">
            <InteractiveChart series={stats.series} bucket={bucket} />
          </Card>

          {/* ── KPIs globaux ─────────────────────────────────────── */}
          <SectionTitle>Global (depuis le début)</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
            <Kpi label="Visiteurs uniques" value={stats.visitorsTotal} accent={GOLD} />
            <Kpi label="Actifs aujourd'hui" value={stats.activeToday} accent="#16a34a" />
            <Kpi label="Joueurs inscrits" value={stats.players} />
            <Kpi label="Pronostics (total)" value={stats.bets} />
            <Kpi label="Évènements (total)" value={stats.eventsTotal} />
            <Kpi label="Rétention J+1" value={stats.retentionD1 == null ? '—' : `${stats.retentionD1}%`} accent="#16a34a" />
          </div>

          {/* ── Top pages ────────────────────────────────────────── */}
          <Card title="Pages les plus vues" subtitle={`Sur ${periodLabel}`}>
            <RankList rows={stats.topPages.map(p => ({ label: pathLabel(p.path), main: p.views, sub: `${p.visitors} visiteurs` }))}
              emptyHint="Aucune page vue sur la période." unit="vues" />
          </Card>

          {/* ── Top features ─────────────────────────────────────── */}
          <Card title="Fonctionnalités les plus utilisées" subtitle={`Sur ${periodLabel}`}>
            <RankList rows={stats.topEvents.map(e => ({ label: eventLabel(e.event), main: e.hits, sub: `${e.users} utilisateurs` }))}
              emptyHint="Aucune activité sur la période." unit="actions" />
          </Card>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              Maj : {new Date(stats.generatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <button onClick={() => load(days, bucket)} style={{ ...btnStyle, width: 'auto', padding: '6px 14px' }}>↻ Rafraîchir</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Données collectées uniquement sur trivela.ch (visiteurs connectés et anonymes). « Visiteur unique » = un identifiant de
            navigateur stable ; « session » = une visite (par onglet).
          </div>
        </>
      ) : null}
    </PageLayout>
  )
}

const btnStyle: React.CSSProperties = {
  width: '100%', padding: '8px 0', borderRadius: 9, cursor: 'pointer',
  background: 'var(--bg-fill)', border: '1px solid var(--border)', color: 'var(--text-2)',
  fontSize: 12, fontWeight: 700,
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'var(--text-3)', textTransform: 'uppercase', padding: '0 2px 8px' }}>
      {children}
    </div>
  )
}

function Segmented({ options, value, onChange }: {
  options: { key: string; label: string }[]; value: string; onChange: (k: string) => void
}) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--bg-fill)', borderRadius: 10, padding: 3, border: '1px solid var(--border)' }}>
      {options.map(o => {
        const on = o.key === value
        return (
          <button key={o.key} onClick={() => onChange(o.key)} style={{
            padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, letterSpacing: 0.2,
            background: on ? 'var(--bg-card)' : 'transparent',
            color: on ? GOLD : 'var(--text-3)',
            boxShadow: on ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s',
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 30, lineHeight: 1, color: accent ?? 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: 0.3 }}>{label}</div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, padding: '14px 16px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 1.2, color: 'var(--text-1)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function InteractiveChart({ series, bucket }: { series: StatPoint[]; bucket: StatBucket }) {
  const [sel, setSel] = useState<number>(series.length - 1)
  // Resélectionne la dernière barre quand les données changent.
  useEffect(() => { setSel(series.length - 1) }, [series])

  if (series.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Aucune donnée sur la période.</div>
  }

  const max = Math.max(1, ...series.map(p => p.visitors))
  const labelStep = Math.max(1, Math.ceil(series.length / 8))
  const selected = series[Math.min(sel, series.length - 1)] ?? series[series.length - 1]

  return (
    <div>
      {/* Détail de la barre sélectionnée */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
        padding: '8px 12px', marginBottom: 10, borderRadius: 10,
        background: 'rgba(200,155,60,0.08)', border: '1px solid rgba(200,155,60,0.25)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#A07828', textTransform: 'capitalize' }}>
          {fullLabel(selected.bucket, bucket)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          <b style={{ color: 'var(--text-1)' }}>{selected.visitors.toLocaleString('fr-FR')}</b> visiteurs ·
          {' '}<b style={{ color: 'var(--text-1)' }}>{selected.events.toLocaleString('fr-FR')}</b> actions
        </span>
      </div>

      {/* Barres cliquables */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
        {series.map((p, i) => {
          const h = Math.round((p.visitors / max) * 100)
          const on = i === sel
          return (
            <button key={p.bucket} onClick={() => setSel(i)} title={`${fullLabel(p.bucket, bucket)} : ${p.visitors} visiteurs`}
              style={{
                flex: 1, minWidth: 0, height: '100%', padding: 0, border: 'none', cursor: 'pointer',
                background: 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              }}>
              <div style={{
                width: '100%', height: `${Math.max(h, p.visitors > 0 ? 6 : 2)}%`, borderRadius: '4px 4px 0 0',
                background: on ? GOLD : 'rgba(200,155,60,0.40)', transition: 'height 0.3s ease, background 0.15s',
              }} />
            </button>
          )
        })}
      </div>
      {/* Axe X (libellés espacés) */}
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {series.map((p, i) => (
          <div key={p.bucket} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 8,
            color: i === sel ? GOLD : 'var(--text-3)', fontWeight: i === sel ? 800 : 500,
            overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {(i % labelStep === 0 || i === series.length - 1) ? axisLabel(p.bucket) : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function RankList({ rows, unit, emptyHint }: {
  rows: { label: string; main: number; sub: string }[]; unit: string; emptyHint: string
}) {
  if (rows.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>{emptyHint}</div>
  const max = Math.max(1, ...rows.map(r => r.main))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--text-3)' }}>
              <b style={{ color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>{r.main.toLocaleString('fr-FR')}</b> {unit} · {r.sub}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--bg-fill)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round((r.main / max) * 100)}%`, height: '100%', background: GOLD, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
