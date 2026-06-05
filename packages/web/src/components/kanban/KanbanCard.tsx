import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
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
    opacity: isDragging ? 0.9 : 1,
    boxShadow: isDragging ? '0 8px 16px oklch(0 0 0 / 0.12)' : undefined,
  }

  return (
    <Link
      to={`/cards/${card.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="block rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-2.5 py-2 cursor-grab active:cursor-grabbing transition-colors hover:border-[var(--color-muted)] dark:bg-[var(--color-surface-dark)] dark:border-[var(--color-border-dark)] dark:hover:border-[var(--color-muted-dark)]"
    >
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] shrink-0">
          <CardTypeIcon type={card.type} size={14} />
        </span>
        <span className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] truncate leading-5">
          {card.title}
        </span>
      </div>
      {card.description && (
        <p className="mt-0.5 text-xs leading-4 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] truncate pl-[20px]">
          {card.description}
        </p>
      )}
      <div className="mt-1.5 flex items-center gap-1 pl-[20px] flex-wrap">
        <Badge variant="neutral">{card.type}</Badge>
        {agentName && <Badge variant="info">{agentName}</Badge>}
      </div>
    </Link>
  )
}
