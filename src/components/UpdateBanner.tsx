import { useEffect, useState } from 'react'

declare const __BUILD_ID__: string

/**
 * Détecte qu'une version plus récente de l'app est déployée (en comparant
 * /version.json à l'identifiant de build embarqué) et propose de recharger.
 * Évite que des utilisateurs restent bloqués sur une ancienne version en cache.
 */
export default function UpdateBanner() {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let on = true
    const check = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (on && data?.v && data.v !== __BUILD_ID__) setStale(true)
      } catch { /* hors-ligne / version.json absent → on ignore */ }
    }
    check()
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    const iv = setInterval(check, 5 * 60 * 1000)
    return () => { on = false; document.removeEventListener('visibilitychange', onVis); clearInterval(iv) }
  }, [])

  if (!stale) return null
  return (
    <button
      onClick={() => location.reload()}
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 'calc(82px + var(--sab))', zIndex: 600,
        margin: '0 auto', maxWidth: 440,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '12px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg,#C89B3C,#E8D080)', color: '#0D0800',
        fontSize: 13, fontWeight: 700, boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        animation: 'fadeSlideUp 0.3s ease',
      }}
    >
      🔄 Nouvelle version disponible — touchez pour recharger
    </button>
  )
}
