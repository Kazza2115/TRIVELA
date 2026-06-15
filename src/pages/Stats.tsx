import { useState, useEffect, useCallback } from 'react'
import PageLayout from './PageLayout'
import { getAdminStats } from '../services/auth'
import type { UserProfile, AdminStats } from '../services/auth'

const GOLD = '#C89B3C'

// Libellés lisibles pour les évènements et les sections.
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

// Construit un axe continu de 14 jours, valeurs DAU remplies à 0 si manquantes.
function dauSeries(dau: { day: string; visitors: number }[]): { day: string; visitors: number }[] {
  const byDay = new Map(dau.map(d => [d.day, d.visitors]))
  const out: { day: string; visitors: number }[] = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ day: key, visitors: byDay.get(key) ?? 0 })
  }
  return out
}

export default function Stats({ onBack, currentUser }: {
  onBack: () => void
  currentUser: UserProfile | null
}) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getAdminStats()
      .then(({ stats, error }) => { if (error) setError(error); else setStats(stats ?? null) })
      .catch(() => setError('Erreur réseau.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (currentUser?.isAdmin) load(); else setLoading(false) }, [currentUser, load])

  // Garde-fou client (la RPC refuse déjà côté serveur).
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

  return (
    <PageLayout onBack={onBack} accentColor={GOLD} flag="📈" title="STATISTIQUES" subtitle="Vue d'ensemble · trivela.ch">
      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-3)', padding: '20px 4px' }}>Chargement…</div>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', borderRadius: 14,
          background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.3)' }}>
          <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700 }}>Impossible de charger les statistiques</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>{error}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Vérifie que <b>db-admin-stats.sql</b> (et <b>db-analytics.sql</b>) sont bien appliqués dans Supabase.
          </div>
          <button onClick={load} style={btnStyle}>↻ Réessayer</button>
        </div>
      ) : stats ? (
        <>
          {/* ── KPIs ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 18 }}>
            <Kpi label="Visiteurs uniques" value={stats.visitorsTotal} accent={GOLD} />
            <Kpi label="Actifs aujourd'hui" value={stats.activeToday} accent="#16a34a" />
            <Kpi label="Visiteurs · 7 j" value={stats.visitors7d} />
            <Kpi label="Visiteurs · 30 j" value={stats.visitors30d} />
            <Kpi label="Joueurs inscrits" value={stats.players} accent={GOLD} />
            <Kpi label="Pronostics placés" value={stats.bets} />
            <Kpi label="Inscrits actifs · 30 j" value={stats.registered30d} />
            <Kpi label="Rétention J+1" value={stats.retentionD1 == null ? '—' : `${stats.retentionD1}%`} accent="#16a34a" />
          </div>

          {/* ── DAU (14 jours) ───────────────────────────────────── */}
          <Card title="Visiteurs actifs / jour" subtitle="14 derniers jours">
            <DauChart data={dauSeries(stats.dau)} />
          </Card>

          {/* ── Top pages ────────────────────────────────────────── */}
          <Card title="Pages les plus vues" subtitle="30 derniers jours">
            <RankList rows={stats.topPages.map(p => ({ label: pathLabel(p.path), main: p.views, sub: `${p.visitors} visiteurs` }))}
              emptyHint="Aucune page vue sur la période." unit="vues" />
          </Card>

          {/* ── Top features ─────────────────────────────────────── */}
          <Card title="Fonctionnalités les plus utilisées" subtitle="30 derniers jours">
            <RankList rows={stats.topEvents.map(e => ({ label: eventLabel(e.event), main: e.hits, sub: `${e.users} utilisateurs` }))}
              emptyHint="Aucune activité sur la période." unit="actions" />
          </Card>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
              Maj : {new Date(stats.generatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' })}
            </span>
            <button onClick={load} style={{ ...btnStyle, width: 'auto', padding: '6px 14px' }}>↻ Rafraîchir</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Données collectées uniquement sur trivela.ch (visiteurs connectés et anonymes). Un « visiteur unique » = un identifiant
            de navigateur stable.
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

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 14, background: 'var(--bg-card)',
      border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        fontFamily: "'Bebas Neue', cursive", fontSize: 30, lineHeight: 1,
        color: accent ?? 'var(--text-1)', fontVariantNumeric: 'tabular-nums',
      }}>{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, letterSpacing: 0.3 }}>{label}</div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 14, padding: '14px 16px', borderRadius: 16,
      background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 1.2, color: 'var(--text-1)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function DauChart({ data }: { data: { day: string; visitors: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.visitors))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
      {data.map((d, i) => {
        const h = Math.round((d.visitors / max) * 100)
        const dd = d.day.slice(8, 10)
        const isLast = i === data.length - 1
        return (
          <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
              <div title={`${d.day} : ${d.visitors}`} style={{
                width: '100%', height: `${Math.max(h, d.visitors > 0 ? 6 : 2)}%`, borderRadius: '4px 4px 0 0',
                background: isLast ? GOLD : 'rgba(200,155,60,0.45)', transition: 'height 0.4s ease',
              }} />
            </div>
            <span style={{ fontSize: 8, color: isLast ? GOLD : 'var(--text-3)', fontWeight: isLast ? 800 : 500 }}>{dd}</span>
          </div>
        )
      })}
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
