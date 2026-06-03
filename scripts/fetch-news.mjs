// Récupère les actualités "Coupe du Monde 2026" (Google Actualités RSS) côté
// serveur et les écrit dans la table Supabase `news`. Lancé par GitHub Actions.

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }

const QUERY = 'Coupe du Monde 2026 OR Mondial 2026 football'
const RSS = `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=fr&gl=FR&ceid=FR:fr`

const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

const tag = (b, n) => {
  const m = b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, 'i'))
  return m ? m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim() : ''
}
const stripHtml = s => s.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim()

function meta(text) {
  const t = text.toLowerCase()
  if (/\bbleus?\b|france|deschamps|mbapp/.test(t)) return ['🇫🇷', 'Équipe de France', '#3b82f6']
  if (/stade|azteca|metlife|enceinte/.test(t))      return ['🏟️', 'Stades', '#10b981']
  if (/billet|billetterie|ticket/.test(t))          return ['🎫', 'Billetterie', '#f59e0b']
  if (/fifa|var|règl|officiel|arbitr/.test(t))      return ['⚽', 'Officiel', '#6366f1']
  return ['⚽', 'Mondial 2026', '#C89B3C']
}

const res = await fetch(RSS, { headers: { 'User-Agent': 'Mozilla/5.0 (TRIVELA news bot)' } })
if (!res.ok) { console.error('RSS', res.status); process.exit(1) }
const xml = await res.text()

const rows = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 30).map(m => {
  const b = m[1]
  const rawTitle = tag(b, 'title'); const link = tag(b, 'link'); const source = tag(b, 'source')
  const pub = tag(b, 'pubDate'); const desc = tag(b, 'description')
  const title = source && rawTitle.endsWith(` - ${source}`)
    ? rawTitle.slice(0, -(` - ${source}`).length)
    : rawTitle.replace(/\s+-\s+[^-]+$/, '')
  const excerpt = stripHtml(desc).slice(0, 220)
  const [flag, category, color] = meta(`${title} ${excerpt}`)
  return {
    id: link, title: title.trim(), excerpt: excerpt || title.trim(), url: link,
    source: source || 'Google Actualités', category, category_color: color, flag,
    published_at: pub ? new Date(pub).toISOString() : new Date().toISOString(),
  }
}).filter(r => r.id && r.title)

console.log(`Articles récupérés : ${rows.length}`)
if (rows.length === 0) { console.error('Aucun article (flux vide ?)'); process.exit(1) }

const up = await sb('news?on_conflict=id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify(rows),
})
console.log('Upsert news :', up.status)
if (!up.ok) { console.error(await up.text().catch(() => '')); process.exit(1) }

// Purge des articles de plus de 21 jours
const cutoff = new Date(Date.now() - 21 * 864e5).toISOString()
const del = await sb(`news?published_at=lt.${cutoff}`, { method: 'DELETE' })
console.log('Purge anciens :', del.status)
console.log('✅ Terminé')
