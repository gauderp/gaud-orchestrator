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
    <div>
      <Link
        to="/skills"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
      >
        <ArrowLeft size={14} />
        Back to Skills
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
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
        <Textarea
          label="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[400px]"
          placeholder="Skill content (markdown)..."
        />
        <Button onClick={handleSave} loading={saving} disabled={!name.trim() || !content.trim()}>
          <Save size={16} className="mr-1.5" />
          {isNew ? 'Create Skill' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
