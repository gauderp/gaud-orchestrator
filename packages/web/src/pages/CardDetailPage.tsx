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
    return <p className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading card...</p>
  }

  const columnName = activeBoard?.columns.find((c) => c.id === selectedCard.columnId)?.name

  return (
    <div>
      <CardDetail
        card={selectedCard}
        columnName={columnName}
        onUpdate={() => { if (id) fetchCard(id) }}
      />
    </div>
  )
}
