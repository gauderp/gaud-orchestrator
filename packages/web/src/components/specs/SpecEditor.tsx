import { useState, useEffect } from 'react'
import type { Spec } from '@gaud/shared'
import { useSpecStore } from '@/store/specs'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

interface SpecEditorProps {
  spec: Spec
}

export function SpecEditor({ spec }: SpecEditorProps) {
  const updateSpec = useSpecStore((s) => s.updateSpec)
  const [title, setTitle] = useState(spec.title)
  const [content, setContent] = useState(spec.content ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(spec.title)
    setContent(spec.content ?? '')
  }, [spec.id, spec.title, spec.content])

  const dirty = title !== spec.title || content !== spec.content

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSpec(spec.id, { title, content })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Spec title"
          />
        </div>
        <span className="inline-flex items-center rounded-full bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
          v{spec.version}
        </span>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[400px] resize-y"
        placeholder="Write your spec in Markdown..."
      />

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          loading={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  )
}
