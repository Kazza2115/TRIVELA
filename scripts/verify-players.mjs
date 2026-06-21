// Ponctuel : vérifie par joueur (sans plafond) score vs somme des points. À retirer.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = (p) => fetch(`${SUPA_URL}/rest/v1/${p}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }).then(r => r.json())
const names = ['Omega', 'CoreYass', 'Evita', 'KAZA', 'JohanW', 'Yagami_Joestar']
for (const n of names) {
  const pr = await sb(`profiles?pseudo=ilike.${encodeURIComponent(n)}&select=id,pseudo,score`)
  if (!pr[0]) { console.log(`${n} : introuvable`); continue }
  const bets = await sb(`bets?user_id=eq.${pr[0].id}&select=points`)
  const sum = bets.reduce((s, b) => s + (b.points || 0), 0)
  const ok = sum === pr[0].score
  console.log(`${ok ? '✅' : '❌'} ${pr[0].pseudo} : score=${pr[0].score} · somme(${bets.length} paris)=${sum}${ok ? '' : '  ← ÉCART RÉEL'}`)
}
