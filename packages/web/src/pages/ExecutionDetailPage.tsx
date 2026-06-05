import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useExecutionStore } from '@/store/executions'
import { ExecutionStatus } from '@/components/executions/ExecutionStatus'
import { ExecutionTaskList } from '@/components/executions/ExecutionTaskList'
import { ExecutionLogs } from '@/components/executions/ExecutionLogs'
import { ExecutionGaps } from '@/components/executions/ExecutionGaps'
import { ExecutionPRs } from '@/components/executions/ExecutionPRs'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Play, XCircle } from 'lucide-react'

type Tab = 'tasks' | 'logs' | 'gaps' | 'prs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'logs', label: 'Logs' },
  { id: 'gaps', label: 'Gaps' },
  { id: 'prs', label: 'Pull Requests' },
]

export function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { selectedExecution, fetchExecution, executeExecution, cancelExecution, resolveGap } = useExecutionStore()
  const [activeTab, setActiveTab] = useState<Tab>('tasks')
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    if (id) fetchExecution(id)
  }, [id, fetchExecution])

  if (!selectedExecution) {
    return <div className="p-6 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</div>
  }

  const exec = selectedExecution
  const tasksDone = exec.tasks?.filter((t) => t.status === 'done').length ?? 0
  const tasksTotal = exec.tasks?.length ?? 0
  const pendingGaps = exec.gaps?.filter((g) => g.status === 'pending').length ?? 0

  const handleExecute = async () => {
    setExecuting(true)
    try {
      await executeExecution(exec.id)
    } finally {
      setExecuting(false)
    }
  }

  const handleCancel = async () => {
    await cancelExecution(exec.id)
  }

  const handleResolveGap = async (gapId: string, response: string) => {
    await resolveGap(exec.id, gapId, response)
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <Link
        to="/executions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Executions
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Execution {exec.id.slice(0, 8)}
          </h1>
          <ExecutionStatus status={exec.status} tasksDone={tasksDone} tasksTotal={tasksTotal} />
        </div>
        <div className="flex items-center gap-2">
          {exec.status === 'planning' && (
            <Button onClick={handleExecute} loading={executing}>
              <Play className="mr-1 h-4 w-4" />
              Execute
            </Button>
          )}
          {(exec.status === 'executing' || exec.status === 'approving') && (
            <Button variant="destructive" onClick={handleCancel}>
              <XCircle className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]'
            }`}
          >
            {tab.label}
            {tab.id === 'gaps' && pendingGaps > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-warning)] px-1 text-[0.625rem] text-white">
                {pendingGaps}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'tasks' && <ExecutionTaskList tasks={exec.tasks ?? []} />}
      {activeTab === 'logs' && <ExecutionLogs tasks={exec.tasks ?? []} />}
      {activeTab === 'gaps' && <ExecutionGaps gaps={exec.gaps ?? []} onResolve={handleResolveGap} />}
      {activeTab === 'prs' && <ExecutionPRs tasks={exec.tasks ?? []} />}
    </div>
  )
}
