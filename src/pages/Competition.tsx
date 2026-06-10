import PageLayout from './PageLayout'
import { COMPETITIONS } from '../data/continentStats'

interface Props {
  conf: string
  onBack: () => void
}

const Flag = ({ code, size = 22 }: { code: string; size?: number }) => (
  <img
    src={`https://flagcdn.com/w40/${code}.png`}
    alt=""
    style={{
      width: size, height: Math.round(size * 0.67), objectFit: 'cover',
      borderRadius: 3, flexShrink: 0,
      boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      border: '1px solid rgba(255,255,255,0.10)',
    }}
  />
)

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3 style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, fontWeight: 800, letterSpacing: 1.4,
        textTransform: 'uppercase', color: 'var(--text-3)', margin: '0 0 10px',
      }}>
        <span style={{ width: 14, height: 2, borderRadius: 2, background: color }} />
        {title}
      </h3>
      {children}
    </section>
  )
}

const card = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-sm)',
}

export default function Competition({ conf, onBack }: Props) {
  const data = COMPETITIONS[conf]

  if (!data) {
    return (
      <PageLayout onBack={onBack} accentColor="#C89B3C" flag="🌐" title="Compétition" subtitle="">
        <p style={{ color: 'var(--text-3)', textAlign: 'center', marginTop: 40 }}>
          Aucune statistique disponible pour ce continent.
        </p>
      </PageLayout>
    )
  }

  const c = data.color
  const maxTitles = Math.max(...data.titles.map(t => t.count))

  return (
    <PageLayout
      onBack={onBack}
      accentColor={c}
      flag={data.emoji}
      title={data.competition}
      subtitle={`${data.region} · ${data.editions}`}
    >
      {/* Bandeau d'accroche */}
      <div style={{
        ...card,
        padding: '14px 16px', marginBottom: 22,
        borderLeft: `3px solid ${c}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 30, lineHeight: 1 }}>{data.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>
            {data.tagline}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            Première édition en {data.founded}
          </div>
        </div>
      </div>

      {/* ── Palmarès ── */}
      <Section title="Palmarès" color={c}>
        <div style={{ ...card, padding: '6px 0', overflow: 'hidden' }}>
          {data.titles.map((t, i) => (
            <div key={t.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <span style={{
                width: 22, fontSize: 13, fontWeight: 800,
                color: i === 0 ? c : 'var(--text-3)', textAlign: 'center', flexShrink: 0,
              }}>
                {i + 1}
              </span>
              {t.code ? <Flag code={t.code} /> : <span style={{ fontSize: 18 }}>🏳️</span>}
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-1)', minWidth: 0 }}>
                {t.name}
              </span>
              {/* Barre proportionnelle */}
              <div style={{ width: 70, height: 6, borderRadius: 3, background: 'var(--bg-fill)', overflow: 'hidden', flexShrink: 0 }}>
                <div style={{ width: `${(t.count / maxTitles) * 100}%`, height: '100%', background: c, borderRadius: 3 }} />
              </div>
              <span style={{
                minWidth: 46, textAlign: 'right', fontSize: 13, fontWeight: 800,
                color: 'var(--text-1)', flexShrink: 0,
              }}>
                {t.count} {t.count > 1 ? 'titres' : 'titre'}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Finales récentes ── */}
      <Section title="Finales récentes" color={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.recentFinals.map(f => (
            <div key={f.year} style={{ ...card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 1,
                color: c, minWidth: 40, flexShrink: 0,
              }}>
                {f.year}
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Flag code={f.winnerCode} size={20} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.winner}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>{f.score}</span>
                <span style={{ fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.runnerUp}
                </span>
                <Flag code={f.runnerUpCode} size={20} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Meilleurs buteurs ── */}
      {data.topScorers && data.topScorers.length > 0 && (
        <Section title="Meilleurs buteurs (histoire)" color={c}>
          <div style={{ ...card, padding: '6px 0', overflow: 'hidden' }}>
            {data.topScorers.map((s, i) => (
              <div key={s.name} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>
                  {i === 0 ? '👑' : '⚽'}
                </span>
                <Flag code={s.countryCode} size={20} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.country}</div>
                </div>
                <span style={{
                  fontFamily: "'Bebas Neue', cursive", fontSize: 20, letterSpacing: 1,
                  color: c, flexShrink: 0,
                }}>
                  {s.goals}<span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 3 }}>buts</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Records ── */}
      <Section title="Records" color={c}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.records.map(r => (
            <div key={r.label} style={{ ...card, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: c, marginBottom: 3 }}>
                {r.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{r.value}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Faits marquants ── */}
      <Section title="Faits marquants" color={c}>
        <div style={{ ...card, padding: '4px 16px' }}>
          {data.facts.map((f, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10, padding: '11px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            }}>
              <span style={{ color: c, fontWeight: 800, flexShrink: 0 }}>›</span>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-2)' }}>{f}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Prochaine édition ── */}
      {data.nextEdition && (
        <div style={{
          ...card, padding: '14px 16px',
          background: `linear-gradient(135deg, ${c}1A, transparent)`,
          borderColor: `${c}55`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 26 }}>📅</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: c, marginBottom: 2 }}>
              Prochaine édition
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>
              {data.nextEdition.year} · {data.nextEdition.host}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
