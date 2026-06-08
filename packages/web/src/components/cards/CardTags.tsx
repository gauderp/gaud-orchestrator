import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { CardTag } from '@gaud/shared'
import { api } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface CardTagsProps {
  cardId: string
  tags: CardTag[]
  onUpdate: () => void
}

const TAG_COLORS = [
  '#64748B', // slate
  '#2563EB', // blue
  '#059669', // green
  '#D97706', // amber
  '#DC2626', // red
  '#7C3AED', // violet
  '#DB2777', // pink
  '#0891B2', // cyan
]

export function CardTags({ cardId, tags, onUpdate }: CardTagsProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0]!)
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setAdding(true)
    try {
      await api.cards.addTag(cardId, { name: name.trim(), color })
      setName('')
      setColor(TAG_COLORS[0]!)
      setShowAdd(false)
      onUpdate()
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(tagId: string) {
    await api.cards.removeTag(cardId, tagId)
    onUpdate()
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Existing tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
              <button
                onClick={() => handleRemove(tag.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/20 cursor-pointer"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add tag */}
      {showAdd ? (
        <div className="flex flex-col gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tag name"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-1.5">
            {TAG_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`h-5 w-5 rounded-full cursor-pointer transition-all ${
                  color === c ? 'ring-2 ring-offset-1 ring-[var(--color-primary)]' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleAdd} loading={adding} disabled={!name.trim()}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] hover:text-[var(--color-ink)] dark:hover:text-[var(--color-ink-dark)] cursor-pointer"
        >
          <Plus size={12} />
          Add tag
        </button>
      )}
    </div>
  )
}
