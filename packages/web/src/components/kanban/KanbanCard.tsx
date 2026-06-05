import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Card } from '@gaud/shared'
import { CardTypeIcon } from './CardTypeIcon'
import { Badge } from '@/components/ui/Badge'

interface KanbanCardProps {
  card: Card
  agentName?: string
}

export function KanbanCard({ card, agentName }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? '1.02' : '1',
    boxShadow: isDragging ? '0 8px 16px oklch(0 0 0 / 0.12)' : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-lg border border-[--color-border] bg-white p-3 cursor-grab active:cursor-grabbing transition-shadow dark:bg-[--color-surface-dark] dark:border-[--color-border-dark]"
    >
      <div className="flex items-center gap-2">
        <span className="text-[--color-muted] dark:text-[--color-muted-dark]">
          <CardTypeIcon type={card.type} size={14} />
        </span>
        <span className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark] truncate">
          {card.title}
        </span>
      </div>
      {card.description && (
        <p className="mt-1 text-xs text-[--color-muted] dark:text-[--color-muted-dark] truncate">
          {card.description}
        </p>
      )}
      {agentName && (
        <div className="mt-2">
          <Badge variant="info">{agentName}</Badge>
        </div>
      )}
    </div>
  )
}
