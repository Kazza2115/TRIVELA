// Ponctuel : corrige dans match_schedule les coups d'envoi des tours que l'API-Football
// n'a PAS encore publiés (r16-7, r16-8, quarts, demies, 3e place, finale). Ces créneaux
// portaient des dates de seed périmées (ex. r16-8 / Suisse affiché « 10 juil 00 h » au
// lieu du 7 juil 22 h Genève). Dates officielles FIFA 2026 (UTC), recoupées avec l'API
// (les 6 huitièmes déjà publiés concordent : heures = UK/BST − 1 h = US ET + 4 h).
// Idempotent. Dès que l'API publie ces fixtures, syncSchedule confirmera/ajustera.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})

// slot → coup d'envoi officiel (UTC). Source : calendrier officiel FIFA World Cup 2026.
const KICKOFFS = {
  'r16-7': '2026-07-07T16:00:00+00:00',  // M95 · Atlanta       (12 h ET)
  'r16-8': '2026-07-07T20:00:00+00:00',  // M96 · Vancouver     (16 h ET) — Suisse, 22 h Genève
  'qf-1':  '2026-07-09T20:00:00+00:00',  // M97 · Boston        (16 h ET)
  'qf-2':  '2026-07-10T19:00:00+00:00',  // M98 · Los Angeles   (15 h ET)
  'qf-3':  '2026-07-11T21:00:00+00:00',  // M99 · Miami         (17 h ET)
  'qf-4':  '2026-07-12T01:00:00+00:00',  // M100 · Kansas City  (21 h ET, 11 juil)
  'sf-1':  '2026-07-14T19:00:00+00:00',  // M101 · Dallas       (15 h ET)
  'sf-2':  '2026-07-15T19:00:00+00:00',  // M102 · Atlanta      (15 h ET)
  '3rd':   '2026-07-18T21:00:00+00:00',  // M103 · Miami        (17 h ET)
  'final': '2026-07-19T19:00:00+00:00',  // M104 · MetLife/NY   (15 h ET)
}

const cur = {}
const er = await sb('match_schedule?select=match_id,kickoff')
if (er.ok) for (const r of await er.json()) cur[r.match_id] = r.kickoff ? new Date(r.kickoff).toISOString() : null

const rows = []
console.log('=== CORRECTION DATES KO (tours non encore publiés par l’API) ===')
for (const [id, iso] of Object.entries(KICKOFFS)) {
  const now = new Date(iso).toISOString()
  const was = cur[id] ? new Date(cur[id]).toISOString() : '—'
  if (was === now) { console.log(`  = ${id.padEnd(6)} déjà correct (${now})`); continue }
  console.log(`  ~ ${id.padEnd(6)} ${was}  →  ${now}`)
  rows.push({ match_id: id, kickoff: iso })
}
if (!rows.length) { console.log('\n✅ Rien à corriger.'); process.exit(0) }

const res = await sb('match_schedule?on_conflict=match_id', {
  method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
})
if (!res.ok) { console.error('❌ upsert échoué', res.status, await res.text()); process.exit(1) }
console.log(`\n✅ ${rows.length} coup(s) d'envoi corrigé(s) dans match_schedule.`)
