import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { CardRepo, Repository } from '@gaud/shared'
import { api } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface CardReposProps {
  cardId: string
  repos: CardRepo[]
  onUpdate: () => void
}

export function CardRepos({ cardId, repos, onUpdate }: CardReposProps) {
  const [selectedRepo, setSelectedRepo] = useState('')
  const [manualPath, setManualPath] = useState('')
  const [specPath, setSpecPath] = useState('')
  const [adding, setAdding] = useState(false)
  const [registeredRepos, setRegisteredRepos] = useState<Repository[]>([])

  useEffect(() => {
    api.repositories.list().then(setRegisteredRepos)
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    try {
      if (selectedRepo === '__manual__') {
        if (!manualPath.trim()) return
        await api.cards.addRepo(cardId, { repoPath: manualPath.trim(), specPath: specPath.trim() || undefined })
        setManualPath('')
      } else if (selectedRepo) {
        await api.cards.addRepo(cardId, {
          repoPath: registeredRepos.find(r => r.id === selectedRepo)?.githubUrl ?? '',
          specPath: specPath.trim() || undefined,
          repositoryId: selectedRepo,
        } as any)
      }
      setSpecPath('')
      setSelectedRepo('')
      onUpdate()
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(repoId: string) {
    await api.cards.removeRepo(cardId, repoId)
    onUpdate()
  }

  const clonedRepos = registeredRepos.filter(r => r.status === 'cloned')

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Repositories</h3>

      {repos.length === 0 && (
        <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">No repositories linked.</p>
      )}

      <div className="flex flex-col gap-2">
        {repos.map((repo) => (
          <div
            key={repo.id}
            className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm dark:bg-[var(--color-surface-dark)] dark:border-[var(--color-border-dark)]"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] truncate font-mono text-xs">{repo.repoPath}</span>
              {repo.specPath && (
                <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] truncate text-xs">{repo.specPath}</span>
              )}
            </div>
            <button
              onClick={() => handleRemove(repo.id)}
              className="shrink-0 ml-2 rounded-[var(--radius-md)] p-1 text-[var(--color-muted)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)] cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <select
          value={selectedRepo}
          onChange={(e) => setSelectedRepo(e.target.value)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-2.5 h-8 text-[13px] dark:bg-[var(--color-surface-dark)] dark:border-[var(--color-border-dark)] dark:text-[var(--color-ink-dark)]"
        >
          <option value="">Select a repository...</option>
          {clonedRepos.map(r => (
            <option key={r.id} value={r.id}>{r.githubUrl}</option>
          ))}
          <option value="__manual__">Manual path...</option>
        </select>

        {selectedRepo === '__manual__' && (
          <Input
            placeholder="Repository path"
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
          />
        )}

        <Input
          placeholder="Spec path (optional)"
          value={specPath}
          onChange={(e) => setSpecPath(e.target.value)}
        />
        <Button type="submit" variant="secondary" size="sm" loading={adding} disabled={!selectedRepo}>
          <Plus size={14} className="mr-1" />
          Add Repository
        </Button>
      </form>
    </div>
  )
}
