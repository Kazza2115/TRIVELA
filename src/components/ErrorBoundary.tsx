import { Component, type ReactNode } from 'react'

interface State { error: Error | null }

/** Capture une erreur de rendu et l'affiche au lieu d'un écran noir/blanc. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500, overflow: 'auto',
          background: 'var(--bg)', color: 'var(--text-1)', padding: 24,
        }}>
          <h3 style={{ color: '#dc2626', marginTop: 0 }}>⚠️ Erreur dans le chat</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5 }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })} style={{
            marginTop: 12, padding: '10px 16px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg,#C89B3C,#E8D080)', color: '#0D0800',
            fontWeight: 700, cursor: 'pointer',
          }}>Fermer</button>
        </div>
      )
    }
    return this.props.children
  }
}
