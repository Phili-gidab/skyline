import { Component } from 'react'

/* A crash inside one page shows something a person can act on, not a blank
   panel that only a reload escapes. Moving to another page clears it. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Admin panel error:', error, info)
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.routeKey !== this.props.routeKey) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="adm-page">
        <header className="adm-head">
          <h1>Something went wrong</h1>
        </header>
        <p className="adm-dim">This page hit an error. Try again, or pick another section — nothing has been lost.</p>
        <p className="adm-err">{String(this.state.error?.message || this.state.error)}</p>
        <button className="adm-btn" style={{ marginTop: 18 }} onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    )
  }
}
