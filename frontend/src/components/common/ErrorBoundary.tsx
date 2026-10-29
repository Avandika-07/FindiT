import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TagMessage } from './TagMessage'

interface State {
  error: Error | null
}

/** Last-resort boundary outside the router (providers, router itself). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FindiT crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="min-h-dvh bg-paper">
        <TagMessage
          title="This page came loose"
          tone="lost"
          actions={
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-11 items-center rounded-control bg-cobalt px-4 text-sm font-semibold text-on-cobalt"
              >
                Reload the page
              </button>
              <a
                href="/"
                className="inline-flex h-11 items-center rounded-control border border-line-strong bg-surface px-4 text-sm font-semibold text-ink"
              >
                Back to home
              </a>
            </>
          }
        >
          Something in the app broke while showing this screen. Reloading usually fixes it.
          <span className="mt-2 block text-sm">Details: {this.state.error.message}</span>
        </TagMessage>
      </main>
    )
  }
}
