import { useRef, useEffect, useState } from 'react'
import type { ExecutionLog, ExecutionTask } from '@gaud/shared'

const typeColors: Record<string, string> = {
  stdout: 'text-[--color-ink] dark:text-[--color-ink-dark]',
  stderr: 'text-[--color-destructive]',
  approval_request: 'text-[--color-warning]',
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
          <span className="text-xs font-medium text-[--color-muted] dark:text-[--color-muted-dark]">Filter:</span>
          <button
            onClick={() => setFilterTaskId(null)}
            className={`rounded-full px-2 py-0.5 text-xs ${
              !filterTaskId
                ? 'bg-[--color-primary] text-[--color-on-primary]'
                : 'bg-[--color-surface] text-[--color-muted] dark:bg-[--color-surface-dark] dark:text-[--color-muted-dark]'
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
                  ? 'bg-[--color-primary] text-[--color-on-primary]'
                  : 'bg-[--color-surface] text-[--color-muted] dark:bg-[--color-surface-dark] dark:text-[--color-muted-dark]'
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
      <div
        ref={containerRef}
        className="h-80 overflow-y-auto rounded-[--radius-lg] border border-[--color-border] bg-[--color-bg-dark] p-3 dark:border-[--color-border-dark]"
      >
        {allLogs.length === 0 ? (
          <p className="text-xs text-[--color-muted-dark]">No logs yet.</p>
        ) : (
          <pre className="font-mono text-[0.8125rem] leading-relaxed whitespace-pre-wrap">
            {allLogs.map((log) => (
              <div key={log.id} className={typeColors[log.type] ?? typeColors.stdout}>
                <span className="text-[--color-muted-dark] select-none">[{log.taskTitle}] </span>
                {log.content}
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  )
}
