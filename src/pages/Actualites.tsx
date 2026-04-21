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
  url: string
}

const NEWS: Article[] = [
  {
    id: '1',
    category: 'Équipe de France',
    categoryColor: '#3b82f6',
    title: 'Mbappé : blessure au genou "totalement terminée", pleinement disponible',
    excerpt: 'Kylian Mbappé a confirmé le 1er avril que sa blessure ligamentaire au genou gauche était résolue. Il avait scoré deux jours plus tôt lors du match amical France–Brésil (2-1) en préparation du Mondial.',
    date: '1 avr. 2026',
    flag: '🇫🇷',
    isNew: true,
    url: 'https://www.foxsports.com/stories/soccer/mbappe-says-his-left-knee-injury-is-all-gone-as-france-ramps-up-for-the-world-cup',
  },
  {
    id: '2',
    category: 'Qualifications',
    categoryColor: '#ef4444',
    title: 'L\'Italie éliminée par la Bosnie — troisième Mondial de suite raté',
    excerpt: 'Défaite aux tirs au but à Zenica (1-1 a.p.). La Squadra Azzurra manque une troisième Coupe du monde consécutive. Le président de la Fédération italienne a démissionné dans la foulée.',
    date: '1 avr. 2026',
    flag: '🇮🇹',
    isNew: true,
    url: 'https://www.franceinfo.fr/coupe-du-monde/l-italie-ne-disputera-pas-la-coupe-du-monde-pour-la-troisieme-fois-de-suite-apres-sa-nouvelle-defaite-aux-barrages-face-a-la-bosnie-herzegovine_7907147.html',
  },
  {
    id: '3',
    category: 'Préparation',
    categoryColor: '#3b82f6',
    title: 'France 2-1 Brésil en amical : Mbappé buteur, les Bleus rassurent',
    excerpt: 'À 10 contre 11 pendant une partie du match, les Bleus ont renversé le Brésil (2-1) le 26 mars. Mbappé, sorti vainqueur de son duel face à Vinicius Jr., a marqué d\'entrée de jeu.',
    date: '26 mars 2026',
    flag: '⚽',
    isNew: true,
    url: 'https://www.aljazeera.com/sports/2026/3/26/mbappe-nets-for-10-man-france-in-win-against-brazil-in-world-cup-warm-up',
  },
  {
    id: '4',
    category: 'Officiel',
    categoryColor: '#6366f1',
    title: 'FIFA : 170 arbitres désignés pour la Coupe du Monde 2026',
    excerpt: 'Le 9 avril, la FIFA a officialisé la liste de 52 arbitres, 88 assistants et 30 officiels vidéo. L\'UEFA (15) et la CONMEBOL (12) dominent le contingent. Le Français Clément Turpin figure dans la liste.',
    date: '9 avr. 2026',
    flag: '🟨',
    isNew: true,
    url: 'https://inside.fifa.com/media-releases/fifa-world-cup-2026-match-referees-appointed',
  },
  {
    id: '5',
    category: 'Groupes',
    categoryColor: '#C89B3C',
    title: 'Groupe I : France avec Sénégal, Norvège et Irak',
    excerpt: 'Tiré au sort le 5 décembre 2025 au Kennedy Center de Washington, le groupe I promet d\'être piégeux. La France affronte le Sénégal le 16 juin à New York, l\'Irak le 22 juin à Philadelphie, et la Norvège le 26 juin à Boston.',
    date: '5 déc. 2025',
    flag: '🎲',
    isNew: false,
    url: 'https://www.franceinfo.fr/coupe-du-monde/coupe-du-monde-2026-l-equipe-de-france-herite-d-un-tirage-piegeux-avec-le-senegal-la-norvege-et-un-barragiste-pour-la-phase-de-groupes_7656004.html',
  },
  {
    id: '6',
    category: 'Stades',
    categoryColor: '#10b981',
    title: 'Match d\'ouverture : Mexique–Afrique du Sud à l\'Azteca le 11 juin',
    excerpt: 'Le mythique Estadio Azteca de Mexico City accueillera le coup d\'envoi du tournoi le 11 juin. Il devient le premier stade à abriter le match d\'ouverture d\'un Mondial pour la 3e fois (1970, 1986, 2026).',
    date: '11 juin 2026',
    flag: '🇲🇽',
    isNew: false,
    url: 'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/estadio-azteca-mexico-city-host-opening-match-world-cup-2026',
  },
  {
    id: '7',
    category: 'Équipe de France',
    categoryColor: '#3b82f6',
    title: 'Deschamps annoncera sa liste le 14 mai sur TF1',
    excerpt: 'C\'est officiel : Didier Deschamps dévoilera les 26 Bleus retenus pour le Mondial lors du journal de 20h sur TF1. Ce sera sa dernière liste avant de quitter son poste à l\'issue du tournoi.',
    date: '14 mai 2026',
    flag: '📋',
    isNew: false,
    url: 'https://www.topmercato.com/2066991-liste-didier-deschamps-coupe-monde-2026-date-quand-annonce/',
  },
  {
    id: '8',
    category: 'Groupes',
    categoryColor: '#C89B3C',
    title: 'Les 12 groupes au complet — tirage final officiel FIFA',
    excerpt: '48 équipes réparties en 12 groupes de 4. Les deux premiers de chaque groupe et les 8 meilleurs troisièmes accèdent aux 8es de finale, une nouveauté de ce format élargi inédit.',
    date: '5 déc. 2025',
    flag: '🌍',
    isNew: false,
    url: 'https://www.fifa.com/fr/articles/resultats-tirage-au-sort-mondial-2026',
  },
]

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {NEWS.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </PageLayout>
  )
}

function ArticleCard({ article }: { article: Article }) {
  const open = () => window.open(article.url, '_blank', 'noopener,noreferrer')

  return (
    <div
      onClick={open}
      role="link"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && open()}
      onPointerDown={e => (e.currentTarget.style.opacity = '0.75')}
      onPointerUp={e   => (e.currentTarget.style.opacity = '1')}
      onPointerLeave={e => (e.currentTarget.style.opacity = '1')}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
        transition: 'opacity 0.12s, box-shadow 0.18s',
      }}
    >
      {/* Accent bar */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${article.categoryColor}, ${article.categoryColor}44)`,
      }} />

      <div style={{ padding: '14px 16px 15px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            fontSize: 8, fontWeight: 800, letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: article.categoryColor,
            background: `${article.categoryColor}14`,
            border: `1px solid ${article.categoryColor}30`,
            borderRadius: 5, padding: '3px 7px',
          }}>
            {article.category}
          </span>

          {article.isNew && (
            <span style={{
              fontSize: 8, fontWeight: 800, letterSpacing: 1,
              color: '#0D0800',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              borderRadius: 5, padding: '3px 6px',
            }}>
              NEW
            </span>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 18 }}>{article.flag}</span>
        </div>

        {/* Title */}
        <div style={{
          fontFamily: "'Bebas Neue', cursive",
          fontSize: 19, letterSpacing: 1.5,
          color: 'var(--text-1)', lineHeight: 1.15,
          marginBottom: 8,
        }}>
          {article.title}
        </div>

        {/* Excerpt */}
        <p style={{
          fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55,
          marginBottom: 12,
        }}>
          {article.excerpt}
        </p>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: 0.4 }}>
            {article.date}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: article.categoryColor,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            Lire l'article
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
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
