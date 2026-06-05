import { useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { CardRepo } from '@gaud/shared'
import { api } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface CardReposProps {
  cardId: string
  repos: CardRepo[]
  onUpdate: () => void
}

export function CardRepos({ cardId, repos, onUpdate }: CardReposProps) {
  const [repoPath, setRepoPath] = useState('')
  const [specPath, setSpecPath] = useState('')
  const [adding, setAdding] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!repoPath.trim()) return
    setAdding(true)
    try {
      await api.cards.addRepo(cardId, { repoPath: repoPath.trim(), specPath: specPath.trim() || undefined })
      setRepoPath('')
      setSpecPath('')
      onUpdate()
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(repoId: string) {
    await api.cards.removeRepo(cardId, repoId)
    onUpdate()
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">Repositories</h3>

      {repos.length === 0 && (
        <p className="text-xs text-[--color-muted] dark:text-[--color-muted-dark]">No repositories linked.</p>
      )}

      <div className="flex flex-col gap-2">
        {repos.map((repo) => (
          <div
            key={repo.id}
            className="flex items-center justify-between rounded-[--radius-md] border border-[--color-border] bg-white px-3 py-2 text-sm dark:bg-[--color-surface-dark] dark:border-[--color-border-dark]"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[--color-ink] dark:text-[--color-ink-dark] truncate font-mono text-xs">{repo.repoPath}</span>
              {repo.specPath && (
                <span className="text-[--color-muted] dark:text-[--color-muted-dark] truncate text-xs">{repo.specPath}</span>
              )}
            </div>
            <button
              onClick={() => handleRemove(repo.id)}
              className="shrink-0 ml-2 rounded-[--radius-md] p-1 text-[--color-muted] hover:text-[--color-destructive] hover:bg-[--color-surface] dark:hover:bg-[--color-surface-dark] cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col gap-2">
        <Input
          placeholder="Repository path"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
        />
        <Input
          placeholder="Spec path (optional)"
          value={specPath}
          onChange={(e) => setSpecPath(e.target.value)}
        />
        <Button type="submit" variant="secondary" size="sm" loading={adding}>
          <Plus size={14} className="mr-1" />
          Add Repository
        </Button>
      </form>
    </div>
  )
}
