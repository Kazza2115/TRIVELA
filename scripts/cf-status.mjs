const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN   = process.env.CLOUDFLARE_API_TOKEN
const PROJECT = 'trivela'
const j = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/${PROJECT}/domains`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
}).then(r => r.json()).catch(e => ({ error: String(e) }))
for (const d of (j.result || [])) {
  console.log(`${d.name} → status=${d.status} · cert=${d.validation_data?.status || d.certificate_authority || 'n/a'}`)
}
if (!j.result) console.log('Réponse:', JSON.stringify(j).slice(0, 400))

// check 1780662243
