// TRIVELA — Edge Function "news"
// Récupère les actualités "Coupe du Monde 2026" depuis Google Actualités (RSS)
// CÔTÉ SERVEUR (pas de CORS, pas de proxy tiers) et renvoie du JSON à l'app.
//
// Déploiement :
//   • Dashboard Supabase → Edge Functions → "Deploy a new function" → nom: news
//     → coller ce code → Deploy.  (Laisse "Verify JWT" activé : l'app envoie la clé anon.)
//   • OU en CLI :  supabase functions deploy news --project-ref tivcwtzzhrsdfzxirjkw

const QUERY = 'Coupe du Monde 2026 OR Mondial 2026 football'
const RSS = `https://news.google.com/rss/search?q=${encodeURIComponent(QUERY)}&hl=fr&gl=FR&ceid=FR:fr`

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))
  if (!m) return ''
  return m[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const r = await fetch(RSS, { headers: { 'User-Agent': 'Mozilla/5.0 (TRIVELA news bot)' } })
    if (!r.ok) throw new Error(`RSS ${r.status}`)
    const xml = await r.text()

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 25).map(m => {
      const b = m[1]
      return {
        title: tag(b, 'title'),
        link: tag(b, 'link'),
        source: tag(b, 'source'),
        pubDate: tag(b, 'pubDate'),
        description: tag(b, 'description'),
      }
    })

    return new Response(JSON.stringify({ items, fetchedAt: Date.now() }), {
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=120' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), items: [] }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
