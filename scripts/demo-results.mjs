// Démo : insère 1-2 résultats FINAUX (matchs terminés) pour visualiser le rendu
// (carte grisée + 🔥 sur le vainqueur). MODE=seed pour créer, cleanup pour retirer.
// N'attribue PAS de points (insert direct dans match_results, pas settle_match).

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const MODE     = process.env.MODE || 'seed'
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }

const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

// 2 matchs de J1 : une victoire à domicile, une victoire à l'extérieur (upset)
const DEMO = [
  { match_id: 'gA-md1-mex-zaf', home_score: 2, away_score: 1 }, // Mexique bat Afrique du Sud → 🔥 domicile
  { match_id: 'gC-md1-bra-mar', home_score: 1, away_score: 2 }, // Maroc crée la surprise → 🔥 extérieur
]
const ids = DEMO.map(d => d.match_id)

async function main() {
  if (MODE === 'cleanup') {
    const del = await sb(`match_results?match_id=in.(${ids.join(',')})`, { method: 'DELETE' })
    console.log('🧹 Suppression démo :', del.status)
    return
  }
  const rows = DEMO.map(d => ({ ...d, settled_at: new Date().toISOString() }))
  const up = await sb('match_results?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  })
  console.log('⚽ Insert résultats démo :', up.status)
  if (!up.ok) { console.error(await up.text().catch(() => '')); process.exit(1) }
  console.log(`✅ ${rows.length} matchs terminés de démo : ${ids.join(', ')}`)
}
main().catch(e => { console.error(e); process.exit(1) })
