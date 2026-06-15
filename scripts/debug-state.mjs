// Ponctuel : exécute le réconciliateur complet maintenant + montre quelques scores.
import { reconcileScores } from './wc-map.mjs'
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})
const fixed = await reconcileScores(sb)
console.log('Profils corrigés : ' + fixed)
const top = await (await sb('profiles?select=pseudo,score&order=score.desc&limit=12')).json()
console.log('Top : ' + JSON.stringify(top))
const dyran = await (await sb('profiles?pseudo=ilike.Dyran&select=pseudo,score')).json()
console.log('Dyran : ' + JSON.stringify(dyran))
