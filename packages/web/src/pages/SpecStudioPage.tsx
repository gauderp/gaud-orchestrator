import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpecStore } from '@/store/specs'
import { api } from '@/api/client'
import type { Repository } from '@gaud/shared'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'

export function SpecStudioPage() {
  const navigate = useNavigate()
  const generateSpec = useSpecStore((s) => s.generateSpec)

  const [registeredRepos, setRegisteredRepos] = useState<Repository[]>([])
  const [selectedRepos, setSelectedRepos] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [agentStr, setAgentStr] = useState('')

  useEffect(() => {
    api.repositories.list().then(setRegisteredRepos)
  }, [])

  const clonedRepos = registeredRepos.filter(r => r.status === 'cloned')
  const [cardId, setCardId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await generateSpec({
        title,
        description,
        repos: selectedRepos.map(id => clonedRepos.find(r => r.id === id)?.githubUrl).filter(Boolean) as string[],
        agentIds: agentStr.split(',').map((s) => s.trim()).filter(Boolean),
        cardId: cardId || undefined,
      })
      navigate('/boards/spec-board')
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

        <div>
          <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-1 block">
            Repositories
          </label>
          <div className="space-y-2">
            {clonedRepos.map(repo => (
              <label key={repo.id} className="flex items-center gap-2 text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRepos.includes(repo.id)}
                  onChange={(e) => {
                    setSelectedRepos(prev =>
                      e.target.checked ? [...prev, repo.id] : prev.filter(id => id !== repo.id)
                    )
                  }}
                  className="rounded"
                />
                <span className="font-mono text-xs truncate">{repo.githubUrl}</span>
              </label>
            ))}
            {clonedRepos.length === 0 && (
              <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                No repositories registered. <a href="/repositories" className="text-[var(--color-primary)] hover:underline">Add one</a>
              </p>
            )}
          </div>
        </div>

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
