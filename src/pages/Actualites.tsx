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
}

const NEWS: Article[] = [
  {
    id: '1',
    category: 'Joueurs',
    categoryColor: '#3b82f6',
    title: 'Mbappé : "Je suis à 100 %, prêt à tout donner"',
    excerpt: 'Le capitaine des Bleus s\'est exprimé en conférence de presse à Clairefontaine. Après une saison compliquée, Kylian Mbappé assure être au sommet de sa forme.',
    date: '20 avr. 2026',
    flag: '🇫🇷',
    isNew: true,
  },
  {
    id: '2',
    category: 'Officiel',
    categoryColor: '#6366f1',
    title: 'La FIFA dévoile le ballon officiel « Unity 26 »',
    excerpt: 'Le ballon officiel du Mondial 2026 a été présenté lors d\'une cérémonie à Miami. Conçu par Adidas, il rend hommage aux couleurs des trois nations hôtes.',
    date: '18 avr. 2026',
    flag: '⚽',
    isNew: true,
  },
  {
    id: '3',
    category: 'Groupes',
    categoryColor: '#C89B3C',
    title: 'Les 12 groupes de la phase de poules sont connus',
    excerpt: 'Le tirage au sort a eu lieu à Miami. La France hérite du Groupe D avec le Portugal, le Mexique et le Sénégal. Un groupe de la mort en perspective.',
    date: '15 avr. 2026',
    flag: '🎲',
    isNew: true,
  },
  {
    id: '4',
    category: 'Stades',
    categoryColor: '#10b981',
    title: 'MetLife Stadium accueillera la grande finale le 19 juillet',
    excerpt: 'Le stade du New Jersey, d\'une capacité de 82 500 places, sera le théâtre de la finale. La ville de New York se prépare à un événement historique.',
    date: '12 avr. 2026',
    flag: '🏟️',
  },
  {
    id: '5',
    category: 'Billetterie',
    categoryColor: '#f59e0b',
    title: 'Record absolu : 3,2 millions de billets vendus',
    excerpt: 'La FIFA a confirmé que 3,2 millions de billets ont été écoulés, dépassant le record du Qatar. La demande est particulièrement forte pour les matchs aux États-Unis.',
    date: '10 avr. 2026',
    flag: '🎫',
  },
  {
    id: '6',
    category: 'Équipes',
    categoryColor: '#ef4444',
    title: 'L\'Argentine, tenante du titre, arrive en favorite',
    excerpt: 'Lionel Messi a confirmé sa participation à ce qui pourrait être son ultime Mondial. La Albiceleste s\'entraîne depuis trois semaines à Buenos Aires.',
    date: '8 avr. 2026',
    flag: '🇦🇷',
  },
  {
    id: '7',
    category: 'Joueurs',
    categoryColor: '#3b82f6',
    title: 'Vinicius Jr. : "Gagner le Mondial est mon obsession"',
    excerpt: 'L\'attaquant du Real Madrid s\'est posé en leader de la Seleção. Après deux Coupes du monde décevantes, le Brésil veut renouer avec la gloire.',
    date: '5 avr. 2026',
    flag: '🇧🇷',
  },
  {
    id: '8',
    category: 'Stades',
    categoryColor: '#10b981',
    title: 'Estadio Azteca rénové : l\'ouverture se jouera à Mexico',
    excerpt: 'Le mythique stade mexicain, qui accueillera le match d\'ouverture le 11 juin, a achevé sa rénovation totale. Sa capacité est portée à 87 000 places.',
    date: '3 avr. 2026',
    flag: '🇲🇽',
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
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'opacity 0.15s',
        cursor: 'default',
      }}
    >
      {/* Accent bar */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${article.categoryColor}, ${article.categoryColor}44)`,
      }} />

      <div style={{ padding: '14px 16px 16px' }}>
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
              color: '#fff',
              background: 'linear-gradient(135deg,#C89B3C,#E8D080)',
              borderRadius: 5, padding: '3px 6px',
            }}>
              NEW
            </span>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 20 }}>{article.flag}</span>
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
          fontSize: 10, color: 'var(--text-3)', fontWeight: 600,
          letterSpacing: 0.4,
        }}>
          {article.date}
        </div>
      </div>
    </div>
  )
}
