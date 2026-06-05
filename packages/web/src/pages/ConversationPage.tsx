import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useConversationStore } from '@/store/conversations'
import { ConversationView } from '@/components/conversation/ConversationView'

export function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const { activeConversation, loading, fetchConversation } = useConversationStore()

  useEffect(() => {
    if (id) fetchConversation(id)
  }, [id, fetchConversation])

  if (loading || !activeConversation) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-32 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
            <div className="h-5 w-16 rounded-full bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-5 w-5 rounded-full bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-4 w-full rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ConversationView conversation={activeConversation} />
    </div>
  )
}
