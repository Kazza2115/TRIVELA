// Diagnostic de mise en ligne TRIVELA — vérifie le backend de production.
// Lancé manuellement via le workflow "verify-setup.yml" (workflow_dispatch).
// Ne modifie rien de durable : toute donnée de test créée est supprimée.
//
// Vérifie :
//   1. football-data.org couvre la Coupe du Monde 2026
//   2. table match_results
//   3. colonnes bets.locked & profiles.favorites
//   4. fonction settle_match()
//   5. trigger de création de profil à l'inscription (test bout-en-bout)

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const FOOT_KEY = process.env.FOOTBALL_DATA_API_KEY

const results = []
const pass = (name, detail = '') => results.push({ ok: true,  name, detail })
const fail = (name, detail = '') => results.push({ ok: false, name, detail })

const sb = (path, init = {}) => fetch(`${SUPA_URL}${path}`, {
  ...init,
  headers: {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  },
})

// ── 1. football-data.org : couverture WC 2026 ────────────────────────────────
async function checkFootballApi() {
  if (!FOOT_KEY) { fail('football-data.org', 'FOOTBALL_DATA_API_KEY absent'); return }
  try {
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?season=2026',
      { headers: { 'X-Auth-Token': FOOT_KEY } }
    )
    const body = await res.json().catch(() => ({}))
    if (res.status === 403 || body.errorCode === 403) {
      fail('football-data.org WC 2026', `accès restreint (plan ne couvre pas WC) — ${body.message || res.status}`)
    } else if (!res.ok) {
      fail('football-data.org WC 2026', `HTTP ${res.status} — ${body.message || ''}`)
    } else {
      const n = body.matches?.length ?? 0
      pass('football-data.org WC 2026', `${n} match(s) renvoyés par l'API`)
    }
  } catch (e) {
    fail('football-data.org WC 2026', e.message)
  }
}

// ── 2. table match_results ───────────────────────────────────────────────────
async function checkMatchResults() {
  const res = await sb('/rest/v1/match_results?select=match_id&limit=1')
  if (res.ok) pass('table match_results')
  else fail('table match_results', `HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`)
}

// ── 3. colonnes bets.locked & profiles.favorites ─────────────────────────────
async function checkColumn(table, column) {
  const res = await sb(`/rest/v1/${table}?select=${column}&limit=1`)
  if (res.ok) pass(`colonne ${table}.${column}`)
  else fail(`colonne ${table}.${column}`, `HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`)
}

// ── 4. fonction settle_match() (dummy + nettoyage) ───────────────────────────
async function checkSettleMatch() {
  const dummy = `__verify_${Date.now()}`
  const res = await sb('/rest/v1/rpc/settle_match', {
    method: 'POST',
    body: JSON.stringify({ p_match_id: dummy, p_home_score: 0, p_away_score: 0 }),
  })
  if (res.status === 404) {
    fail('fonction settle_match', 'introuvable (404) — la migration SQL n\'a pas été exécutée')
    return
  }
  if (!res.ok) {
    fail('fonction settle_match', `HTTP ${res.status} — ${(await res.text()).slice(0, 120)}`)
    return
  }
  pass('fonction settle_match', 'appelable')
  // Nettoyage de la ligne de test (aucun pari ne portait ce match_id → aucun score modifié)
  const del = await sb(`/rest/v1/match_results?match_id=eq.${dummy}`, { method: 'DELETE' })
  if (del.ok) pass('nettoyage settle_match', 'ligne de test supprimée')
  else fail('nettoyage settle_match', `HTTP ${del.status} — supprime manuellement match_id=${dummy}`)
}

// ── 5. trigger de création de profil (création + vérif + suppression user) ───
async function checkProfileTrigger() {
  const email = `verify_${Date.now()}@trivela-verify.invalid`
  const meta  = { pseudo: `verify_${Date.now()}`, country_code: 'fr', country_name: 'France' }
  const create = await sb('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: crypto.randomUUID(), email_confirm: true, user_metadata: meta }),
  })
  const created = await create.json().catch(() => ({}))
  if (!create.ok || !created.id) {
    fail('trigger profil', `création user impossible — HTTP ${create.status} ${created.msg || ''}`)
    return
  }
  // Laisse le trigger s'exécuter
  await new Promise(r => setTimeout(r, 1500))
  const prof = await sb(`/rest/v1/profiles?id=eq.${created.id}&select=pseudo`)
  const rows = await prof.json().catch(() => [])
  if (Array.isArray(rows) && rows.length === 1) {
    pass('trigger profil', 'profil créé automatiquement à l\'inscription')
  } else {
    fail('trigger profil', 'aucun profil créé → trigger on_auth_user_created manquant')
  }
  // Nettoyage : suppression du user de test (cascade → supprime le profil)
  const del = await sb(`/auth/v1/admin/users/${created.id}`, { method: 'DELETE' })
  if (del.ok) pass('nettoyage trigger', 'user de test supprimé')
  else fail('nettoyage trigger', `HTTP ${del.status} — supprime manuellement le user ${created.id}`)
}

async function main() {
  if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
  console.log('── Diagnostic TRIVELA ──\n')
  await checkFootballApi()
  await checkMatchResults()
  await checkColumn('bets', 'locked')
  await checkColumn('profiles', 'favorites')
  await checkSettleMatch()
  await checkProfileTrigger()

  console.log('\n── Résultats ──')
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  }
  const failed = results.filter(r => !r.ok && !r.name.startsWith('nettoyage'))
  console.log(`\n${failed.length === 0 ? '🎉 Tout est opérationnel.' : `⚠️ ${failed.length} problème(s) à corriger.`}`)
}

main().catch(e => { console.error(e); process.exit(1) })
