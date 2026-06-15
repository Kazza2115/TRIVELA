// Ponctuel : vérifie que les objets SQL des Tendances répondent (match_trends,
// match_player_bets, table match_odds) avec la clé service role. À retirer après.
const SUPA_URL = 'https://tivcwtzzhrsdfzxirjkw.supabase.co'
const SERVICE  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE) { console.error('❌ pas de service key'); process.exit(1) }
const sb = (path, init = {}) => fetch(`${SUPA_URL}/rest/v1/${path}`, {
  ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
})

// ── 1) match_trends() ────────────────────────────────────────────────────────
const tr = await sb('rpc/match_trends', { method: 'POST', body: '{}' })
if (!tr.ok) {
  console.log(`❌ match_trends → HTTP ${tr.status} : ${await tr.text()}`)
} else {
  const rows = await tr.json()
  console.log(`✅ match_trends OK — ${rows.length} match(s) avec au moins un prono.`)
  rows.sort((a, b) => b.total - a.total)
  for (const r of rows.slice(0, 8)) {
    console.log(`   • ${r.match_id} : ${r.home_win} V / ${r.draw} N / ${r.away_win} D  (total ${r.total})`)
  }

  // ── 2) match_player_bets() sur le match le plus pronostiqué ────────────────
  const top = rows[0]
  if (top) {
    const pb = await sb('rpc/match_player_bets', { method: 'POST', body: JSON.stringify({ p_match_id: top.match_id }) })
    if (!pb.ok) {
      console.log(`❌ match_player_bets → HTTP ${pb.status} : ${await pb.text()}`)
    } else {
      const bets = await pb.json()
      const revealed = bets.filter(b => b.revealed).length
      console.log(`✅ match_player_bets OK (${top.match_id}) — ${bets.length} prono(s), ${revealed} révélé(s).`)
      for (const b of bets.slice(0, 5)) {
        const score = b.revealed ? `${b.home_score}–${b.away_score}` : 'masqué (avant coup d\'envoi)'
        console.log(`   • ${b.pseudo} : ${score}`)
      }
    }
  }
}

// ── 3) table match_odds ──────────────────────────────────────────────────────
const od = await sb('match_odds?select=*&order=updated_at.desc', { headers: { Prefer: 'count=exact' } })
if (!od.ok) {
  console.log(`❌ match_odds → HTTP ${od.status} : ${await od.text()}`)
} else {
  const rows = await od.json()
  console.log(`✅ table match_odds OK — ${rows.length} cote(s) stockée(s).`)
  for (const r of rows.slice(0, 8)) {
    console.log(`   • ${r.match_id} : ${r.home_pct}/${r.draw_pct}/${r.away_pct} (${r.bookmakers} bookmakers)`)
  }
}
