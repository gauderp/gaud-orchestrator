import { useRef, useEffect, useState } from 'react'
import type { ExecutionLog, ExecutionTask } from '@gaud/shared'

const typeColors: Record<string, string> = {
  stdout: 'text-zinc-200',
  stderr: 'text-red-400',
  approval_request: 'text-amber-400',
}

interface Props {
  tasks: (ExecutionTask & { logs: ExecutionLog[] })[]
}

export function ExecutionLogs({ tasks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [filterTaskId, setFilterTaskId] = useState<string | null>(null)

  const allLogs = tasks
    .filter((t) => !filterTaskId || t.id === filterTaskId)
    .flatMap((t) => t.logs.map((l) => ({ ...l, taskTitle: t.title })))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [allLogs.length])

  return (
    <div className="flex flex-col gap-2">
      {tasks.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Filter:</span>
          <button
            onClick={() => setFilterTaskId(null)}
            className={`rounded-full px-2 py-0.5 text-xs ${
              !filterTaskId
                ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                : 'bg-[var(--color-surface)] text-[var(--color-muted)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-muted-dark)]'
            }`}
          >
            All
          </button>
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterTaskId(t.id)}
              className={`rounded-full px-2 py-0.5 text-xs ${
                filterTaskId === t.id
                  ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-muted)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-muted-dark)]'
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
      <div
        ref={containerRef}
        className="h-80 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-zinc-950 p-3 dark:border-[var(--color-border-dark)]"
      >
        {allLogs.length === 0 ? (
          <p className="text-xs text-zinc-500">No logs yet.</p>
        ) : (
          <pre className="font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
            {allLogs.map((log) => (
              <div key={log.id} className={typeColors[log.type] ?? typeColors.stdout}>
                <span className="text-zinc-500 select-none">[{log.taskTitle}] </span>
                {log.content}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  )
}
