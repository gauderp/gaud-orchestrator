import { useState } from 'react'
import type { Card, CardType } from '@gaud/shared'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { useAgentStore } from '@/store/agents'

interface CardFormProps {
  initial?: Partial<Card>
  onSubmit: (data: {
    title: string
    description: string
    type: CardType
    assignedAgentId: string | null
    startDate: string | null
    dueDate: string | null
  }) => void
  loading?: boolean
}

const cardTypes: { value: CardType; label: string }[] = [
  { value: 'project', label: 'Project' },
  { value: 'epic', label: 'Epic' },
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
]

export function CardForm({ initial, onSubmit, loading }: CardFormProps) {
  const agents = useAgentStore((s) => s.agents)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<CardType>(initial?.type ?? 'task')
  const [assignedAgentId, setAssignedAgentId] = useState<string>(initial?.assignedAgentId ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? '')
  const [dueDate, setDueDate] = useState(initial?.dueDate?.slice(0, 10) ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit({
      title,
      description,
      type,
      assignedAgentId: assignedAgentId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[--color-ink] dark:text-[--color-ink-dark]">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CardType)}
          className="h-9 rounded-[--radius-md] border border-[--color-border] bg-white px-3 text-sm text-[--color-ink] focus:outline-none focus:ring-2 focus:ring-[--color-ring] dark:bg-[--color-surface-dark] dark:border-[--color-border-dark] dark:text-[--color-ink-dark]"
        >
          {cardTypes.map((ct) => (
            <option key={ct.value} value={ct.value}>
              {ct.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[--color-ink] dark:text-[--color-ink-dark]">Assigned Agent</label>
        <select
          value={assignedAgentId}
          onChange={(e) => setAssignedAgentId(e.target.value)}
          className="h-9 rounded-[--radius-md] border border-[--color-border] bg-white px-3 text-sm text-[--color-ink] focus:outline-none focus:ring-2 focus:ring-[--color-ring] dark:bg-[--color-surface-dark] dark:border-[--color-border-dark] dark:text-[--color-ink-dark]"
        >
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>

      <Button type="submit" loading={loading}>
        {initial ? 'Save Changes' : 'Create Card'}
      </Button>
    </form>
  )
}
