import { useState, useEffect } from 'react'
import PageLayout from './PageLayout'

interface Article {
  id: string
  category: string
  categoryColor: string
  title: string
  excerpt: string
  date: string
  flag: string
  isNew?: boolean
  source: string
  url: string
}

const NEWS: Article[] = [
  {
    id: '1',
    category: 'Équipe de France',
    categoryColor: '#3b82f6',
    title: 'Mbappé : sa blessure au genou "est derrière moi"',
    excerpt: 'Le capitaine des Bleus a confirmé être pleinement rétabli avant les amicaux de mars aux États-Unis. Son retour a immédiatement rassuré Deschamps à trois mois du Mondial.',
    date: '24 mars 2026',
    flag: '🇫🇷',
    isNew: true,
    source: 'France Bleu',
    url: 'https://www.francebleu.fr/sports/football/football-la-blessure-au-genou-est-derriere-moi-affirme-kylian-mbappe-5650436',
  },
  {
    id: '2',
    category: 'Qualifications',
    categoryColor: '#ef4444',
    title: 'Cauchemar sans fin : l\'Italie éliminée aux tirs au but par la Bosnie',
    excerpt: 'Pour la troisième édition consécutive, la Squadra Azzurra ne disputera pas la Coupe du monde. Battue aux penaltys (4-3) à Zenica après une expulsion décisive de Bastoni, l\'Italie sombre à nouveau.',
    date: '1 avr. 2026',
    flag: '🇮🇹',
    isNew: true,
    source: 'Eurosport',
    url: 'https://www.eurosport.fr/football/qualif-coupe-du-monde/2026/barrages-coupe-du-monde-2026-i-le-cauchemar-sans-fin-litalie-eliminee-aux-tirs-au-but-par-la-bosnie-herzegovine_sto23286351/story.shtml',
  },
  {
    id: '3',
    category: 'Bleus',
    categoryColor: '#3b82f6',
    title: 'Réduits à 10, les Bleus matent le Brésil grâce à Mbappé et Ekitike',
    excerpt: 'À Gillette Stadium, la France a renversé la Seleção (2-1) en amical malgré l\'infériorité numérique. Mbappé, auteur du 1-0, inscrit son 56e but en Bleu, à une unité du record de Giroud.',
    date: '26 mars 2026',
    flag: '⚽',
    isNew: true,
    source: 'Eurosport',
    url: 'https://www.eurosport.fr/football/matches-amicaux/2026/reduits-a-dix-les-bleus-matent-quand-meme-le-bresil-grace-a-kylian-mbappe-et-hugo-ekitike-en-match-amical-avant-la-coupe-du-monde-2026_sto23284889/story.shtml',
  },
  {
    id: '4',
    category: 'Officiel',
    categoryColor: '#6366f1',
    title: 'FIFA : 170 officiels de match dont Clément Turpin pour la France',
    excerpt: 'Le 9 avril, la FIFA a officialisé les 52 arbitres, 88 assistants et 30 officiels VAR. L\'UEFA (15) et la CONMEBOL (12) dominent. Clément Turpin figure parmi les arbitres sélectionnés.',
    date: '9 avr. 2026',
    flag: '🟨',
    isNew: true,
    source: 'FIFA',
    url: 'https://inside.fifa.com/media-releases/fifa-world-cup-2026-match-referees-appointed',
  },
  {
    id: '5',
    category: 'Groupes',
    categoryColor: '#C89B3C',
    title: 'La France dans le groupe I : Sénégal, Norvège et Irak au programme',
    excerpt: 'Tirage au sort le 5 décembre 2025 à Washington. Les Bleus affrontent le Sénégal le 16 juin à New York, l\'Irak le 22 juin à Philadelphie et la Norvège le 26 juin à Boston.',
    date: '5 déc. 2025',
    flag: '🎲',
    isNew: false,
    source: 'Eurosport',
    url: 'https://www.eurosport.fr/football/coupe-du-monde/2026/coupe-du-monde-2026-le-tirage-au-sort-en-direct-lespagne-et-la-france-favoris-pour-remporter-le-mondial-en-amerique-du-nord_sto23247563/story.shtml',
  },
  {
    id: '6',
    category: 'Stades',
    categoryColor: '#10b981',
    title: 'Mexique–Afrique du Sud : l\'Azteca lance le Mondial pour la 3e fois',
    excerpt: 'L\'Estadio Azteca accueillera le coup d\'envoi le 11 juin, devenant le seul stade à avoir ouvert un Mondial à trois reprises (1970, 1986, 2026). Rénové, il affiche une capacité de 87 000 places.',
    date: '11 juin 2026',
    flag: '🇲🇽',
    isNew: false,
    source: 'FIFA',
    url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/estadio-azteca-mexico-city-host-opening-match-world-cup-2026',
  },
  {
    id: '7',
    category: 'Équipe de France',
    categoryColor: '#3b82f6',
    title: 'Deschamps dévoilera ses 26 Bleus le 14 mai sur TF1 — son dernier Mondial',
    excerpt: 'Le sélectionneur annoncera sa liste lors du 20h de TF1. À l\'issue de cette Coupe du monde, après 14 ans de règne, Didier Deschamps quittera définitivement son poste de sélectionneur des Bleus.',
    date: 'À venir · 14 mai 2026',
    flag: '📋',
    isNew: false,
    source: 'Topmercato',
    url: 'https://www.topmercato.com/2066991-liste-didier-deschamps-coupe-monde-2026-date-quand-annonce/',
  },
  {
    id: '8',
    category: 'Groupes',
    categoryColor: '#C89B3C',
    title: 'Les 12 groupes officiels de la Coupe du Monde 2026',
    excerpt: '48 équipes réparties en 12 groupes de 4 dans un format inédit. Les 2 premiers et les 8 meilleurs troisièmes se qualifient pour les 8es de finale. Retrouvez le tableau complet.',
    date: '5 déc. 2025',
    flag: '🌍',
    isNew: false,
    source: 'FIFA',
    url: 'https://www.fifa.com/fr/articles/resultats-tirage-au-sort-mondial-2026',
  },
]

// ── Hook: fetch OG image via Microlink, cached in sessionStorage ──────────────

function useOgImage(articleUrl: string): { src: string | null; loading: boolean } {
  const cacheKey = `oimg:${articleUrl}`
  const [src, setSrc] = useState<string | null>(() => {
    try { return sessionStorage.getItem(cacheKey) } catch { return null }
  })
  const [loading, setLoading] = useState(!src)

  useEffect(() => {
    if (src) { setLoading(false); return }
    const ctrl = new AbortController()
    fetch(`https://api.microlink.io?url=${encodeURIComponent(articleUrl)}`, { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const imgUrl: string | undefined = data?.data?.image?.url
        if (imgUrl) {
          setSrc(imgUrl)
          try { sessionStorage.setItem(cacheKey, imgUrl) } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [articleUrl, src, cacheKey])

  return { src, loading }
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface ActualitesProps {
  onBack: () => void
}

export default function Actualites({ onBack }: ActualitesProps) {
  return (
    <PageLayout
      onBack={onBack}
      accentColor="#C89B3C"
      flag="📰"
      title="ACTUALITÉS"
      subtitle="Coupe du Monde 2026"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {NEWS.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </PageLayout>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: Article }) {
  const { src: imgSrc, loading } = useOgImage(article.url)
  const open = () => window.open(article.url, '_blank', 'noopener,noreferrer')

  return (
    <div
      onClick={open}
      role="link"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && open()}
      onPointerDown={e => (e.currentTarget.style.opacity = '0.78')}
      onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
      onPointerLeave={e => (e.currentTarget.style.opacity = '1')}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        transition: 'opacity 0.12s',
      }}
    >
      {/* ── Image section ── */}
      <div style={{
        height: 180, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${article.categoryColor}18 0%, ${article.categoryColor}30 100%)`,
      }}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={article.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: loading ? 0.5 : 0.8,
            transition: 'opacity 0.3s',
          }}>
            <span style={{ fontSize: 56, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.15))' }}>
              {article.flag}
            </span>
          </div>
        )}

        {/* Source badge overlay */}
        <div style={{
          position: 'absolute', bottom: 8, left: 10,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          borderRadius: 6, padding: '3px 8px',
          fontSize: 9, fontWeight: 700, letterSpacing: 0.8,
          color: 'rgba(255,255,255,0.90)', textTransform: 'uppercase',
        }}>
          {article.source}
        </div>

        {article.isNew && (
          <div style={{
            position: 'absolute', top: 8, right: 10,
            background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 9, fontWeight: 800, letterSpacing: 1,
            color: '#0D0800',
          }}>
            NEW
          </div>
        )}
      </div>

      {/* ── Text section ── */}
      <div style={{ padding: '12px 14px 14px' }}>
        {/* Category */}
        <span style={{
          display: 'inline-block',
          fontSize: 8, fontWeight: 800, letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: article.categoryColor,
          background: `${article.categoryColor}14`,
          border: `1px solid ${article.categoryColor}30`,
          borderRadius: 5, padding: '3px 7px',
          marginBottom: 8,
        }}>
          {article.category}
        </span>

        {/* Title */}
        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 18, letterSpacing: 1.3,
          color: 'var(--text-1)', lineHeight: 1.15,
          marginBottom: 7,
        }}>
          {article.title}
        </div>

        {/* Excerpt */}
        <p style={{
          fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55,
          marginBottom: 10,
        }}>
          {article.excerpt}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: 0.3 }}>
            {article.date}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: article.categoryColor,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            Lire l'article
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
