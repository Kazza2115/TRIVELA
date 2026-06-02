// Sauvegarde / restauration de la base Supabase (profiles, bets, match_results).
// MODE=backup  (défaut) → exporte chaque table en JSON dans ./db-backup/
// MODE=restore          → ré-injecte (upsert) les JSON de ./db-backup/ dans Supabase
//
// Lancé par le workflow backup.yml ; l'export est publié en artifact privé
// (jamais commité dans le dépôt public → données joueurs protégées).

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'

const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
const MODE     = process.env.MODE || 'backup'
if (!SERVICE) { console.error('SUPABASE_SERVICE_ROLE_KEY absent'); process.exit(1) }

const DIR    = 'db-backup'
const TABLES = [['profiles', 'created_at'], ['bets', 'created_at'], ['match_results', 'settled_at']]
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init,
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
    'Content-Type': 'application/json', ...(init.headers || {}) },
})

async function backup() {
  mkdirSync(DIR, { recursive: true })
  const manifest = { created_at: new Date().toISOString(), counts: {} }
  for (const [t, order] of TABLES) {
    const res = await sb(`${t}?select=*&order=${order}.asc&limit=100000`)
    if (!res.ok) { console.error(`${t}: HTTP ${res.status} — ${(await res.text()).slice(0, 150)}`); process.exit(1) }
    const rows = await res.json()
    writeFileSync(`${DIR}/${t}.json`, JSON.stringify(rows, null, 2))
    manifest.counts[t] = rows.length
    console.log(`✅ ${t}: ${rows.length} ligne(s) sauvegardée(s)`)
  }
  writeFileSync(`${DIR}/manifest.json`, JSON.stringify(manifest, null, 2))
  console.log(`\n🎉 Sauvegarde terminée — ${manifest.created_at}`)
}

async function restore() {
  // Ordre important : profiles avant bets (clé étrangère bets.user_id → profiles.id)
  for (const [t] of TABLES) {
    const file = `${DIR}/${t}.json`
    if (!existsSync(file)) { console.warn(`⚠️ ${file} absent — ignoré`); continue }
    const rows = JSON.parse(readFileSync(file, 'utf8'))
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const res = await sb(t, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      })
      if (!res.ok) { console.error(`${t} restore: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`); process.exit(1) }
    }
    console.log(`✅ ${t}: ${rows.length} ligne(s) restaurée(s)`)
  }
  console.log('\n🎉 Restauration terminée.')
}

;(MODE === 'restore' ? restore() : backup()).catch(e => { console.error(e); process.exit(1) })
