import { Badge } from '@/components/ui/Badge'
import { GitBranch, ExternalLink, Bot } from 'lucide-react'
import type { ExecutionTask, ExecutionTaskStatus } from '@gaud/shared'

const statusVariant: Record<ExecutionTaskStatus, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  running: 'info',
  paused: 'warning',
  done: 'success',
  failed: 'error',
  pending: 'neutral',
}

const statusOrder: Record<ExecutionTaskStatus, number> = {
  running: 0,
  pending: 1,
  paused: 2,
  done: 3,
  failed: 4,
}

interface Props {
  tasks: ExecutionTask[]
}

export function ExecutionTaskList({ tasks }: Props) {
  const sorted = [...tasks].sort((a, b) => statusOrder[a.status] - statusOrder[b.status])

  if (tasks.length === 0) {
    return <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">No tasks yet.</p>
  }

  return (
    <div className="space-y-2">
      {sorted.map((task) => (
        <div
          key={task.id}
          className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                {task.title}
              </span>
              <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              {task.agentId && (
                <span className="flex items-center gap-1">
                  <Bot className="h-3 w-3" />
                  {task.agentId}
                </span>
              )}
              {task.branch && (
                <span className="flex items-center gap-1 font-mono text-[0.6875rem]">
                  <GitBranch className="h-3 w-3" />
                  {task.branch}
                </span>
              )}
            </div>
          </div>
          {task.prUrl && (
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
            >
              PR <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  )
}
