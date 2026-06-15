// Ponctuel : appelle le worker à la demande (?force=1) pour voir s'il fonctionne. À retirer.
const WORKER = 'https://trivela-live.thebigchungus08.workers.dev/?force=1'
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = (p) => fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } })

console.log('NOW:', new Date().toISOString())
try {
  const r = await fetch(WORKER)
  console.log(`worker ?force=1 → HTTP ${r.status} : ${(await r.text()).slice(0, 200)}`)
} catch (e) { console.log('worker injoignable:', String(e)) }

await new Promise(r => setTimeout(r, 4000))
const live = await (await sb('match_live?select=*&order=updated_at.desc')).json()
console.log('match_live après ping:', JSON.stringify(live))
if (Array.isArray(live) && live[0]?.updated_at) {
  console.log(`   âge dernière écriture : ${Math.round((Date.now() - Date.parse(live[0].updated_at)) / 1000)}s`)
}
