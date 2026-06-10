// TEST one-off : simule un match EN DIRECT pendant ~5 min puis nettoie tout.
// N'écrit JAMAIS dans match_results → le classement n'est pas affecté.
// Réinjecte le score toutes les ~4 s car le Worker live efface match_live chaque ~14 s.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ Secret manquant'); process.exit(1) }

const MATCH_ID = 'gA-md1-mex-zaf'   // Mexique vs Afrique du Sud (match d'ouverture)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

const upsertLive = (status, elapsed, h, a) => sb('match_live?on_conflict=match_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ match_id: MATCH_ID, status, elapsed, home_score: h, away_score: a, updated_at: new Date().toISOString() }]),
})
const upsertGoals = scorers => sb('match_goals?on_conflict=match_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify([{ match_id: MATCH_ID, scorers, updated_at: new Date().toISOString() }]),
})

// Scénario sur ~5 min : 0:0 → 1:0 (34') → 1:1 (58') → 2:1 (72')
function frame(t) {                       // t = secondes écoulées
  if (t < 60)   return { status: '1H', elapsed: 12, h: 0, a: 0, scorers: [] }
  if (t < 150)  return { status: '1H', elapsed: 34, h: 1, a: 0, scorers: [
    { p: 'R. Jiménez', s: 'home', t: 34, og: false, pen: false } ] }
  if (t < 240)  return { status: '2H', elapsed: 58, h: 1, a: 1, scorers: [
    { p: 'R. Jiménez', s: 'home', t: 34, og: false, pen: false },
    { p: 'L. Mbatha',  s: 'away', t: 58, og: false, pen: false } ] }
  return { status: '2H', elapsed: 72, h: 2, a: 1, scorers: [
    { p: 'R. Jiménez', s: 'home', t: 34, og: false, pen: false },
    { p: 'L. Mbatha',  s: 'away', t: 58, og: false, pen: false },
    { p: 'S. Giménez', s: 'home', t: 72, og: false, pen: true  } ] }
}

async function main() {
  const start = Date.now(), DURATION = 300_000   // ~5 min
  let lastScore = ''
  console.log(`▶️  TEST live démarré sur ${MATCH_ID} (~5 min)`)
  while (Date.now() - start < DURATION) {
    const t = Math.round((Date.now() - start) / 1000)
    const f = frame(t)
    await upsertLive(f.status, f.elapsed, f.h, f.a)
    const sc = `${f.h}:${f.a}`
    if (sc !== lastScore) { await upsertGoals(f.scorers); console.log(`  [${t}s] ${f.status} ${f.elapsed}' → ${sc}`); lastScore = sc }
    await sleep(4000)
  }
  // Nettoyage : retour à l'état normal (match à venir, pariable)
  await sb(`match_live?match_id=eq.${MATCH_ID}`, { method: 'DELETE' })
  await sb(`match_goals?match_id=eq.${MATCH_ID}`, { method: 'DELETE' })
  console.log('🧹 Nettoyage terminé — match remis en « à venir ». Classement intact.')
}
main().catch(e => { console.error('Erreur :', e); process.exit(1) })
