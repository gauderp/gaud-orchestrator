import { useState } from 'react'
import { useSpecStore } from '@/store/specs'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface DecomposeModalProps {
  specId: string
  open: boolean
  onClose: () => void
}

interface CreatedCard {
  title: string
  type: string
}

export function DecomposeModal({ specId, open, onClose }: DecomposeModalProps) {
  const decomposeSpec = useSpecStore((s) => s.decomposeSpec)
  const [boardId, setBoardId] = useState('')
  const [columnId, setColumnId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<CreatedCard[] | null>(null)

  const handleDecompose = async () => {
    setLoading(true)
    setError(null)
    setCards(null)
    try {
      const result = await decomposeSpec(specId, { boardId, columnId })
      setCards(result.cards ?? result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decomposition failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setBoardId('')
    setColumnId('')
    setError(null)
    setCards(null)
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Decompose to Board" width="sm">
      <div className="space-y-3">
        <Input
          label="Board ID"
          value={boardId}
          onChange={(e) => setBoardId(e.target.value)}
          placeholder="Enter board ID"
        />

        <Input
          label="Column ID"
          value={columnId}
          onChange={(e) => setColumnId(e.target.value)}
          placeholder="Enter column ID"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-[var(--color-destructive)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] p-3 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}

      {cards && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Created Cards</h3>
          <div className="space-y-1">
            {cards.map((card, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] dark:border-[var(--color-border-dark)] px-3 py-2 text-sm"
              >
                <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{card.title}</span>
                <Badge variant="neutral">{card.type}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
        {!cards && (
          <Button
            onClick={handleDecompose}
            disabled={loading || !boardId.trim() || !columnId.trim()}
            loading={loading}
          >
            {loading ? 'Decomposing...' : 'Decompose'}
          </Button>
        )}
      </div>
    </Modal>
  )
}
