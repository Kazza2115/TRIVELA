import { useState, useEffect, useCallback, useRef } from 'react'
import PageLayout from './PageLayout'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Article {
  id: string
  title: string
  excerpt: string
  url: string
  source: string
  image: string | null
  category: string
  categoryColor: string
  flag: string
  isNew: boolean
  publishedAt: number
}

// ── Récupération en direct ────────────────────────────────────────────────────
// 1) En priorité : Edge Function Supabase (côté serveur, fiable, sans CORS).
// 2) Repli : proxys CORS publics sur le flux Google Actualités.
// 3) Dernier repli : liste curatée (constante FALLBACK).

const SUPA_URL  = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpdmN3dHp6aHJzZGZ6eGlyamt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MjM2MTMsImV4cCI6MjA5MTk5OTYxM30.BUfzNXfEobrz4CSeyBSj3I8To4F1eR-7AktC_kZfsO8'

const NEWS_QUERY = 'Coupe du Monde 2026 OR Mondial 2026 football'
const RSS_URL = `https://news.google.com/rss/search?q=${encodeURIComponent(NEWS_QUERY)}&hl=fr&gl=FR&ceid=FR:fr`
const PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
]

interface RawItem { title: string; link: string; source: string; pubDate: string; description: string }

function pickMeta(text: string): { flag: string; category: string; color: string } {
  const t = text.toLowerCase()
  if (/\bbleus?\b|france|deschamps|mbapp/.test(t)) return { flag: '🇫🇷', category: 'Équipe de France', color: '#3b82f6' }
  if (/stade|azteca|metlife|enceinte/.test(t))      return { flag: '🏟️', category: 'Stades', color: '#10b981' }
  if (/billet|billetterie|ticket/.test(t))          return { flag: '🎫', category: 'Billetterie', color: '#f59e0b' }
  if (/fifa|var|règl|officiel|arbitr/.test(t))      return { flag: '⚽', category: 'Officiel', color: '#6366f1' }
  return { flag: '⚽', category: 'Mondial 2026', color: '#C89B3C' }
}

function mapItems(items: RawItem[]): Article[] {
  return items.map((it, i): Article => {
    const title = it.source && it.title.endsWith(` - ${it.source}`)
      ? it.title.slice(0, -(` - ${it.source}`).length)
      : it.title.replace(/\s+-\s+[^-]+$/, '')
    const publishedAt = it.pubDate ? Date.parse(it.pubDate) : Date.now()
    const meta = pickMeta(title)
    return {
      id: it.link || String(i), title: title.trim(), excerpt: '',
      url: it.link, source: it.source || 'Actualités', image: null,
      category: meta.category, categoryColor: meta.color, flag: meta.flag,
      isNew: Date.now() - publishedAt < 24 * 3600 * 1000, publishedAt,
    }
  }).filter(a => a.title && a.url).sort((a, b) => b.publishedAt - a.publishedAt)
}

function parseRss(xml: string): RawItem[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.querySelectorAll('item')).slice(0, 20).map(it => ({
    title: it.querySelector('title')?.textContent ?? '',
    link: it.querySelector('link')?.textContent ?? '',
    source: it.querySelector('source')?.textContent ?? '',
    pubDate: it.querySelector('pubDate')?.textContent ?? '',
    description: it.querySelector('description')?.textContent ?? '',
  }))
}

// 1) Table Supabase `news` (alimentée par GitHub Actions — fiable, sans CORS)
async function fromTable(): Promise<Article[]> {
  const res = await fetch(`${SUPA_URL}/rest/v1/news?select=*&order=published_at.desc&limit=20`, {
    headers: { apikey: SUPA_ANON, Authorization: `Bearer ${SUPA_ANON}` }, cache: 'no-store',
  })
  if (!res.ok) throw new Error('table')
  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty')
  return rows.map((r: any, i: number): Article => {
    const rawImg = (r.image as string) || ''
    const rawExc = (r.excerpt as string) || ''
    const badImg = /\/\/[a-z0-9.-]*\b(?:gstatic|google|googleusercontent)\.com/i.test(rawImg)
    const badExc = /aggregated from sources|google\s*news/i.test(rawExc)
    return {
      id: (r.id as string) || String(i),
      title: r.title as string,
      excerpt: badExc ? '' : rawExc,
      url: r.url as string,
      source: (r.source as string) || 'Actualités',
      image: badImg || !rawImg ? null : rawImg,
      category: (r.category as string) || 'Mondial 2026',
      categoryColor: (r.category_color as string) || '#C89B3C',
      flag: (r.flag as string) || '⚽',
      isNew: r.published_at ? (Date.now() - Date.parse(r.published_at) < 24 * 3600 * 1000) : false,
      publishedAt: r.published_at ? Date.parse(r.published_at) : Date.now(),
    }
  }).filter(a => a.title && a.url)
}

// 2) Proxys CORS publics sur le flux Google Actualités (repli)
async function fromProxies(): Promise<Article[]> {
  for (const proxy of PROXIES) {
    try {
      const res = await fetch(proxy(RSS_URL), { cache: 'no-store' })
      if (!res.ok) continue
      const xml = await res.text()
      if (xml.includes('<item')) {
        const arts = mapItems(parseRss(xml))
        if (arts.length) return arts
      }
    } catch { /* proxy suivant */ }
  }
  throw new Error('proxies')
}

async function fetchLiveNews(): Promise<Article[]> {
  try { return await fromTable() } catch { /* tente les proxys */ }
  return fromProxies()
}

// ── Repli (si la récupération en direct échoue) ───────────────────────────────

const FALLBACK: Article[] = [
  {
    id: 'f1', title: '48 équipes, format inédit : tout comprendre sur le Mondial 2026',
    excerpt: 'Pour la première fois, 48 sélections participeront à une Coupe du Monde. Douze groupes de quatre, puis un tableau à élimination directe élargi à 32 équipes.',
    url: 'https://www.lequipe.fr/Football/', source: "L'Équipe", image: null,
    category: 'Officiel', categoryColor: '#6366f1', flag: '⚽', isNew: false, publishedAt: Date.UTC(2026, 3, 17),
  },
  {
    id: 'f2', title: 'Brésil, Argentine, France : le grand livre des favoris',
    excerpt: 'Qui pour succéder à l\'Argentine championne du monde en titre ? Notre analyse des nations les plus armées pour soulever le trophée.',
    url: 'https://rmcsport.bfmtv.com/football/', source: 'RMC Sport', image: null,
    category: 'Mondial 2026', categoryColor: '#C89B3C', flag: '⚽', isNew: false, publishedAt: Date.UTC(2026, 3, 14),
  },
  {
    id: 'f3', title: 'MetLife Stadium : le temple accueillera la grande finale le 19 juillet',
    excerpt: 'L\'enceinte de 82 000 places du New Jersey sera le théâtre de la finale du Mondial 2026.',
    url: 'https://www.eurosport.fr/football/', source: 'Eurosport', image: null,
    category: 'Stades', categoryColor: '#10b981', flag: '🏟️', isNew: false, publishedAt: Date.UTC(2026, 3, 18),
  },
]

const REFRESH_MS = 3 * 60 * 1000  // rafraîchissement auto toutes les 3 min

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Actualites({ onBack }: { onBack: () => void }) {
  const [articles, setArticles] = useState<Article[]>(FALLBACK)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const hasLive = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const live = await fetchLiveNews()
      if (live.length) {
        setArticles(live); setUpdatedAt(Date.now()); setFailed(false); hasLive.current = true
      } else if (!hasLive.current) {
        setFailed(true)
      }
    } catch {
      if (!hasLive.current) setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_MS)
    const onFocus = () => { if (!document.hidden) load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])

  return (
    <PageLayout onBack={onBack} accentColor="#C89B3C" flag="📰" title="ACTUALITÉS" subtitle="Coupe du Monde 2026">

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 0.4 }}>
          {loading ? 'Actualisation…'
            : failed ? 'Hors-ligne · actus de secours'
            : updatedAt ? `Mis à jour à ${formatTime(updatedAt)}` : 'En direct'}
        </span>
        <button onClick={load} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999,
          background: 'rgba(200,155,60,0.10)', border: '1px solid rgba(200,155,60,0.3)',
          color: '#A07828', fontSize: 11, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}>
          <span style={{ display: 'inline-block', animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>↻</span>
          Actualiser
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {articles.map(a => <ArticleCard key={a.id} article={a} />)}
      </div>

    </PageLayout>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ArticleCard({ article: a }: { article: Article }) {
  const [imgOk, setImgOk] = useState(!!a.image)

  const open = () => window.open(a.url, '_blank', 'noopener,noreferrer')

  return (
    <div
      onClick={open} role="link" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && open()}
      onPointerDown={e => (e.currentTarget.style.opacity = '0.75')}
      onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
      onPointerLeave={e => (e.currentTarget.style.opacity = '1')}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'opacity 0.12s',
      }}
    >
      {/* Image / banner */}
      <div style={{
        height: 150, overflow: 'hidden', position: 'relative',
        background: `linear-gradient(135deg, ${a.categoryColor}22, ${a.categoryColor}44)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {a.image && imgOk ? (
          <img
            src={a.image} alt=""
            onError={() => setImgOk(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 40, opacity: 0.6 }}>{a.flag}</span>
        )}

        {/* Source */}
        <div style={{
          position: 'absolute', bottom: 8, left: 10,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)', borderRadius: 6,
          padding: '3px 8px', fontSize: 9, fontWeight: 700,
          letterSpacing: 0.8, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase',
        }}>{a.source}</div>

        {a.isNew && (
          <div style={{
            position: 'absolute', top: 8, right: 10,
            background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 9, fontWeight: 800, letterSpacing: 1, color: '#0D0800',
          }}>NEW</div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 14px 14px' }}>
        <span style={{
          display: 'inline-block', marginBottom: 8,
          fontSize: 8, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase',
          color: a.categoryColor, background: `${a.categoryColor}14`,
          border: `1px solid ${a.categoryColor}30`, borderRadius: 5, padding: '3px 7px',
        }}>
          {a.category}
        </span>

        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 18, letterSpacing: 1.3, color: 'var(--text-1)', lineHeight: 1.15,
          marginBottom: 7,
        }}>
          {a.title}
        </div>

        {a.excerpt && (
          <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 10 }}>
            {a.excerpt}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>
            {formatDate(a.publishedAt)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: a.categoryColor,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            Lire
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </span>
        </div>
      </div>
    </div>
  )
}
