import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

/**
 * Barrière d'erreur : empêche qu'un plantage de rendu d'un composant ne rende
 * TOUTE l'application blanche. Affiche un message lisible + un bouton recharger,
 * et logue l'erreur en console (diagnostic).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14,
        padding: 28, textAlign: 'center', background: 'var(--bg)',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
          Oups, cette page a rencontré un souci
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 360 }}>
          Rien n'est perdu — recharge la page. Si ça persiste, transmets le message ci-dessous.
        </div>
        <pre style={{
          maxWidth: '92vw', maxHeight: 160, overflow: 'auto',
          fontSize: 11, color: '#dc2626', background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10,
          padding: '10px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{this.props.label ? `[${this.props.label}] ` : ''}{this.state.error.message}</pre>
        <button
          onClick={() => location.reload()}
          style={{
            padding: '11px 22px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#C89B3C,#E8D080)', color: '#0D0800',
            fontSize: 14, fontWeight: 700, boxShadow: '0 4px 16px rgba(200,155,60,0.4)',
          }}
        >Recharger</button>
      </div>
    )
  }
}
