import type { AgentMemoryEntry } from '@gaud/shared'
import { Trash2 } from 'lucide-react'

const TYPE_STYLES: Record<string, string> = {
  error_correction: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pattern_success: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] dark:bg-[var(--color-accent)]/20 dark:text-[var(--color-accent)]',
  user_preference: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] dark:bg-[var(--color-warning)]/20 dark:text-[var(--color-warning)]',
  code_knowledge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  conversation: 'bg-[var(--color-surface)] text-[var(--color-muted)] dark:bg-[var(--color-surface-elevated-dark)] dark:text-[var(--color-muted-dark)]',
}

interface MemoryCardProps {
  memory: AgentMemoryEntry & { similarity?: number }
  onDelete?: (id: string) => void
}

export function MemoryCard({ memory, onDelete }: MemoryCardProps) {
  const typeStyle = TYPE_STYLES[memory.type] ?? TYPE_STYLES.conversation
  const date = new Date(memory.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div className="rounded-lg border border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-white dark:bg-[var(--color-surface-dark)] p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeStyle}`}>
            {memory.type.replace(/_/g, ' ')}
          </span>
          {memory.similarity != null && (
            <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              {(memory.similarity * 100).toFixed(0)}% match
            </span>
          )}
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(memory.id)}
            className="cursor-pointer rounded p-1 text-[var(--color-muted)] hover:bg-red-50 hover:text-[var(--color-destructive)] dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            title="Delete memory"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] whitespace-pre-wrap leading-relaxed">
        {memory.content}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-1 flex-wrap">
          {memory.tags.map((tag) => (
            <span key={tag} className="rounded bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated-dark)] px-1.5 py-0.5 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              {tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-[var(--color-muted)] shrink-0">{date}</span>
      </div>
    </div>
  )
}
