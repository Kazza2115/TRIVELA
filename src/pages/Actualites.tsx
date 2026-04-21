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
const CACHE_KEY  = 'trivela-news-v5'
const WC_KEYWORDS = ['2026', 'mondial', 'coupe du monde', 'world cup', 'bleus', 'équipe de france']

// Direct media RSS feeds (real article descriptions) + Google News as fallback
const FEEDS = [
  { url: 'https://www.eurosport.fr/football/rss.xml',            name: 'Eurosport',  filter: true  },
  { url: 'https://dwh.lequipe.fr/api/edito/rss?path=/Football/', name: "L'Équipe",   filter: true  },
  { url: 'https://rmcsport.bfmtv.com/rss/football.xml',         name: 'RMC Sport',  filter: true  },
  {
    url:  'https://news.google.com/rss/search?q=coupe+du+monde+2026+football&hl=fr&gl=FR&ceid=FR:fr',
    name: 'Actu Foot',
    filter: false,
  },
]

// CORS proxies tried in order
const PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim()
}

function briefExcerpt(raw: string, title: string): string {
  const text = stripHtml(raw)
  // Google News descriptions just repeat the title + source — skip them
  if (text.toLowerCase().startsWith(title.toLowerCase().slice(0, 30))) return ''
  // Take first sentence, capped at 130 chars
  const dot = text.search(/[.!?]\s/)
  const sentence = dot > 0 ? text.slice(0, dot + 1) : text
  return sentence.length > 130 ? sentence.slice(0, 127).trimEnd() + '…' : sentence
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
  return { category: 'Mondial 2026', color: '#C89B3C', flag: '⚽' }
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

// ── XML parser ────────────────────────────────────────────────────────────────

function parseItems(xml: string, sourceName: string, filter: boolean): Article[] {
  try {
    const doc   = new DOMParser().parseFromString(xml, 'text/xml')
    const items = [...doc.querySelectorAll('item')]
    if (!items.length) return []

    return items.flatMap((item): Article[] => {
      const title   = item.querySelector('title')?.textContent?.trim() ?? ''
      const desc    = item.querySelector('description')?.textContent ?? ''
      const link    = item.querySelector('link')?.textContent?.trim()
               ?? item.getElementsByTagName('link')[0]?.textContent?.trim()
               ?? '#'
      const pubDate = item.querySelector('pubDate')?.textContent ?? ''
      if (!title) return []

      const rawText = `${title} ${desc}`.toLowerCase()

      // Apply WC keyword filter for media feeds
      if (filter && !WC_KEYWORDS.some(k => rawText.includes(k))) return []

      const publishedAt = new Date(pubDate).getTime() || Date.now() - Math.random() * 86400000
      const sourceTag   = item.querySelector('source')?.textContent?.trim()
      const displaySource = sourceTag ?? sourceName

      const mediaUrl = item.querySelector('content')?.getAttribute('url')
                    ?? item.querySelector('thumbnail')?.getAttribute('url')
                    ?? item.querySelector('enclosure')?.getAttribute('url')
                    ?? null

      const { category, color: categoryColor, flag } = categorise(`${title} ${desc}`)
      const excerpt = briefExcerpt(desc, title)

      return [{
        id:           `${displaySource}-${title.slice(0, 40)}-${publishedAt}`,
        title,
        excerpt,
        url:          link,
        source:       displaySource,
        image:        mediaUrl ? proxyImage(mediaUrl) : null,
        category,
        categoryColor,
        flag,
        isNew:        Date.now() - publishedAt < 86_400_000,
        publishedAt,
      }]
    })
  } catch {
    return []
  }
}

// ── RSS fetcher (tries each proxy in turn) ────────────────────────────────────

async function fetchFeed(feedUrl: string, sourceName: string, filter: boolean): Promise<Article[]> {
  for (const makeProxy of PROXIES) {
    try {
      const res = await fetch(makeProxy(feedUrl), {
        headers: { Accept: 'application/xml, text/xml, */*' },
      })
      if (!res.ok) continue
      const text = await res.text()
      if (!text.includes('<item')) continue
      const articles = parseItems(text, sourceName, filter)
      if (articles.length > 0) return articles
    } catch {}
  }
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
  const [fetchFailed, setFetchFailed] = useState(false)

  const refresh = useCallback(async (force = false) => {
    const cache = loadCache()
    if (!force && cache && Date.now() - cache.ts < REFRESH_MS) return

    setRefreshing(true)
    setFetchFailed(false)

    try {
      const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f.url, f.name, f.filter)))

      const all: Article[] = []
      results.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value) })

      const deduped = Array.from(
        new Map(all.map(a => [a.id, a])).values()
      ).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 20)

      if (deduped.length > 0) {
        setArticles(deduped)
        setUpdatedAt(Date.now())
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ articles: deduped, ts: Date.now() }))
        } catch {}
      } else {
        setFetchFailed(true)
      }
    } catch {
      setFetchFailed(true)
    }

    setRefreshing(false)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(() => refresh(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  return { articles, updatedAt, refreshing, fetchFailed, refresh }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Actualites({ onBack }: { onBack: () => void }) {
  const { articles, updatedAt, refreshing, fetchFailed, refresh } = useNews()

  const isEmpty = articles.length === 0

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

      {/* Skeleton */}
      {refreshing && isEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 16, overflow: 'hidden', opacity: 0.5,
            }}>
              <div style={{ height: 170, background: 'var(--bg-fill)' }} />
              <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div style={{ height: 9, width: '35%', background: 'var(--bg-fill)', borderRadius: 4 }} />
                <div style={{ height: 15, width: '88%', background: 'var(--bg-fill)', borderRadius: 4 }} />
                <div style={{ height: 11, width: '65%', background: 'var(--bg-fill)', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {fetchFailed && isEmpty && !refreshing && (
        <div style={{
          textAlign: 'center', padding: '52px 24px',
          fontSize: 13, color: 'var(--text-3)', lineHeight: 1.8,
        }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>📡</div>
          Impossible de charger les articles.<br />
          <span style={{ fontSize: 11 }}>Vérifiez votre connexion internet.</span>
          <br /><br />
          <button
            onClick={() => refresh(true)}
            style={{
              background: '#C89B3C', color: '#0D0800', border: 'none',
              borderRadius: 10, padding: '11px 24px', fontSize: 13,
              fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5,
            }}
          >Réessayer</button>
        </div>
      )}

      {/* Articles */}
      {!isEmpty && (
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
      {/* Image zone */}
      <div style={{
        height: 160, overflow: 'hidden', position: 'relative',
        background: `linear-gradient(135deg, ${a.categoryColor}1a, ${a.categoryColor}35)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {a.image && imgOk ? (
          <img
            src={a.image} alt=""
            onError={() => setImgOk(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span style={{ fontSize: 48, opacity: 0.65 }}>{a.flag}</span>
        )}

        {/* Source */}
        <div style={{
          position: 'absolute', bottom: 8, left: 10,
          background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)', borderRadius: 6,
          padding: '3px 8px', fontSize: 9, fontWeight: 700,
          letterSpacing: 0.8, color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase',
          maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
