import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Zap, Plus } from 'lucide-react'
import type { Column, Card, Agent } from '@gaud/shared'
import { KanbanCard } from './KanbanCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface KanbanColumnProps {
  column: Column
  cards: Card[]
  agents: Agent[]
  onAddCard: (columnId: string) => void
}

export function KanbanColumn({ column, cards, agents, onAddCard }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: column.id })

  const agentMap = new Map(agents.map((a) => [a.id, a.name]))

  return (
    <div className="flex min-w-[280px] flex-col rounded-lg bg-[--color-surface] dark:bg-[--color-surface-dark] border border-[--color-border] dark:border-[--color-border-dark]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[--color-border] dark:border-[--color-border-dark]">
        <span
          className="h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <span className="text-sm font-medium text-[--color-ink] dark:text-[--color-ink-dark] truncate">
          {column.name}
        </span>
        <Badge variant="neutral">{cards.length}</Badge>
        {column.agentActionPrompt && (
          <Zap size={14} className="text-[--color-warning] shrink-0" />
        )}
      </div>
      <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 p-2 overflow-y-auto">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              agentName={card.assignedAgentId ? agentMap.get(card.assignedAgentId) : undefined}
            />
          ))}
        </SortableContext>
      </div>
      <div className="p-2 border-t border-[--color-border] dark:border-[--color-border-dark]">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-1" onClick={() => onAddCard(column.id)}>
          <Plus size={14} />
          Add Card
        </Button>
      </div>
    </div>
  )
}
