// Ponctuel : vérifie la page Statistiques admin. À retirer après.
//  1) admin_stats() doit EXISTER et REFUSER un appel non-admin (clé service = pas d'uid).
//  2) analytics_events doit contenir des données (lecture directe via service role).
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

// ── 1) Fonction admin_stats : présence + garde admin ─────────────────────────
const r = await sb('rpc/admin_stats', { method: 'POST', body: '{}' })
const body = await r.text()
if (r.status === 404 || /does not exist|could not find/i.test(body)) {
  console.log('❌ admin_stats INTROUVABLE — db-admin-stats.sql non appliqué.')
} else if (/administrateur/i.test(body) || r.status === 403 || r.status === 400) {
  console.log('✅ admin_stats installée et protégée (refus correct pour non-admin).')
} else {
  console.log(`ℹ️ admin_stats réponse inattendue (HTTP ${r.status}) : ${body.slice(0, 200)}`)
}

// ── 2) Données analytics_events (lecture service role, bypass RLS) ────────────
const head = await sb('analytics_events?select=id&limit=1', { headers: { Prefer: 'count=exact' } })
if (!head.ok) {
  console.log(`❌ analytics_events illisible (HTTP ${head.status}) — table absente ?`)
} else {
  const cr = head.headers.get('content-range') || ''
  const total = cr.split('/')[1] ?? '?'
  console.log(`✅ analytics_events OK — ${total} évènement(s) au total.`)

  const sampleRes = await sb('analytics_events?select=event,distinct_id,user_id,created_at&order=created_at.desc&limit=3000')
  const sample = sampleRes.ok ? await sampleRes.json() : []
  if (sample.length) {
    const visitors = new Set(sample.map(e => e.distinct_id)).size
    const registered = new Set(sample.filter(e => e.user_id).map(e => e.user_id)).size
    const byEvent = {}
    for (const e of sample) byEvent[e.event] = (byEvent[e.event] || 0) + 1
    const top = Object.entries(byEvent).sort((a, b) => b[1] - a[1]).slice(0, 8)
    console.log(`   Échantillon récent : ${sample.length} events · ${visitors} visiteurs uniques · ${registered} inscrits`)
    console.log(`   Dernier event : ${sample[0].created_at}`)
    console.log('   Top events (échantillon) :')
    for (const [ev, n] of top) console.log(`     • ${ev} : ${n}`)
  } else {
    console.log('   (aucun évènement encore — les données s\'accumuleront au fil de l\'usage sur trivela.ch)')
  }
}

// ── 3) Contexte : nb de joueurs + paris (affichés dans les KPIs) ─────────────
const pr = await sb('profiles?select=id&limit=1', { headers: { Prefer: 'count=exact' } })
const br = await sb('bets?select=id&limit=1', { headers: { Prefer: 'count=exact' } })
console.log(`Joueurs : ${(pr.headers.get('content-range')||'').split('/')[1] ?? '?'} · Paris : ${(br.headers.get('content-range')||'').split('/')[1] ?? '?'}`)
