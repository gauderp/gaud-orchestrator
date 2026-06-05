import { useState } from 'react'
import type { CardComment } from '@gaud/shared'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'

interface CardCommentsProps {
  cardId: string
  comments: CardComment[]
  onUpdate: () => void
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString()
}

function AuthorAvatar({ type }: { type: string }) {
  const bg = type === 'agent'
    ? 'bg-[var(--color-accent)] text-white'
    : 'bg-[var(--color-primary)] text-white'
  const initial = type === 'agent' ? 'A' : 'U'
  return (
    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${bg}`}>
      {initial}
    </div>
  )
}

export function CardComments({ cardId, comments, onUpdate }: CardCommentsProps) {
  const [content, setContent] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setAdding(true)
    try {
      await api.cards.addComment(cardId, { authorType: 'user', content: content.trim() })
      setContent('')
      onUpdate()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length === 0 && (
        <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">No comments yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {comments.map((comment) => (
          <div key={comment.id} className={`flex gap-2.5 rounded-[var(--radius-md)] px-3 py-2 ${comment.authorType === 'agent' ? 'bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)]' : ''}`}>
            <AuthorAvatar type={comment.authorType} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] capitalize">
                  {comment.authorType}
                </span>
                <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                  {formatTime(comment.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] dark:bg-[var(--color-surface-dark)] dark:border-[var(--color-border-dark)] dark:text-[var(--color-ink-dark)]"
        />
        <Button type="submit" size="sm" loading={adding}>
          Add
        </Button>
      </form>
    </div>
  )
}
