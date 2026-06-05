import type { AgentMemoryEntry } from '@gaud/shared'
import { Trash2 } from 'lucide-react'

const TYPE_STYLES: Record<string, string> = {
  error_correction: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  pattern_success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  user_preference: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  code_knowledge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  conversation: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
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
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeStyle}`}>
            {memory.type.replace(/_/g, ' ')}
          </span>
          {memory.similarity != null && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {(memory.similarity * 100).toFixed(0)}% match
            </span>
          )}
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(memory.id)}
            className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
            title="Delete memory"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap leading-relaxed">
        {memory.content}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-1 flex-wrap">
          {memory.tags.map((tag) => (
            <span key={tag} className="rounded bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-neutral-400 shrink-0">{date}</span>
      </div>
    </div>
  )
}
