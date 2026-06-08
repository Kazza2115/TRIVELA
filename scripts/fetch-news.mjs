// Actualités "Coupe du Monde 2026" → table Supabase `news`. Lancé par GitHub Actions.
// Source principale : flux RSS d'éditeurs (vrais liens d'articles) → on en tire
// l'image (média RSS ou og:image) et un résumé propre. Complément Google
// Actualités (texte seul) pour compléter jusqu'à 20. Tolérant aux pannes.

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY

const MAX_ARTICLES = 20
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Flux d'éditeurs francophones (liens d'articles réels → image + résumé fiables).
const FEEDS = [
  'https://www.lequipe.fr/rss/actu_rss_Football.xml',
  'https://www.eurosport.fr/football/rss.xml',
  'https://www.lemonde.fr/football/rss_full.xml',
  'https://www.20minutes.fr/feeds/rss-sport.xml',
  'https://www.francetvinfo.fr/sports/foot.rss',
  'https://api.rtbf.be/rss/sport/football',
]
// Filtre Coupe du Monde 2026
const WC = /coupe du monde|mondial|world cup|fifa|cdm|2026|qualif|s[ée]lection|les bleus/i
// Repli Google Actualités (découverte large, texte seul)
const GNEWS = `https://news.google.com/rss/search?q=${encodeURIComponent('Coupe du Monde 2026 OR Mondial 2026 football')}&hl=fr&gl=FR&ceid=FR:fr`

const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

const tag = (b, n) => {
  const m = b.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`, 'i'))
  return m ? m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim() : ''
}
const stripHtml = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const decode = s => (s || '')
  .replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'").replace(/&apos;/g, "'")
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/\s+/g, ' ').trim()

function meta(text) {
  const t = text.toLowerCase()
  if (/\bbleus?\b|france|deschamps|mbapp/.test(t)) return ['🇫🇷', 'Équipe de France', '#3b82f6']
  if (/stade|azteca|metlife|enceinte/.test(t))      return ['🏟️', 'Stades', '#10b981']
  if (/billet|billetterie|ticket/.test(t))          return ['🎫', 'Billetterie', '#f59e0b']
  if (/fifa|var|règl|officiel|arbitr/.test(t))      return ['⚽', 'Officiel', '#6366f1']
  return ['⚽', 'Mondial 2026', '#C89B3C']
}

const BAD_IMG = /\/\/[a-z0-9.-]*\b(?:gstatic|google|googleusercontent)\.com/i
const BAD_DESC = /aggregated from sources|google\s*news/i

function metaContent(html, key) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, 'i')
  const m = html.match(re1) || html.match(re2)
  return m ? decode(m[1]) : ''
}

// Image directement présente dans l'item RSS (media:content / thumbnail / enclosure / <img>)
function imageFromItem(b) {
  let m = b.match(/<media:content[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)
        || b.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)
        || b.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i)
        || b.match(/<enclosure[^>]+type=["']image[^>]*url=["']([^"']+)["']/i)
        || b.match(/<img[^>]+src=["']([^"']+)["']/i)
  return m ? decode(m[1]) : ''
}

async function getHtml(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } })
    return await res.text()
  } finally { clearTimeout(timer) }
}

// Complète image + résumé depuis l'article réel (lien éditeur → og:image / og:description)
async function enrich(row) {
  try {
    const html = await getHtml(row.url)
    if (!row.image) {
      const img = metaContent(html, 'og:image') || metaContent(html, 'twitter:image')
      if (img && !BAD_IMG.test(img)) row.image = img
    }
    if (!row.excerpt) {
      const d = metaContent(html, 'og:description') || metaContent(html, 'description')
      if (d && !BAD_DESC.test(d)) row.excerpt = d.slice(0, 200)
    }
  } catch { /* ignore */ }
}

async function mapLimit(items, limit, fn) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]) }
  }))
}

const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const SRC_MAP = {
  'lequipe.fr': "L'Équipe", 'eurosport.fr': 'Eurosport', 'lemonde.fr': 'Le Monde',
  '20minutes.fr': '20 Minutes', 'francetvinfo.fr': 'France Info', 'rtbf.be': 'RTBF',
}
function sourceName(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    return SRC_MAP[h] || h.split('.')[0].replace(/^./, c => c.toUpperCase())
  } catch { return 'Actualités' }
}

function itemToRow(b) {
  const rawTitle = decode(tag(b, 'title'))
  let link = tag(b, 'link') || tag(b, 'guid')
  link = link.replace(/^<!\[CDATA\[/, '').trim()
  if (!rawTitle || !/^https?:\/\//.test(link)) return null
  const desc = decode(stripHtml(tag(b, 'description') || tag(b, 'content:encoded'))).slice(0, 200)
  const pub = tag(b, 'pubDate') || tag(b, 'dc:date')
  const [flag, category, color] = meta(`${rawTitle} ${desc}`)
  return {
    id: link, title: rawTitle, excerpt: desc, url: link, image: imageFromItem(b),
    source: sourceName(link), category, category_color: color, flag,
    published_at: pub ? new Date(pub).toISOString() : new Date().toISOString(),
    _t: rawTitle.slice(0, 70),
  }
}

async function fromFeed(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) })
    if (!res.ok) { console.warn(`  feed ${url} → HTTP ${res.status}`); return [] }
    const xml = await res.text()
    const items = [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map(m => itemToRow(m[1])).filter(Boolean)
    const kept = items.filter(r => WC.test(`${r.title} ${r.excerpt}`))
    console.log(`  feed ${url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]} : ${kept.length}/${items.length} CdM`)
    return kept
  } catch (e) { console.warn(`  feed ${url} → ${String(e).slice(0, 60)}`); return [] }
}

async function fromGNews() {
  try {
    const xml = await getHtml(GNEWS)
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
      const b = m[1]
      const rawTitle = tag(b, 'title'); const link = tag(b, 'link'); const source = tag(b, 'source')
      const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(` - ${source}`).length) : rawTitle
      const pub = tag(b, 'pubDate')
      const [flag, category, color] = meta(title)
      return {
        id: link, title: title.trim(), excerpt: '', url: link, image: '',
        source: source || 'Actualités', category, category_color: color, flag,
        published_at: pub ? new Date(pub).toISOString() : new Date().toISOString(),
        _t: title.slice(0, 70),
      }
    }).filter(r => r.id && r.title)
  } catch { return [] }
}

async function main() {
  if (!SERVICE) { console.error('⚠️  SUPABASE_SERVICE_ROLE_KEY absent — arrêt.'); return }

  // 1) Éditeurs (avec images)
  const feedLists = await Promise.all(FEEDS.map(fromFeed))
  let rows = feedLists.flat()

  // 2) Dédoublonnage par titre, tri récent → ancien
  const seen = new Set()
  rows = rows.filter(r => { const k = norm(r._t); if (seen.has(k)) return false; seen.add(k); return true })
  rows.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))

  // 3) Complément Google Actualités si moins de 20 (texte seul)
  if (rows.length < MAX_ARTICLES) {
    const g = await fromGNews()
    for (const r of g) {
      const k = norm(r._t)
      if (seen.has(k)) continue
      seen.add(k); rows.push(r)
      if (rows.length >= MAX_ARTICLES * 2) break
    }
  }

  rows = rows.slice(0, MAX_ARTICLES)
  console.log(`Articles : ${rows.length}`)
  if (rows.length === 0) { console.warn('⚠️  Aucun article.'); return }

  // 4) Enrichissement og:image / og:description pour ce qui manque (liens réels)
  await mapLimit(rows, 5, enrich)
  const withImg = rows.filter(r => r.image).length
  console.log(`Images : ${withImg}/${rows.length}`)

  // Nettoyage des champs internes
  const payload = rows.map(({ _t, ...r }) => r)

  const upsert = body => sb('news?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  })
  let up = await upsert(payload)
  if (!up.ok) {
    const detail = await up.text().catch(() => '')
    if (detail.includes('PGRST205')) { console.warn('⚠️  Table `news` absente — exécute db-news.sql.'); return }
    if (/image/i.test(detail) && /(column|find)/i.test(detail)) {
      console.warn('⚠️  Colonne `image` absente — écriture sans image.')
      up = await upsert(payload.map(({ image, ...r }) => r))
    }
  }
  console.log('Upsert news :', up.status)
  if (!up.ok) { console.warn('⚠️  Échec upsert :', await up.text().catch(() => '')); return }

  // 5) Ne garder que les 20 plus récents
  const cut = await sb(`news?select=published_at&order=published_at.desc&offset=${MAX_ARTICLES}&limit=1`)
  if (cut.ok) {
    const arr = await cut.json()
    if (arr.length && arr[0].published_at) {
      const del = await sb(`news?published_at=lt.${encodeURIComponent(arr[0].published_at)}`, { method: 'DELETE' })
      console.log('Purge (garde 20) :', del.status)
    }
  }
  console.log('✅ Terminé')
}

main().catch(e => { console.error('Erreur inattendue (ignorée) :', e); process.exit(0) })
