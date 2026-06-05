import { Badge } from '@/components/ui/Badge'
import { ExternalLink } from 'lucide-react'
import type { ExecutionTask, ExecutionTaskStatus } from '@gaud/shared'

const statusVariant: Record<ExecutionTaskStatus, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  running: 'info',
  paused: 'warning',
  done: 'success',
  failed: 'error',
  pending: 'neutral',
}

interface Props {
  tasks: ExecutionTask[]
}

export function ExecutionPRs({ tasks }: Props) {
  const withPRs = tasks.filter((t) => t.prUrl)

  if (withPRs.length === 0) {
    return <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">No PRs created yet.</p>
  }

  return (
    <div className="space-y-2">
      {withPRs.map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{task.title}</span>
            <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
          </div>
          <a
            href={task.prUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
          >
            View PR <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      ))}
    </div>
  )
}
