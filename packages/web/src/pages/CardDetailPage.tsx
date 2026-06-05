import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useBoardStore } from '@/store/boards'
import { CardDetail } from '@/components/cards/CardDetail'

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { selectedCard, fetchCard } = useBoardStore()

  useEffect(() => {
    if (id) fetchCard(id)
  }, [id, fetchCard])

  if (!selectedCard) {
    return <p className="text-[--color-muted] dark:text-[--color-muted-dark]">Loading card...</p>
  }

  return (
    <div>
      <CardDetail
        card={selectedCard}
        onUpdate={() => { if (id) fetchCard(id) }}
      />
    </div>
  )
}
