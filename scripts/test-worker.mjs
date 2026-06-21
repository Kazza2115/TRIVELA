// Ponctuel : appelle le worker (?force=1) → doit renvoyer reconciled:N (recalcul abouti). À retirer.
const W = 'https://trivela-live.thebigchungus08.workers.dev/?force=1'
const t0 = Date.now()
const r = await fetch(W)
const txt = await r.text()
console.log(`worker ?force=1 → HTTP ${r.status} en ${Date.now() - t0}ms`)
console.log(`réponse : ${txt}`)
