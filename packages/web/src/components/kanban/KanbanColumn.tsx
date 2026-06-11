import { useState, useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Column, Card, Agent } from '@gaud/shared'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  column: Column
  cards: Card[]
  agents: Agent[]
  onAddCard: (columnId: string, title: string) => void
}

export function KanbanColumn({ column, cards, agents, onAddCard }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id })
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const agentMap = new Map(agents.map((a) => [a.id, a.name]))

  const handleSubmit = () => {
    const title = newTitle.trim()
    if (!title) return
    onAddCard(column.id, title)
    setNewTitle('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex min-w-[280px] max-w-[320px] flex-col h-full">
      {/* Column header */}
      <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
        <span
          className="h-[7px] w-[7px] rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] truncate">
          {column.name}
        </span>
        <span className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] tabular-nums">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex flex-1 flex-col gap-1.5 min-h-[60px] overflow-y-auto">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              agentName={card.assignedAgentId ? agentMap.get(card.assignedAgentId) : undefined}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <p className="py-4 text-center text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            No cards
          </p>
        )}
      </div>

      {/* Inline add */}
      <div className="mt-1.5 px-0.5">
        <input
          ref={inputRef}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') { setNewTitle(''); inputRef.current?.blur() }
          }}
          placeholder="+ Add card..."
          className="w-full rounded-[var(--radius-md)] border border-transparent bg-transparent px-2 py-1.5 text-xs text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] placeholder:text-[var(--color-muted)] dark:placeholder:text-[var(--color-muted-dark)] focus:border-[var(--color-border)] focus:bg-white focus:outline-none dark:focus:border-[var(--color-border-dark)] dark:focus:bg-[var(--color-surface-dark)]"
        />
      </div>
    </div>
  )
}
