import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, LayoutGrid } from 'lucide-react'
import { useBoardStore } from '@/store/boards'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'

export function BoardListPage() {
  const { boards, loading, fetchBoards, createBoard } = useBoardStore()
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await createBoard(name.trim())
      setShowModal(false)
      setName('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Boards</h1>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} className="mr-1.5" />
          New Board
        </Button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 dark:border-[var(--color-border-dark)]">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-5 w-5 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-5 w-32 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              </div>
              <div className="h-3 w-24 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!loading && boards.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <LayoutGrid size={48} className="text-[var(--color-border)] dark:text-[var(--color-border-dark)]" />
          <p className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">No boards yet</p>
          <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Create your first board to organize work</p>
          <Button size="sm" onClick={() => setShowModal(true)}>
            <Plus size={14} className="mr-1" />
            New Board
          </Button>
        </div>
      )}

      {!loading && boards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              to={`/boards/${board.id}`}
              className="group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 transition-colors hover:border-[var(--color-primary)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:hover:border-[var(--color-primary)]"
            >
              <div className="flex items-center gap-3 mb-2">
                <LayoutGrid size={18} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] group-hover:text-[var(--color-primary)]" />
                <h2 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  {board.name}
                </h2>
              </div>
              <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                Created {new Date(board.createdAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Board">
        <div className="flex flex-col gap-4">
          <Input
            label="Board Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint 12"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!name.trim()}>
              Create Board
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
