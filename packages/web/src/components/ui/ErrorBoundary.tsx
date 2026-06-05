import { Component, type ReactNode } from 'react'
import { Button } from './Button'
import { AlertCircle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8">
          <AlertCircle size={48} className="text-[var(--color-destructive)]" />
          <h2 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Something went wrong</h2>
          <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] max-w-md text-center">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <Button variant="secondary" onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
