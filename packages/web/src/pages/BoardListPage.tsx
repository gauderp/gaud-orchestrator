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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[--color-ink] dark:text-[--color-ink-dark]">Boards</h1>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} className="mr-1.5" />
          New Board
        </Button>
      </div>

      {loading && (
        <p className="text-[--color-muted] dark:text-[--color-muted-dark]">Loading...</p>
      )}

      {!loading && boards.length === 0 && (
        <p className="text-center text-[--color-muted] dark:text-[--color-muted-dark] py-12">
          No boards yet. Create your first board to get started.
        </p>
      )}

      {!loading && boards.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board.id}
              to={`/boards/${board.id}`}
              className="group rounded-[--radius-lg] border border-[--color-border] bg-white p-4 transition-colors hover:border-[--color-primary] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark] dark:hover:border-[--color-primary]"
            >
              <div className="flex items-center gap-3 mb-2">
                <LayoutGrid size={18} className="text-[--color-muted] dark:text-[--color-muted-dark] group-hover:text-[--color-primary]" />
                <h2 className="text-lg font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
                  {board.name}
                </h2>
              </div>
              <p className="text-xs text-[--color-muted] dark:text-[--color-muted-dark]">
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
