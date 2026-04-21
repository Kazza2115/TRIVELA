import { useState, useEffect, useCallback } from 'react'
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

// ── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_MS = 30 * 60 * 1000
const CACHE_KEY  = 'trivela-news-v3'

const FEEDS = [
  { url: 'https://www.eurosport.fr/football/rss.xml',             name: 'Eurosport' },
  { url: 'https://dwh.lequipe.fr/api/edito/rss?path=/Football/',  name: "L'Équipe"  },
  { url: 'https://rmcsport.bfmtv.com/rss/football.xml',          name: 'RMC Sport' },
  { url: 'https://www.foot01.com/rss.xml',                        name: 'Foot01'    },
]

const WC_KEYWORDS = ['2026', 'mondial', 'coupe du monde', 'world cup', 'fifa', 'équipe de france', 'bleus', 'qualification']

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function proxyImage(src: string): string {
  return `https://images.weserv.nl/?url=${encodeURIComponent(src)}&w=800&h=420&fit=cover&output=webp&q=80`
}

function categorise(text: string): { category: string; color: string; flag: string } {
  const t = text.toLowerCase()
  if (/mbappe|mbappé|deschamps|bleus|équipe de france|les bleus/.test(t))
    return { category: 'Équipe de France', color: '#3b82f6', flag: '🇫🇷' }
  if (/barrage|qualif|éliminé|eliminé|barrages/.test(t))
    return { category: 'Qualifications', color: '#f59e0b', flag: '🏆' }
  if (/groupe|tirage|poule/.test(t))
    return { category: 'Groupes', color: '#C89B3C', flag: '🎲' }
  if (/stade|stadium|azteca|metlife|sofi/.test(t))
    return { category: 'Stades', color: '#10b981', flag: '🏟️' }
  if (/fifa|officiel|arbitre/.test(t))
    return { category: 'Officiel', color: '#6366f1', flag: '⚽' }
  if (/billet|ticket/.test(t))
    return { category: 'Billetterie', color: '#f59e0b', flag: '🎫' }
  return { category: 'Football', color: '#C89B3C', flag: '⚽' }
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1)  return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24)    return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

// ── RSS fetcher ───────────────────────────────────────────────────────────────

function parseXmlItems(xml: string, sourceName: string): Article[] {
  const doc   = new DOMParser().parseFromString(xml, 'text/xml')
  const items = [...doc.querySelectorAll('item')]
  if (!items.length) return []

  return items.slice(0, 25).flatMap((item): Article[] => {
    const title    = item.querySelector('title')?.textContent?.trim() ?? ''
    const desc     = item.querySelector('description')?.textContent ?? ''
    const link     = item.querySelector('link')?.textContent?.trim() ?? '#'
    const pubDate  = item.querySelector('pubDate')?.textContent ?? ''
    if (!title) return []

    const publishedAt = new Date(pubDate).getTime() || 0

    // Look for image in common RSS image fields
    const mediaUrl   = item.querySelector('content')?.getAttribute('url')
                    ?? item.querySelector('thumbnail')?.getAttribute('url')
                    ?? item.querySelector('enclosure')?.getAttribute('url')
                    ?? null

    const rawText = `${title} ${desc}`
    const { category, color: categoryColor, flag } = categorise(rawText)

    return [{
      id:           `${sourceName}-${title.slice(0, 30)}-${publishedAt}`,
      title,
      excerpt:      stripHtml(desc).slice(0, 220).trimEnd() + '…',
      url:          link,
      source:       sourceName,
      image:        mediaUrl ? proxyImage(mediaUrl) : null,
      category,
      categoryColor,
      flag,
      isNew:        Date.now() - publishedAt < 86_400_000,
      publishedAt,
    }]
  })
}

async function fetchFeed(rssUrl: string, sourceName: string): Promise<Article[]> {
  // Try rss2json first (returns JSON, no XML parsing needed)
  try {
    const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=25&order_by=pubDate`
    const res = await fetch(api, { signal: AbortSignal.timeout(7000) })
    if (res.ok) {
      const data = await res.json()
      if (data.status === 'ok' && Array.isArray(data.items) && data.items.length > 0) {
        return data.items.slice(0, 25).flatMap((item: any): Article[] => {
          const title = (item.title ?? '').trim()
          if (!title) return []
          const publishedAt = new Date(item.pubDate ?? 0).getTime()
          const thumb: string | undefined = item.thumbnail || item.enclosure?.link
          const rawText = `${title} ${item.description ?? ''}`
          const { category, color: categoryColor, flag } = categorise(rawText)
          return [{
            id:           `${sourceName}-${title.slice(0, 30)}-${publishedAt}`,
            title,
            excerpt:      stripHtml(item.description ?? '').slice(0, 220).trimEnd() + '…',
            url:          item.link ?? '#',
            source:       sourceName,
            image:        thumb ? proxyImage(thumb) : null,
            category,
            categoryColor,
            flag,
            isNew:        Date.now() - publishedAt < 86_400_000,
            publishedAt,
          }]
        })
      }
    }
  } catch {}

  // Fallback: fetch raw XML via allorigins.win
  try {
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`
    const res   = await fetch(proxy, { signal: AbortSignal.timeout(9000) })
    if (res.ok) {
      const xml = await res.text()
      return parseXmlItems(xml, sourceName)
    }
  } catch {}

  return []
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useNews() {
  const loadCache = (): { articles: Article[]; ts: number } | null => {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return null
  }

  const cached = loadCache()

  const [articles,   setArticles]   = useState<Article[]>(cached?.articles ?? [])
  const [updatedAt,  setUpdatedAt]  = useState<number>(cached?.ts ?? 0)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState(false)

  const refresh = useCallback(async (force = false) => {
    const cache = loadCache()
    if (!force && cache && Date.now() - cache.ts < REFRESH_MS) return

    setRefreshing(true)
    setError(false)
    try {
      const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f.url, f.name)))
      const all: Article[] = []
      results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value) })

      // Prefer World Cup articles; fall back to all football articles
      const wcFiltered = all.filter(a => {
        const t = `${a.title} ${a.excerpt}`.toLowerCase()
        return WC_KEYWORDS.some(k => t.includes(k))
      })

      const pool = wcFiltered.length >= 4 ? wcFiltered : all

      const deduped = Array.from(
        new Map(pool.map(a => [a.id, a])).values()
      ).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 15)

      if (deduped.length > 0) {
        setArticles(deduped)
        setUpdatedAt(Date.now())
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ articles: deduped, ts: Date.now() }))
        } catch {}
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    }
    setRefreshing(false)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(() => refresh(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  return { articles, updatedAt, refreshing, error, refresh }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Actualites({ onBack }: { onBack: () => void }) {
  const { articles, updatedAt, refreshing, error, refresh } = useNews()

  return (
    <PageLayout onBack={onBack} accentColor="#C89B3C" flag="📰" title="ACTUALITÉS" subtitle="Coupe du Monde 2026">

      {/* Refresh bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 0.4 }}>
          {refreshing
            ? 'Chargement…'
            : updatedAt > 0
              ? `Mis à jour ${timeAgo(updatedAt)}`
              : 'En attente…'}
        </span>
        <button
          onClick={() => refresh(true)}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'var(--bg-fill)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 10px', cursor: refreshing ? 'default' : 'pointer',
            fontSize: 10, fontWeight: 700, color: refreshing ? 'var(--text-3)' : 'var(--text-2)',
            opacity: refreshing ? 0.5 : 1, transition: 'opacity 0.2s',
          }}
        >
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}
          >
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Actualiser
        </button>
      </div>

      {/* State: loading skeleton */}
      {refreshing && articles.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, overflow: 'hidden', height: 260,
              opacity: 0.5,
            }}>
              <div style={{ height: 170, background: 'var(--bg-fill)' }} />
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ height: 10, width: '40%', background: 'var(--bg-fill)', borderRadius: 4 }} />
                <div style={{ height: 16, width: '90%', background: 'var(--bg-fill)', borderRadius: 4 }} />
                <div style={{ height: 12, width: '70%', background: 'var(--bg-fill)', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* State: error */}
      {error && articles.length === 0 && !refreshing && (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7,
        }}>
          Impossible de charger les articles.<br />
          <span style={{ fontSize: 11 }}>Vérifiez votre connexion.</span><br /><br />
          <button
            onClick={() => refresh(true)}
            style={{
              background: '#C89B3C', color: '#000', border: 'none',
              borderRadius: 10, padding: '10px 20px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer',
            }}
          >Réessayer</button>
        </div>
      )}

      {/* Articles */}
      {articles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {articles.map(a => <ArticleCard key={a.id} article={a} />)}
        </div>
      )}
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
      {/* Image */}
      <div style={{
        height: 170, overflow: 'hidden', position: 'relative',
        background: `linear-gradient(135deg, ${a.categoryColor}20, ${a.categoryColor}38)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {a.image && imgOk ? (
          <img
            src={a.image} alt=""
            onError={() => setImgOk(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 52, opacity: 0.7 }}>{a.flag}</span>
        )}

        {/* Source pill */}
        <div style={{
          position: 'absolute', bottom: 8, left: 10,
          background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(6px)',
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

        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55, marginBottom: 10 }}>
          {a.excerpt}
        </p>

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
