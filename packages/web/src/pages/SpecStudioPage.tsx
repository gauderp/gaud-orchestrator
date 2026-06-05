import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSpecStore } from '@/store/specs'

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
      <h1 className="text-2xl font-bold mb-6">Spec Studio</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description *</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Repos (comma-separated)</label>
          <input
            type="text"
            value={repoStr}
            onChange={(e) => setRepoStr(e.target.value)}
            placeholder="e.g. org/repo-a, org/repo-b"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Agent IDs (comma-separated) *</label>
          <input
            type="text"
            required
            value={agentStr}
            onChange={(e) => setAgentStr(e.target.value)}
            placeholder="e.g. agent-1, agent-2"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Card ID (optional)</label>
          <input
            type="text"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Generating...' : 'Generate Spec'}
        </button>
      </form>
    </div>
  )
}
