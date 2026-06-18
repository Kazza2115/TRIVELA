// Ponctuel : vérifie que l'endpoint admin du worker répond (sans token → 401). À retirer.
const W = 'https://trivela-live.thebigchungus08.workers.dev'
// 1) POST sans token → doit renvoyer 401 JSON (endpoint vivant + routing OK)
const r1 = await fetch(`${W}/admin/get-bet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
console.log(`/admin/get-bet (sans token) → HTTP ${r1.status} : ${(await r1.text()).slice(0, 120)}`)
// 2) Préflight CORS
const r2 = await fetch(`${W}/admin/set-bet`, { method: 'OPTIONS' })
console.log(`OPTIONS /admin/set-bet → HTTP ${r2.status} · ACAO=${r2.headers.get('access-control-allow-origin')}`)
