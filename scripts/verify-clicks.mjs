// Ponctuel : vérifie que les nouveaux évènements (click, page_time) remontent. À retirer après.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const countOf = async (q) => {
  const r = await sb(`${q}&select=id&limit=1`, { headers: { Prefer: 'count=exact' } })
  return r.ok ? ((r.headers.get('content-range') || '').split('/')[1] ?? '?') : `err${r.status}`
}

// ── Clics ────────────────────────────────────────────────────────────────────
console.log(`🖱️  Évènements 'click' : ${await countOf('analytics_events?event=eq.click')}`)
const cr = await sb("analytics_events?event=eq.click&select=properties,created_at&order=created_at.desc&limit=500")
const clicks = cr.ok ? await cr.json() : []
if (clicks.length) {
  const byLabel = {}
  for (const e of clicks) { const l = e.properties?.label ?? '(sans texte)'; byLabel[l] = (byLabel[l] || 0) + 1 }
  console.log(`   Dernier clic : ${clicks[0].created_at}`)
  console.log('   Top libellés (échantillon) :')
  for (const [l, n] of Object.entries(byLabel).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`     • "${l}" : ${n}`)
} else {
  console.log('   (aucun clic encore — navigue un peu sur trivela.ch)')
}

// ── Temps par page ───────────────────────────────────────────────────────────
console.log(`\n⏱️  Évènements 'page_time' : ${await countOf('analytics_events?event=eq.page_time')}`)
const pr = await sb("analytics_events?event=eq.page_time&select=properties,created_at&order=created_at.desc&limit=500")
const times = pr.ok ? await pr.json() : []
if (times.length) {
  const bySection = {}
  let totAll = 0, n = 0
  for (const e of times) {
    const s = e.properties?.section ?? '(inconnu)'
    const sec = Number(e.properties?.seconds ?? 0)
    if (!Number.isFinite(sec)) continue
    bySection[s] = bySection[s] || { total: 0, n: 0 }
    bySection[s].total += sec; bySection[s].n++; totAll += sec; n++
  }
  console.log(`   Dernier : ${times[0].created_at} · temps moyen global ≈ ${n ? Math.round(totAll / n) : 0}s`)
  console.log('   Par section (échantillon) :')
  for (const [s, v] of Object.entries(bySection).sort((a, b) => b[1].total - a[1].total).slice(0, 8)) {
    console.log(`     • ${s} : total ${v.total}s · moy ${Math.round(v.total / v.n)}s (${v.n} vues)`)
  }
} else {
  console.log('   (aucun temps encore — change de page/onglet sur trivela.ch pour en générer)')
}
