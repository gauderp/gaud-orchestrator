import { useState, useEffect } from 'react'
import type { Spec } from '@gaud/shared'
import { useSpecStore } from '../../store/specs.js'

interface SpecEditorProps {
  spec: Spec
}

export function SpecEditor({ spec }: SpecEditorProps) {
  const updateSpec = useSpecStore((s) => s.updateSpec)
  const [title, setTitle] = useState(spec.title)
  const [content, setContent] = useState(spec.content)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(spec.title)
    setContent(spec.content)
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
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Spec title"
        />
        <span className="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
          v{spec.version}
        </span>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full min-h-[400px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        placeholder="Write your spec in Markdown..."
      />

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
