import { useState } from 'react'
import { useSpecStore } from '../../store/specs.js'

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

  if (!open) return null

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Decompose to Board</h2>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Board ID
            </label>
            <input
              type="text"
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter board ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Column ID
            </label>
            <input
              type="text"
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter column ID"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {cards && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Created Cards</h3>
            <div className="space-y-1">
              {cards.map((card, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
                >
                  <span className="text-gray-700 dark:text-gray-300">{card.title}</span>
                  <span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    {card.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
          {!cards && (
            <button
              onClick={handleDecompose}
              disabled={loading || !boardId.trim() || !columnId.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Decomposing...
                </span>
              ) : (
                'Decompose'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
