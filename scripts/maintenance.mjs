// Maintenance ponctuelle : KAZA → admin, vider le chat, supprimer tous les
// comptes SAUF KAZA. Sécurisé : abandonne si KAZA est introuvable.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const CONFIRM  = process.env.MAINT_CONFIRM
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
if (CONFIRM !== 'YES') { console.log('MAINT_CONFIRM != YES → rien fait (sécurité).'); process.exit(0) }

const sb   = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const auth = (path, init = {}) => fetch(`${SUPA_URL}${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

async function main() {
  // 1. Identifier KAZA
  const pr = await sb('profiles?pseudo=ilike.KAZA&select=id,pseudo')
  const kazas = pr.ok ? await pr.json() : []
  const keep = new Set(kazas.map(k => k.id))
  console.log('KAZA trouvé :', JSON.stringify(kazas))
  if (keep.size === 0) { console.error('❌ Profil KAZA introuvable — ABANDON (sécurité).'); process.exit(1) }

  // 2. KAZA admin (répare le bouton "Vider le chat")
  const up = await sb('profiles?pseudo=ilike.KAZA', {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ is_admin: true }) })
  console.log('KAZA is_admin = true →', up.status, up.ok ? '' : await up.text().catch(() => ''))

  // 3. Vider le chat (+ accusés de lecture)
  const dc = await sb('chat_messages?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  console.log('chat_messages vidés →', dc.status)
  const dr = await sb('chat_reads?user_id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
  console.log('chat_reads vidés →', dr.status)

  // 4. Supprimer tous les comptes SAUF KAZA
  let page = 1, removed = 0, kept = 0
  for (;;) {
    const res = await auth(`/auth/v1/admin/users?page=${page}&per_page=200`)
    const body = await res.json().catch(() => ({}))
    const users = body.users || []
    if (users.length === 0) break
    for (const u of users) {
      if (keep.has(u.id)) { kept++; continue }
      const d = await auth(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
      if (d.ok) removed++; else console.warn('  échec suppression', u.email, d.status)
    }
    if (users.length < 200) break
    page++
  }
  console.log(`✅ Comptes supprimés : ${removed} · conservé(s) (KAZA) : ${kept}`)
}
main().catch(e => { console.error(e); process.exit(1) })
