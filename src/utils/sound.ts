// Petit son de notification généré (WebAudio) — pas de fichier audio requis.
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch { return null }
}

function tone(c: AudioContext, freq: number, start: number, dur: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.connect(g); g.connect(c.destination)
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.start(start)
  o.stop(start + dur + 0.02)
}

/** Joue un petit « ding » à deux tons (notification de mention). */
export function playMentionSound() {
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  tone(c, 880, t, 0.18)
  tone(c, 1175, t + 0.12, 0.22)
}
