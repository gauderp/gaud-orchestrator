import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpecStore } from '@/store/specs'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

export function SpecStudioPage() {
  const navigate = useNavigate()
  const generateSpec = useSpecStore((s) => s.generateSpec)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [repoStr, setRepoStr] = useState('')
  const [agentStr, setAgentStr] = useState('')
  const [cardId, setCardId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await generateSpec({
        title,
        description,
        repos: repoStr.split(',').map((s) => s.trim()).filter(Boolean),
        agentIds: agentStr.split(',').map((s) => s.trim()).filter(Boolean),
        cardId: cardId || undefined,
      })
      navigate(`/specs/${result.spec.id}`)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate spec')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-lg font-semibold mb-6 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Spec Studio</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title *"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Textarea
          label="Description *"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[96px] resize-y"
        />

        <Input
          label="Repos (comma-separated)"
          type="text"
          value={repoStr}
          onChange={(e) => setRepoStr(e.target.value)}
          placeholder="e.g. org/repo-a, org/repo-b"
        />

        <Input
          label="Agent IDs (comma-separated) *"
          type="text"
          required
          value={agentStr}
          onChange={(e) => setAgentStr(e.target.value)}
          placeholder="e.g. agent-1, agent-2"
        />

        <Input
          label="Card ID (optional)"
          type="text"
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
        />

        {error && (
          <div className="rounded-lg border border-[var(--color-destructive)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] p-3 text-sm text-[var(--color-destructive)]">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          loading={submitting}
        >
          {submitting ? 'Generating...' : 'Generate Spec'}
        </Button>
      </form>
    </div>
  )
}
