import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useExecutionStore } from '@/store/executions'
import { Badge } from '@/components/ui/Badge'
import { ArrowLeft, ExternalLink } from 'lucide-react'

export function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { selectedExecution, fetchExecution } = useExecutionStore()

  useEffect(() => {
    if (id) fetchExecution(id)
  }, [id, fetchExecution])

  if (!selectedExecution) {
    return <div className="p-6 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</div>
  }

  const exec = selectedExecution

  const outcomeBadge = exec.outcome === 'success'
    ? <Badge variant="success">Success</Badge>
    : exec.outcome === 'failed'
      ? <Badge variant="error">Failed</Badge>
      : <Badge variant="neutral">In Progress</Badge>

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link
        to="/executions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Executions
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Execution {exec.id.slice(0, 8)}
          </h1>
          {outcomeBadge}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-[var(--color-border)] dark:border-[var(--color-border-dark)] p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Started</span>
            <p className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              {new Date(exec.startedAt).toLocaleString()}
            </p>
          </div>
          {exec.finishedAt && (
            <div>
              <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Finished</span>
              <p className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                {new Date(exec.finishedAt).toLocaleString()}
              </p>
            </div>
          )}
          {exec.branch && (
            <div>
              <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Branch</span>
              <p className="font-mono text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{exec.branch}</p>
            </div>
          )}
          {exec.prUrl && (
            <div>
              <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Pull Request</span>
              <a
                href={exec.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
              >
                View PR <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
