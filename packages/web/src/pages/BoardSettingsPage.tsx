import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
import { useBoardStore } from '@/store/boards'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Column } from '@gaud/shared'

interface ColumnFormState {
  name: string
  color: string
  agentActionPrompt: string
  autoMove: boolean
}

function ColumnRow({ column, onSaved, onDeleted }: { column: Column; onSaved: () => void; onDeleted: () => void }) {
  const [form, setForm] = useState<ColumnFormState>({
    name: column.name,
    color: column.color,
    agentActionPrompt: column.agentActionPrompt ?? '',
    autoMove: column.autoMove,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.boards.updateColumn(column.id, {
        name: form.name,
        color: form.color,
        agentActionPrompt: form.agentActionPrompt || null,
        autoMove: form.autoMove,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.boards.deleteColumn(column.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-end gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
      <Input
        label="Name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="flex-1"
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Color</label>
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
          className="h-9 w-12 cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]"
        />
      </div>
      <Input
        label="Agent Action Prompt"
        value={form.agentActionPrompt}
        onChange={(e) => setForm((f) => ({ ...f, agentActionPrompt: e.target.value }))}
        placeholder="Optional prompt for agents"
        className="flex-1"
      />
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Auto Move</label>
        <div className="flex h-9 items-center">
          <input
            type="checkbox"
            checked={form.autoMove}
            onChange={(e) => setForm((f) => ({ ...f, autoMove: e.target.checked }))}
            className="h-4 w-4 cursor-pointer rounded-[var(--radius-sm)] border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-ring)]"
          />
        </div>
      </div>
      <Button size="sm" onClick={handleSave} loading={saving}>
        Save
      </Button>
      <Button size="sm" variant="destructive" onClick={handleDelete} loading={deleting}>
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

export function BoardSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const { activeBoard, fetchBoard } = useBoardStore()
  const [newCol, setNewCol] = useState({ name: '', color: '#6b7280' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (id) fetchBoard(id)
  }, [id, fetchBoard])

  const reload = () => {
    if (id) fetchBoard(id)
  }

  const handleAddColumn = async () => {
    if (!id || !newCol.name.trim()) return
    setAdding(true)
    try {
      await api.boards.createColumn(id, {
        name: newCol.name.trim(),
        color: newCol.color,
        position: activeBoard?.columns.length ?? 0,
      })
      setNewCol({ name: '', color: '#6b7280' })
      reload()
    } finally {
      setAdding(false)
    }
  }

  if (!activeBoard) {
    return <p className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</p>
  }

  const sortedColumns = [...activeBoard.columns].sort((a, b) => a.position - b.position)

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          to={`/boards/${id}`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-dark)] dark:hover:text-[var(--color-ink-dark)]"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          Board Settings — {activeBoard.name}
        </h1>
      </div>

      <div className="flex flex-col gap-3 mb-8">
        <h2 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Columns</h2>
        {sortedColumns.map((col) => (
          <ColumnRow key={col.id} column={col} onSaved={reload} onDeleted={reload} />
        ))}
        {sortedColumns.length === 0 && (
          <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            No columns yet. Add one below.
          </p>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-3">Add Column</h3>
        <div className="flex items-end gap-3">
          <Input
            label="Column Name"
            value={newCol.name}
            onChange={(e) => setNewCol((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. In Progress"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn() }}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Color</label>
            <input
              type="color"
              value={newCol.color}
              onChange={(e) => setNewCol((s) => ({ ...s, color: e.target.value }))}
              className="h-9 w-12 cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]"
            />
          </div>
          <Button onClick={handleAddColumn} loading={adding} disabled={!newCol.name.trim()}>
            <Plus size={16} className="mr-1.5" />
            Add Column
          </Button>
        </div>
      </div>
    </div>
  )
}
