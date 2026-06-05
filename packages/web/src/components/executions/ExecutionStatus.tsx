import { Badge } from '@/components/ui/Badge'
import { Play, Pause, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { ExecutionStatus as Status } from '@gaud/shared'

const statusConfig: Record<Status, { variant: 'info' | 'warning' | 'success' | 'error' | 'neutral'; label: string; Icon: typeof Play }> = {
  executing: { variant: 'info', label: 'Executing', Icon: Loader2 },
  approving: { variant: 'warning', label: 'Awaiting Approval', Icon: Pause },
  done: { variant: 'success', label: 'Done', Icon: CheckCircle2 },
  failed: { variant: 'error', label: 'Failed', Icon: XCircle },
  planning: { variant: 'neutral', label: 'Planning', Icon: Play },
}

interface Props {
  status: Status
  tasksDone?: number
  tasksTotal?: number
}

export function ExecutionStatus({ status, tasksDone = 0, tasksTotal = 0 }: Props) {
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-3">
      <Badge variant={config.variant}>
        <config.Icon className={`mr-1 h-3 w-3 ${status === 'executing' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
      {tasksTotal > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-[var(--color-border)] dark:bg-[var(--color-border-dark)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${Math.round((tasksDone / tasksTotal) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            {tasksDone}/{tasksTotal}
          </span>
        </div>
      )}
    </div>
  )
}
