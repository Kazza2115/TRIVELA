// Ponctuel : recalcule profiles.score = somme des points (corrige le gonflement). À retirer.
import { reconcileScores } from './wc-map.mjs'
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (p, i = {}) => fetch(`${SUPA_URL}/rest/v1/${p}`, { ...i, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(i.headers || {}) } })
const fixed = await reconcileScores(sb)
console.log(`✅ Profils corrigés : ${fixed}`)
const top = await (await sb('profiles?select=pseudo,score&order=score.desc&limit=15')).json()
console.log('🏆 Classement (top 15) :')
top.forEach((p, i) => console.log(`  ${String(i + 1).padStart(2)}. ${p.pseudo} — ${p.score}`))
