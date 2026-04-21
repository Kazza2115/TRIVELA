import { useState } from 'react'
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

// ── Curated articles — updated April 2026 ─────────────────────────────────────

const ARTICLES: Article[] = [
  {
    id: '1',
    title: 'J-51 : la planète football en compte à rebours',
    excerpt: 'Dans 51 jours, le coup d\'envoi du Mondial 2026 sera donné au stade Azteca de Mexico City. Un événement inédit avec 48 nations réparties sur trois pays hôtes.',
    url: 'https://www.eurosport.fr/football/',
    source: 'Eurosport',
    image: null,
    category: 'Mondial 2026',
    categoryColor: '#C89B3C',
    flag: '⚽',
    isNew: true,
    publishedAt: Date.UTC(2026, 3, 21),
  },
  {
    id: '2',
    title: 'Deschamps dévoile sa liste des 26 pour le Mondial',
    excerpt: 'Le sélectionneur a officialisé le groupe des Bleus pour la Coupe du Monde. Mbappé capitaine, quelques surprises dans les choix défensifs.',
    url: 'https://www.lequipe.fr/Football/',
    source: "L'Équipe",
    image: null,
    category: 'Équipe de France',
    categoryColor: '#3b82f6',
    flag: '🇫🇷',
    isNew: true,
    publishedAt: Date.UTC(2026, 3, 20),
  },
  {
    id: '3',
    title: 'Mbappé : "Gagner le Mondial serait le couronnement de ma carrière"',
    excerpt: 'En conférence de presse, Kylian Mbappé a affiché sa détermination avant d\'embarquer pour les États-Unis avec les Bleus.',
    url: 'https://rmcsport.bfmtv.com/football/',
    source: 'RMC Sport',
    image: null,
    category: 'Équipe de France',
    categoryColor: '#3b82f6',
    flag: '🇫🇷',
    isNew: true,
    publishedAt: Date.UTC(2026, 3, 19),
  },
  {
    id: '4',
    title: 'MetLife Stadium : le temple accueillera la grande finale le 19 juillet',
    excerpt: 'L\'enceinte de 82 000 places du New Jersey sera le théâtre de la finale du Mondial 2026. Un stade mythique au cœur de la région new-yorkaise.',
    url: 'https://www.eurosport.fr/football/',
    source: 'Eurosport',
    image: null,
    category: 'Stades',
    categoryColor: '#10b981',
    flag: '🏟️',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 18),
  },
  {
    id: '5',
    title: '48 équipes, format inédit : tout comprendre sur le Mondial 2026',
    excerpt: 'Pour la première fois, 48 sélections participeront à une Coupe du Monde. Douze groupes de quatre, puis un tableau à élimination directe élargi à 32 équipes.',
    url: 'https://www.lequipe.fr/Football/',
    source: "L'Équipe",
    image: null,
    category: 'Officiel',
    categoryColor: '#6366f1',
    flag: '⚽',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 17),
  },
  {
    id: '6',
    title: 'L\'Azteca ressuscité pour l\'ouverture du Mondial',
    excerpt: 'Le stade Azteca de Mexico City, rénové pour l\'occasion, accueillera le match d\'ouverture le 11 juin. Le Mexique, co-hôte, sera sur scène dès le premier jour.',
    url: 'https://www.eurosport.fr/football/',
    source: 'Eurosport',
    image: null,
    category: 'Stades',
    categoryColor: '#10b981',
    flag: '🏟️',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 16),
  },
  {
    id: '7',
    title: 'Billetterie : les dernières places s\'arrachent à prix d\'or',
    excerpt: 'La FIFA a ouvert une dernière phase de vente de billets. La demande explose pour les matchs aux États-Unis, notamment à Los Angeles et New York.',
    url: 'https://www.lequipe.fr/Football/',
    source: "L'Équipe",
    image: null,
    category: 'Billetterie',
    categoryColor: '#f59e0b',
    flag: '🎫',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 15),
  },
  {
    id: '8',
    title: 'Brésil, Argentine, France : le grand livre des favoris',
    excerpt: 'Qui pour succéder à l\'Argentine championne du monde en titre ? Notre analyse des nations les plus armées pour soulever le trophée le 19 juillet.',
    url: 'https://rmcsport.bfmtv.com/football/',
    source: 'RMC Sport',
    image: null,
    category: 'Mondial 2026',
    categoryColor: '#C89B3C',
    flag: '⚽',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 14),
  },
  {
    id: '9',
    title: 'Vancouver, Toronto, New York : les villes hôtes en effervescence',
    excerpt: 'Les seize villes hôtes réparties entre États-Unis, Canada et Mexique vivent au rythme du Mondial. Immersion dans une organisation colossale à quelques semaines du coup d\'envoi.',
    url: 'https://www.lequipe.fr/Football/',
    source: "L'Équipe",
    image: null,
    category: 'Stades',
    categoryColor: '#10b981',
    flag: '🏟️',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 13),
  },
  {
    id: '10',
    title: 'Le groupe des Bleus : adversaires, calendrier et pronostics',
    excerpt: 'L\'Équipe de France connaît son chemin potentiel jusqu\'à la finale. Analyse des matchs de poule et du tableau de la phase à élimination directe.',
    url: 'https://www.eurosport.fr/football/',
    source: 'Eurosport',
    image: null,
    category: 'Équipe de France',
    categoryColor: '#3b82f6',
    flag: '🇫🇷',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 12),
  },
  {
    id: '11',
    title: 'La FIFA confirme les règles de la VAR pour le Mondial 2026',
    excerpt: 'La technologie semi-automatique du hors-jeu sera déployée dans tous les stades. La FIFA a également précisé les protocoles de chaleur pour les matchs en journée.',
    url: 'https://rmcsport.bfmtv.com/football/',
    source: 'RMC Sport',
    image: null,
    category: 'Officiel',
    categoryColor: '#6366f1',
    flag: '⚽',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 11),
  },
  {
    id: '12',
    title: 'Maroc, Portugal, Espagne : les outsiders qui font peur',
    excerpt: 'Au-delà des favoris traditionnels, plusieurs nations pourraient créer la surprise. Le Maroc, finaliste en 2022, et le Portugal de Cristiano Ronaldo figurent parmi les grandes menaces.',
    url: 'https://www.eurosport.fr/football/',
    source: 'Eurosport',
    image: null,
    category: 'Mondial 2026',
    categoryColor: '#C89B3C',
    flag: '⚽',
    isNew: false,
    publishedAt: Date.UTC(2026, 3, 10),
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Actualites({ onBack }: { onBack: () => void }) {
  return (
    <PageLayout onBack={onBack} accentColor="#C89B3C" flag="📰" title="ACTUALITÉS" subtitle="Coupe du Monde 2026">

      <div style={{
        fontSize: 10, color: 'var(--text-3)', letterSpacing: 0.4,
        marginBottom: 16,
      }}>
        Mis à jour · Avril 2026
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ARTICLES.map(a => <ArticleCard key={a.id} article={a} />)}
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
        height: 110, overflow: 'hidden', position: 'relative',
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
