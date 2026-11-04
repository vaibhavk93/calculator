import { Component, type ReactNode } from 'react'

/**
 * Catches an exception thrown while a screen draws. Without it React removes the whole app (a white screen) and the
 * tab bar goes with it. With it, the tab bar stays, and the person is told in plain words and given a way out.
 * Nothing here touches stored data: a failed screen never writes anything.
 * `resetKey` (the current tab) clears the failure when it changes, so tapping another tab recovers by itself.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string; onHome: () => void }, { failed: boolean; key: string }> {
  state = { failed: false, key: this.props.resetKey }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  static getDerivedStateFromProps(p: { resetKey: string }, s: { failed: boolean; key: string }) {
    return p.resetKey !== s.key ? { failed: false, key: p.resetKey } : null
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="app__body" role="alert">
        <div className="empty">
          <h1>This screen hit a problem</h1>
          <p>Your notes, lists and budget are safe. Go back to Calculate and try again.</p>
          <button type="button" className="btn btn--primary" onClick={() => { this.props.onHome(); this.setState({ failed: false }) }}>
            Back to Calculate
          </button>
        </div>
      </main>
    )
  }
}
