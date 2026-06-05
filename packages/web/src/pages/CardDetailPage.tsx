import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useBoardStore } from '@/store/boards'
import { CardDetail } from '@/components/cards/CardDetail'

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { selectedCard, fetchCard, activeBoard, fetchBoard } = useBoardStore()

  useEffect(() => {
    if (id) fetchCard(id)
  }, [id, fetchCard])

  useEffect(() => {
    if (selectedCard && !activeBoard) {
      fetchBoard(selectedCard.boardId)
    }
  }, [selectedCard, activeBoard, fetchBoard])

  if (!selectedCard) {
    return (
      <div className="p-6 flex gap-8">
        <div className="flex-1 space-y-4">
          <div className="h-6 w-48 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
          <div className="h-20 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
          <div className="h-32 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
        </div>
        <div className="w-[280px] space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              <div className="h-5 w-24 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const columnName = activeBoard?.columns.find((c) => c.id === selectedCard.columnId)?.name

  return (
    <div className="p-6">
      <CardDetail
        card={selectedCard}
        columnName={columnName}
        onUpdate={() => { if (id) fetchCard(id) }}
      />
    </div>
  )
}
