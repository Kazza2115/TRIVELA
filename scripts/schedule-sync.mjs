// Ponctuel : reprend les DATES de TOUS les matchs depuis l'API-Football (source de
// vérité) et met à jour match_schedule.kickoff. Affiche aussi les diffs et les lignes
// de dates statiques (wc2026Matches.ts) à mettre à jour.
//   • APPLY non défini → RAPPORT seul (aucune écriture).
//   • APPLY=1          → écrit match_schedule.
import { buildFixtureMap } from './wc-map.mjs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY      = process.env.API_FOOTBALL_KEY
const API      = 'https://v3.football.api-sports.io'
if (!SERVICE || !KEY) { console.error('❌ Secret manquant (SUPABASE_SERVICE_ROLE_KEY / API_FOOTBALL_KEY)'); process.exit(1) }
const APPLY = process.env.APPLY === '1'
const sb  = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, {
  ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) },
})
const api = p => fetch(`${API}${p}`, { headers: { 'x-apisports-key': KEY } }).then(r => r.json())

const FR_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const pad = n => String(n).padStart(2, '0')
// Format UTC "D Mois" + "HH:MM" (comme wc2026Matches.ts, interprété en UTC par parseUTC).
const fmtStatic = iso => {
  const d = new Date(iso)
  return { date: `${d.getUTCDate()} ${FR_MONTHS[d.getUTCMonth()]}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
}

console.log(`=== SCHEDULE-SYNC (${APPLY ? 'ÉCRITURE' : 'RAPPORT seul'}) ===`)
try { const s = await api('/status'); const r = s.response?.requests || {}; console.log(`requêtes API ${r.current}/${r.limit_day}`) } catch {}

const fx = (await api('/fixtures?league=1&season=2026')).response || []
console.log(`fixtures API : ${fx.length}`)

// Cartographie fixture → notre match_id (groupes + éliminatoires).
const schedRows = await (await sb('match_schedule?select=match_id,kickoff')).json()
const cur = {}; for (const r of schedRows) cur[r.match_id] = r.kickoff
const validIds = new Set(schedRows.map(r => r.match_id))
const { map } = buildFixtureMap(fx, validIds)

// match_id → kickoff (ISO) depuis l'API.
const next = {}
for (const f of fx) {
  const id = map.get(f.fixture?.id)
  const dt = f.fixture?.date
  if (id && dt) next[id] = new Date(dt).toISOString()
}

// Diffs.
const KO = /^(r32|r16|qf|sf|3rd|final)/
const changed = []
for (const [id, iso] of Object.entries(next)) {
  const before = cur[id] ? new Date(cur[id]).toISOString() : null
  if (before !== iso) changed.push({ id, before, after: iso })
}
changed.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
console.log(`\n=== ${changed.length} changement(s) de date ===`)
for (const c of changed) console.log(`  ${c.id.padEnd(8)} ${c.before || '(absent)'}  →  ${c.after}`)

// Lignes de dates statiques (à reporter dans wc2026Matches.ts) pour les éliminatoires.
console.log('\n=== DATES STATIQUES (éliminatoires) à reporter dans wc2026Matches.ts ===')
for (const id of Object.keys(next).filter(id => KO.test(id)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
  const { date, time } = fmtStatic(next[id])
  console.log(`  ${id.padEnd(8)} date:'${date}', time:'${time}'`)
}

if (APPLY && changed.length) {
  const rows = changed.map(c => ({ match_id: c.id, kickoff: c.after }))
  const up = await sb('match_schedule?on_conflict=match_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows),
  })
  if (!up.ok) { console.error(`❌ Échec écriture (${up.status}) : ${await up.text()}`); process.exit(1) }
  console.log(`\n✅ ${rows.length} coup(s) d'envoi mis à jour dans match_schedule.`)
} else if (!APPLY) {
  console.log('\nℹ️  Mode RAPPORT : aucune écriture. Relancer avec APPLY=1 pour appliquer.')
} else {
  console.log('\n✅ Rien à changer — match_schedule déjà à jour.')
}
console.log('\n✅ Terminé.')
