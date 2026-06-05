// Rattache trivela.ch et www.trivela.ch au projet Cloudflare Pages "trivela".
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN   = process.env.CLOUDFLARE_API_TOKEN
const PROJECT = 'trivela'
if (!ACCOUNT || !TOKEN) { console.error('Secrets Cloudflare manquants'); process.exit(1) }

const domains = ['trivela.ch', 'www.trivela.ch']
for (const name of domains) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}/domains`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const j = await r.json().catch(() => ({}))
  const ok = j.success
  const detail = ok ? (j.result?.status || 'ajouté') : JSON.stringify(j.errors || j)
  console.log(`${name} → HTTP ${r.status} · ${ok ? '✅' : '⚠️'} ${detail}`)
}

// Liste finale des domaines du projet
const list = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}/domains`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then(r => r.json()).catch(() => ({}))
console.log('Domaines du projet :', JSON.stringify((list.result || []).map(d => ({ name: d.name, status: d.status }))))
