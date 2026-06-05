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
      <div className="flex h-full items-center justify-center text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
        Loading conversation...
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      <ConversationView conversation={activeConversation} />
    </div>
  )
}
