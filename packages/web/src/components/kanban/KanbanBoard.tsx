import { DndContext, type DragEndEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { Column, Card, Agent } from '@gaud/shared'
import { KanbanColumn } from './KanbanColumn'

interface KanbanBoardProps {
  columns: Column[]
  cards: Card[]
  agents: Agent[]
  onMoveCard: (cardId: string, columnId: string, position: number) => void
  onAddCard: (columnId: string) => void
}

export function KanbanBoard({ columns, cards, agents, onMoveCard, onAddCard }: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const cardsByColumn = new Map<string, Card[]>()
  for (const col of columns) {
    cardsByColumn.set(col.id, [])
  }
  for (const card of cards) {
    const arr = cardsByColumn.get(card.columnId)
    if (arr) arr.push(card)
  }
  for (const arr of cardsByColumn.values()) {
    arr.sort((a, b) => a.position - b.position)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const cardId = active.id as string
    const overId = over.id as string

    // Determine target column: if dropped on a column, use that; if on a card, use that card's column
    let targetColumnId: string
    let targetPosition: number

    const overCard = cards.find((c) => c.id === overId)
    if (overCard) {
      targetColumnId = overCard.columnId
      targetPosition = overCard.position
    } else {
      // Dropped on column directly
      targetColumnId = overId
      const colCards = cardsByColumn.get(targetColumnId)
      targetPosition = colCards ? colCards.length : 0
    }

    const draggedCard = cards.find((c) => c.id === cardId)
    if (!draggedCard) return

    // Only move if something changed
    if (draggedCard.columnId !== targetColumnId || draggedCard.position !== targetPosition) {
      onMoveCard(cardId, targetColumnId, targetPosition)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              cards={cardsByColumn.get(col.id) ?? []}
              agents={agents}
              onAddCard={onAddCard}
            />
          ))}
      </div>
    </DndContext>
  )
}
