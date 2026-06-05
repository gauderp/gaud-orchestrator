import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useExecutionStore } from '@/store/executions'
import { ExecutionStatus } from '@/components/executions/ExecutionStatus'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'

export function ExecutionListPage() {
  const { executions, loading, fetchExecutions } = useExecutionStore()

  useEffect(() => {
    fetchExecutions()
  }, [fetchExecutions])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Executions</h1>
        <Link to="/specs">
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            New Execution
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</div>
      ) : executions.length === 0 ? (
        <div className="py-12 text-center text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
          No executions yet. Approve a spec and trigger an execution from the board.
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
