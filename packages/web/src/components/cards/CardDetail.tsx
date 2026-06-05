import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CardWithDetails, Column } from '@gaud/shared'
import { CardTypeIcon } from '@/components/kanban/CardTypeIcon'
import { Badge } from '@/components/ui/Badge'
import { Paperclip, MessageSquare, Plus } from 'lucide-react'
import { CardRepos } from './CardRepos'
import { CardComments } from './CardComments'
import { useConversationStore } from '@/store/conversations'
import { ConversationStarter } from '@/components/conversation/ConversationStarter'

interface CardDetailProps {
  card: CardWithDetails
  columnName?: string
  onUpdate: () => void
}

export function CardDetail({ card, columnName, onUpdate }: CardDetailProps) {
  const [showStarter, setShowStarter] = useState(false)
  const { conversations, fetchForCard, createConversation } = useConversationStore()

  useEffect(() => {
    fetchForCard(card.id)
  }, [card.id, fetchForCard])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-[--color-muted] dark:text-[--color-muted-dark]">
          <CardTypeIcon type={card.type} size={20} />
        </span>
        <h2 className="text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">{card.title}</h2>
        {columnName && <Badge variant="neutral">{columnName}</Badge>}
      </div>

      {/* Description */}
      {card.description && (
        <div>
          <h3 className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark] mb-1">Description</h3>
          <p className="text-sm text-[--color-muted] dark:text-[--color-muted-dark] whitespace-pre-wrap">
            {card.description}
          </p>
        </div>
      )}

      {/* Repos */}
      <CardRepos cardId={card.id} repos={card.repos} onUpdate={onUpdate} />

      {/* Comments */}
      <CardComments cardId={card.id} comments={card.comments} onUpdate={onUpdate} />

      {/* Attachments */}
      {card.attachments && card.attachments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            Attachments
          </h3>
          <div className="flex flex-col gap-2">
            {card.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 rounded-[--radius-md] border border-[--color-border] bg-[--color-surface] px-3 py-2 text-sm dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]"
              >
                <Paperclip size={14} className="text-[--color-muted] dark:text-[--color-muted-dark]" />
                <span className="text-[--color-ink] dark:text-[--color-ink-dark]">{att.filename}</span>
                <span className="text-xs text-[--color-muted] dark:text-[--color-muted-dark]">{att.path}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conversations */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
              Conversations
            </h3>
            {conversations.length > 0 && (
              <Badge variant="neutral">{conversations.length}</Badge>
            )}
          </div>
          <button
            onClick={() => setShowStarter(!showStarter)}
            className="flex items-center gap-1 rounded-[--radius-md] px-2 py-1 text-xs text-[--color-primary] hover:bg-[--color-surface] dark:hover:bg-[--color-surface-dark]"
          >
            <Plus size={12} />
            New
          </button>
        </div>

        {showStarter && (
          <div className="mb-3">
            <ConversationStarter
              cardId={card.id}
              onStart={async (data) => {
                await createConversation(data)
                setShowStarter(false)
                fetchForCard(card.id)
              }}
            />
          </div>
        )}

        {conversations.length > 0 ? (
          <div className="flex flex-col gap-2">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                to={`/conversations/${conv.id}`}
                className="flex items-center justify-between rounded-[--radius-md] border border-[--color-border] px-3 py-2 hover:bg-[--color-surface] dark:border-[--color-border-dark] dark:hover:bg-[--color-surface-dark]"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className="text-[--color-muted] dark:text-[--color-muted-dark]" />
                  <span className="text-sm text-[--color-ink] dark:text-[--color-ink-dark]">
                    {conv.type.charAt(0).toUpperCase() + conv.type.slice(1)}
                  </span>
                  <Badge variant={conv.status === 'active' ? 'info' : conv.status === 'completed' ? 'success' : 'warning'}>
                    {conv.status === 'paused_for_user' ? 'Paused' : conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                  </Badge>
                </div>
                <span className="text-xs text-[--color-muted] dark:text-[--color-muted-dark]">
                  {new Date(conv.createdAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          !showStarter && (
            <p className="text-sm text-[--color-muted] dark:text-[--color-muted-dark]">
              No conversations yet. Start one to collaborate with agents.
            </p>
          )
        )}
      </div>

      {/* Dependencies */}
      {card.dependencies.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">Dependencies</h3>
          <div className="flex flex-col gap-1">
            {card.dependencies.map((dep) => (
              <div
                key={`${dep.cardId}-${dep.dependsOnCardId}`}
                className="rounded-[--radius-md] border border-[--color-border] bg-white px-3 py-2 text-xs font-mono text-[--color-muted] dark:bg-[--color-surface-dark] dark:border-[--color-border-dark] dark:text-[--color-muted-dark]"
              >
                Depends on: {dep.dependsOnCardId}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
