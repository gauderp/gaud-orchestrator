import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CardWithDetails } from '@gaud/shared'
import { CardTypeIcon } from '@/components/kanban/CardTypeIcon'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Paperclip, MessageSquare, Plus, Calendar, GitBranch, Link2, ExternalLink } from 'lucide-react'
import { CardRepos } from './CardRepos'
import { CardTags } from './CardTags'
import { CardComments } from './CardComments'
import { useConversationStore } from '@/store/conversations'
import { ConversationStarter } from '@/components/conversation/ConversationStarter'

interface CardDetailProps {
  card: CardWithDetails
  columnName?: string
  onUpdate: () => void
}

type Tab = 'comments' | 'conversations' | 'attachments'

export function CardDetail({ card, columnName, onUpdate }: CardDetailProps) {
  const [showStarter, setShowStarter] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('comments')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descDraft, setDescDraft] = useState(card.description ?? '')
  const { conversations, fetchForCard, createConversation } = useConversationStore()

  useEffect(() => {
    fetchForCard(card.id)
  }, [card.id, fetchForCard])

  useEffect(() => {
    setDescDraft(card.description ?? '')
  }, [card.description])

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'comments', label: 'Comments', count: card.comments.length },
    { key: 'conversations', label: 'Conversations', count: conversations.length },
    { key: 'attachments', label: 'Attachments', count: card.attachments?.length ?? 0 },
  ]

  return (
    <div className="flex gap-8">
      {/* Main content — left 65% */}
      <div className="flex-1 min-w-0 flex flex-col gap-5">
        {/* Title */}
        <div className="flex items-center gap-2.5">
          <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            <CardTypeIcon type={card.type} size={20} />
          </span>
          <h2 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{card.title}</h2>
          {card.externalUrl && (
            <a
              href={card.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Imported from Trello"
              className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Trello
            </a>
          )}
        </div>

        {/* Description — click to edit */}
        <div>
          <h3 className="text-xs font-medium tracking-wide text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-1">
            DESCRIPTION
          </h3>
          {editingDescription ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                rows={4}
                autoFocus
                className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setEditingDescription(false)}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setDescDraft(card.description ?? ''); setEditingDescription(false) }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingDescription(true)}
              className="cursor-pointer rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] whitespace-pre-wrap hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)] min-h-[40px]"
            >
              {card.description || <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] italic">Click to add description...</span>}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div>
          <div className="flex gap-1 border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                  activeTab === tab.key
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1.5 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {activeTab === 'comments' && (
              <CardComments cardId={card.id} comments={card.comments} onUpdate={onUpdate} />
            )}

            {activeTab === 'conversations' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                    {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setShowStarter(!showStarter)}
                    className="flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-xs text-[var(--color-primary)] hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)] cursor-pointer"
                  >
                    <Plus size={12} />
                    New
                  </button>
                </div>

                {showStarter && (
                  <ConversationStarter
                    cardId={card.id}
                    onStart={async (data) => {
                      await createConversation(data)
                      setShowStarter(false)
                      fetchForCard(card.id)
                    }}
                  />
                )}

                {conversations.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {conversations.map((conv) => (
                      <Link
                        key={conv.id}
                        to={`/conversations/${conv.id}`}
                        className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 hover:bg-[var(--color-surface)] dark:border-[var(--color-border-dark)] dark:hover:bg-[var(--color-surface-dark)]"
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare size={14} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
                          <span className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                            {conv.type.charAt(0).toUpperCase() + conv.type.slice(1)}
                          </span>
                          <Badge variant={conv.status === 'active' ? 'info' : conv.status === 'completed' ? 'success' : 'warning'}>
                            {conv.status === 'paused_for_user' ? 'Paused' : conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                          </Badge>
                        </div>
                        <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                          {new Date(conv.createdAt).toLocaleDateString()}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  !showStarter && (
                    <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                      No conversations yet. Start one to collaborate with agents.
                    </p>
                  )
                )}
              </div>
            )}

            {activeTab === 'attachments' && (
              <div className="flex flex-col gap-2">
                {card.attachments && card.attachments.length > 0 ? (
                  card.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]"
                    >
                      <Paperclip size={14} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
                      <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{att.filename}</span>
                      <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{att.path}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">No attachments.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metadata sidebar — right 35% */}
      <div className="w-[280px] shrink-0 flex flex-col gap-4">
        {/* Status */}
        {columnName && (
          <MetaField label="Status">
            <Badge variant="neutral">{columnName}</Badge>
          </MetaField>
        )}

        {/* Tags */}
        <MetaField label="Tags">
          <CardTags cardId={card.id} tags={card.tags ?? []} onUpdate={onUpdate} />
        </MetaField>

        {/* Type */}
        <MetaField label="Type">
          <div className="flex items-center gap-1.5">
            <CardTypeIcon type={card.type} size={14} />
            <span className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] capitalize">{card.type}</span>
          </div>
        </MetaField>

        {/* Agent */}
        <MetaField label="Assigned Agent">
          <span className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {card.assignedAgentId ? card.assignedAgentId.slice(0, 8) : <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Unassigned</span>}
          </span>
        </MetaField>

        {/* Dates */}
        {(card.startDate || card.dueDate) && (
          <MetaField label="Dates">
            <div className="flex flex-col gap-1 text-sm">
              {card.startDate && (
                <span className="flex items-center gap-1.5 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  <Calendar size={12} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
                  Start: {new Date(card.startDate).toLocaleDateString()}
                </span>
              )}
              {card.dueDate && (
                <span className="flex items-center gap-1.5 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  <Calendar size={12} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
                  Due: {new Date(card.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </MetaField>
        )}

        {/* Repos */}
        <MetaField label="Repositories">
          <CardRepos cardId={card.id} repos={card.repos} onUpdate={onUpdate} />
        </MetaField>

        {/* Dependencies */}
        {card.dependencies.length > 0 && (
          <MetaField label="Dependencies">
            <div className="flex flex-col gap-1">
              {card.dependencies.map((dep) => (
                <span
                  key={`${dep.cardId}-${dep.dependsOnCardId}`}
                  className="flex items-center gap-1.5 text-xs font-mono text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]"
                >
                  <Link2 size={12} />
                  {dep.dependsOnCardId.slice(0, 8)}
                </span>
              ))}
            </div>
          </MetaField>
        )}

        {/* Created */}
        <MetaField label="Created">
          <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            {new Date(card.createdAt).toLocaleString()}
          </span>
        </MetaField>
      </div>
    </div>
  )
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
        {label.toUpperCase()}
      </span>
      {children}
    </div>
  )
}
