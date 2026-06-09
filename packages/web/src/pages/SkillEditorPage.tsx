import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useSkillStore } from '@/store/skills'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

export function SkillEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { createSkill, updateSkill } = useSkillStore()

  const isNew = !id
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.skills
      .get(id)
      .then((skill) => {
        setName(skill.name)
        setDescription(skill.description ?? '')
        setContent(skill.content)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return
    setSaving(true)
    try {
      if (isNew) {
        await createSkill({
          name: name.trim(),
          description: description.trim() || undefined,
          content: content.trim(),
        })
      } else {
        await updateSkill(id, {
          name: name.trim(),
          description: description.trim() || undefined,
          content: content.trim(),
        })
      }
      navigate('/skills')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</p>
  }

  return (
    <div className="p-6">
      <Link
        to="/skills"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
      >
        <ArrowLeft size={14} />
        Back to Skills
      </Link>

      <h1 className="mb-6 text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
        {isNew ? 'New Skill' : 'Edit Skill'}
      </h1>

      <div className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. code-review"
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this skill does"
        />
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Content</label>
            <label className="text-[11px] text-[var(--color-primary)] hover:underline cursor-pointer">
              <input
                type="file"
                accept=".md"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const text = await file.text()
                  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
                  if (match) {
                    const fm = match[1]!
                    const body = match[2]!.trim()
                    const parsedName = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim()
                    const parsedDesc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim()
                    if (parsedName && !name) setName(parsedName)
                    if (parsedDesc && !description) setDescription(parsedDesc)
                    setContent(body)
                  } else {
                    setContent(text)
                  }
                }}
              />
              Upload .md file
            </label>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[400px] mt-1"
            placeholder="Skill content (markdown)..."
          />
        </div>
        <Button onClick={handleSave} loading={saving} disabled={!name.trim() || !content.trim()}>
          <Save size={16} className="mr-1.5" />
          {isNew ? 'Create Skill' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
