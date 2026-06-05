import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useExecutionStore } from '@/store/executions'
import { ExecutionStatus } from '@/components/executions/ExecutionStatus'
import { Button } from '@/components/ui/Button'
import { Plus, Play as PlayIcon } from 'lucide-react'

export function ExecutionListPage() {
  const { executions, loading, fetchExecutions } = useExecutionStore()

  useEffect(() => {
    fetchExecutions()
  }, [fetchExecutions])

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Executions</h1>
        <Link to="/specs">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            New Execution
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] p-4">
              <div className="flex flex-col gap-1.5">
                <div className="h-4 w-36 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-3 w-48 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              </div>
              <div className="flex items-center gap-4">
                <div className="h-5 w-16 rounded-full bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-3 w-20 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : executions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <PlayIcon size={48} className="text-[var(--color-border)] dark:text-[var(--color-border-dark)]" />
          <p className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">No executions yet</p>
          <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Approve a spec and trigger an execution from the board</p>
          <Link to="/specs">
            <Button size="sm">View Specs</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {executions.map((exec) => (
            <Link
              key={exec.id}
              to={`/executions/${exec.id}`}
              className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 transition-colors hover:bg-[var(--color-surface)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:hover:bg-[var(--color-surface-elevated-dark)]"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  Execution {exec.id.slice(0, 8)}
                </span>
                <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                  {exec.cardId && `Card: ${exec.cardId.slice(0, 8)}`}
                  {exec.specId && ` | Spec: ${exec.specId.slice(0, 8)}`}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <ExecutionStatus status={exec.status} />
                <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                  {new Date(exec.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
