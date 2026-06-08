// Récupère les actualités "Coupe du Monde 2026" (Google Actualités RSS) côté
// serveur et les écrit dans la table Supabase `news`. Lancé par GitHub Actions.
// Pour chaque article on résout l'Open Graph (og:image + og:description) afin
// d'afficher une vraie image et un vrai résumé (et jamais le fouillis du flux).
// Tolérant aux pannes : journalise et sort en succès (pas de run rouge).
// (colonne image active)

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY

const MAX_ARTICLES = 20
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

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
const decode = s => (s || '')
  .replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&#x27;/gi, "'")
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim()

function meta(text) {
  const t = text.toLowerCase()
  if (/\bbleus?\b|france|deschamps|mbapp/.test(t)) return ['🇫🇷', 'Équipe de France', '#3b82f6']
  if (/stade|azteca|metlife|enceinte/.test(t))      return ['🏟️', 'Stades', '#10b981']
  if (/billet|billetterie|ticket/.test(t))          return ['🎫', 'Billetterie', '#f59e0b']
  if (/fifa|var|règl|officiel|arbitr/.test(t))      return ['⚽', 'Officiel', '#6366f1']
  return ['⚽', 'Mondial 2026', '#C89B3C']
}

// Extrait une balise <meta property|name="X" content="Y"> (ordre des attributs indifférent)
function metaContent(html, key) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, 'i')
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, 'i')
  const m = html.match(re1) || html.match(re2)
  return m ? decode(m[1]) : ''
}

async function getHtml(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } })
    const html = await res.text()
    return { html, finalUrl: res.url }
  } finally { clearTimeout(timer) }
}

// À rejeter : images Google/gstatic et le résumé générique de Google Actualités.
const BAD_IMG = /\/\/[a-z0-9.-]*\b(?:gstatic|google|googleusercontent)\.com/i
const BAD_DESC = /aggregated from sources|google\s*news|coverage,\s*aggregated/i
const NOT_GOOGLE = /https?:\/\/(?!(?:[a-z0-9.-]*\.)?(?:google|gstatic|googleusercontent|youtube|ggpht)\.[a-z.]+)[^\s"'<>]+/i

// Décode l'URL réelle de l'éditeur encodée dans le lien Google Actualités.
function decodeGoogleNewsUrl(link) {
  const m = link.match(/\/articles\/([^?/]+)/)
  if (!m) return null
  let s = m[1].replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  let raw
  try { raw = Buffer.from(s, 'base64').toString('latin1') } catch { return null }
  const u = raw.match(/https?:\/\/[^\x00-\x1f\x80-\xff"'<>\\]+/)
  return u ? u[0] : null
}

// Résout l'image + le résumé d'un article (lien Google Actualités → éditeur).
async function resolveOg(link) {
  // 1) URL réelle de l'éditeur : décodage direct, sinon on suit le lien.
  let target = decodeGoogleNewsUrl(link)
  if (!target) {
    try {
      const { html, finalUrl } = await getHtml(link)
      if (!/news\.google|consent\.google/.test(finalUrl)) {
        target = finalUrl
      } else {
        const canon = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
        const any = html.match(NOT_GOOGLE)
        target = (canon && canon[1]) || (any && any[0]) || null
      }
    } catch { /* ignore */ }
  }
  if (!target || !NOT_GOOGLE.test(target)) return { img: null, desc: '' }

  // 2) og:image + og:description sur le vrai article, en filtrant le bruit Google.
  try {
    const { html } = await getHtml(target)
    let img  = metaContent(html, 'og:image') || metaContent(html, 'twitter:image')
    let desc = metaContent(html, 'og:description') || metaContent(html, 'description')
    if (img && BAD_IMG.test(img)) img = ''
    if (desc && BAD_DESC.test(desc)) desc = ''
    return { img: img || null, desc: desc || '' }
  } catch {
    return { img: null, desc: '' }
  }
}

async function mapLimit(items, limit, fn) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]) }
  })
  await Promise.all(workers)
}

async function main() {
  if (!SERVICE) { console.error('⚠️  SUPABASE_SERVICE_ROLE_KEY absent — arrêt.'); return }

  let xml = ''
  try {
    const res = await fetch(RSS, { headers: { 'User-Agent': UA } })
    if (!res.ok) { console.warn(`⚠️  Flux RSS indisponible (HTTP ${res.status}).`); return }
    xml = await res.text()
  } catch (e) {
    console.warn('⚠️  Flux RSS injoignable :', String(e)); return
  }

  const rows = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, MAX_ARTICLES).map(m => {
    const b = m[1]
    const rawTitle = tag(b, 'title'); const link = tag(b, 'link'); const source = tag(b, 'source')
    const pub = tag(b, 'pubDate')
    const title = source && rawTitle.endsWith(` - ${source}`)
      ? rawTitle.slice(0, -(` - ${source}`).length)
      : rawTitle.replace(/\s+-\s+[^-]+$/, '')
    const [flag, category, color] = meta(title)
    return {
      id: link, title: title.trim(), excerpt: '', url: link, image: null,
      source: source || 'Actualités', category, category_color: color, flag,
      published_at: pub ? new Date(pub).toISOString() : new Date().toISOString(),
    }
  }).filter(r => r.id && r.title)

  console.log(`Articles récupérés : ${rows.length}`)
  if (rows.length === 0) { console.warn('⚠️  Aucun article (flux vide).'); return }

  // Enrichissement Open Graph (image + résumé propre), en parallèle limité.
  let withImg = 0, withDesc = 0
  await mapLimit(rows, 5, async r => {
    const { img, desc } = await resolveOg(r.id)
    if (img)  { r.image = img; withImg++ }
    if (desc) { r.excerpt = desc.slice(0, 200); withDesc++ }
  })
  console.log(`Open Graph → images : ${withImg}/${rows.length} · résumés : ${withDesc}/${rows.length}`)

  const upsert = body => sb('news?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(body),
  })

  let up = await upsert(rows)
  if (!up.ok) {
    const detail = await up.text().catch(() => '')
    if (detail.includes('PGRST205')) {
      console.warn('⚠️  Table `news` absente — exécute db-news.sql dans Supabase.'); return
    }
    if (/image/i.test(detail) && /(column|find)/i.test(detail)) {
      // La colonne `image` n'existe pas encore → on écrit sans elle.
      console.warn('⚠️  Colonne `image` absente — écriture sans image. Ajoute : alter table news add column if not exists image text;')
      const slim = rows.map(({ image, ...r }) => r)
      up = await upsert(slim)
    }
  }
  console.log('Upsert news :', up.status)
  if (!up.ok) { console.warn('⚠️  Échec de l\'upsert :', await up.text().catch(() => '')); return }

  // Ne garder que les 20 plus récents : purge propre via un seuil de date
  // (le 21e article le plus récent) — pas d'échappement d'URL hasardeux.
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
