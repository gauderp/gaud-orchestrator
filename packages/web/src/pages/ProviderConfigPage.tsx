import { useEffect, useState } from 'react'
import { Plug, Plus, Trash2, Zap } from 'lucide-react'
import { useProviderStore } from '@/store/providers'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'

const PROVIDER_TYPES = ['claude-cli', 'claude-api', 'openai', 'gemini', 'deepseek', 'cursor'] as const
const DEFAULT_PROVIDER_TYPE: string = PROVIDER_TYPES[0]

export function ProviderConfigPage() {
  const { providers, loading, fetchProviders, createProvider, deleteProvider, testProvider } =
    useProviderStore()
  const [showModal, setShowModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState(DEFAULT_PROVIDER_TYPE)
  const [formConfig, setFormConfig] = useState('{}')
  const [creating, setCreating] = useState(false)
  const [configError, setConfigError] = useState('')
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [testingId, setTestingId] = useState<string | null>(null)

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleCreate = async () => {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(formConfig)
      setConfigError('')
    } catch {
      setConfigError('Invalid JSON')
      return
    }
    setCreating(true)
    try {
      await createProvider({ name: formName.trim(), type: formType, configJson: parsed })
      setShowModal(false)
      setFormName('')
      setFormType(DEFAULT_PROVIDER_TYPE)
      setFormConfig('{}')
    } finally {
      setCreating(false)
    }
  }

  const handleTest = async (id: string) => {
    setTestingId(id)
    try {
      const result = await testProvider(id)
      setTestResults((prev) => ({ ...prev, [id]: result }))
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, message: err instanceof Error ? err.message : 'Test failed' },
      }))
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteProvider(id)
    setTestResults((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const getConfigSummary = (config: Record<string, unknown>): string => {
    const keys = Object.keys(config)
    if (keys.length === 0) return 'No config'
    return keys.slice(0, 3).join(', ') + (keys.length > 3 ? ` (+${keys.length - 3} more)` : '')
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[--color-ink] dark:text-[--color-ink-dark]">Providers</h1>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} className="mr-1.5" />
          Add Provider
        </Button>
      </div>

      {loading && <p className="text-[--color-muted] dark:text-[--color-muted-dark]">Loading...</p>}

      {!loading && providers.length === 0 && (
        <p className="text-[--color-muted] dark:text-[--color-muted-dark]">
          No providers configured yet. Add one to get started.
        </p>
      )}

      {!loading && providers.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => {
            const result = testResults[provider.id]
            return (
              <div
                key={provider.id}
                className="rounded-[--radius-lg] border border-[--color-border] bg-white p-[--spacing-lg] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Plug size={18} className="text-[--color-primary]" />
                    <h3 className="font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
                      {provider.name}
                    </h3>
                  </div>
                  <Badge variant="info">{provider.type}</Badge>
                </div>

                <p className="mb-4 text-sm text-[--color-muted] dark:text-[--color-muted-dark]">
                  {getConfigSummary(provider.configJson)}
                </p>

                {result && (
                  <div
                    className={`mb-3 rounded-[--radius-md] px-3 py-2 text-sm ${
                      result.success
                        ? 'bg-[--color-accent]/10 text-[--color-accent]'
                        : 'bg-[--color-destructive]/10 text-[--color-destructive]'
                    }`}
                  >
                    {result.message}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleTest(provider.id)}
                    loading={testingId === provider.id}
                  >
                    <Zap size={14} className="mr-1" />
                    Test
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(provider.id)}
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Provider">
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. My Claude API"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
              Type
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="h-9 rounded-[--radius-md] border border-[--color-border] bg-white px-3 text-sm text-[--color-ink] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark] dark:text-[--color-ink-dark]"
            >
              {PROVIDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Textarea
            label="Configuration (JSON)"
            value={formConfig}
            onChange={(e) => {
              setFormConfig(e.target.value)
              setConfigError('')
            }}
            error={configError}
            placeholder='{"apiKey": "sk-..."}'
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!formName.trim()}>
              Add Provider
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
