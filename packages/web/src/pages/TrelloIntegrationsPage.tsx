import { useState, useEffect } from 'react'
import { RefreshCw, Plus, Trash2, Power, PowerOff, ExternalLink } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import type { BoardWithColumns } from '@gaud/shared'

interface TrelloIntegration {
  id: string
  name: string
  target: 'bugs' | 'dev'
  trelloBoardId: string
  apiKey: string
  apiToken: string
  apiSecret: string | null
  configJson: string
  webhookSecret: string
  trelloWebhookId: string | null
  enabled: boolean
  lastBackfillAt: string | null
  createdAt: string
}

interface TrelloList {
  id: string
  name: string
}

export default function TrelloIntegrationsPage() {
  const [integrations, setIntegrations] = useState<TrelloIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [backfillResult, setBackfillResult] = useState<Record<string, string>>({})

  // Create form state
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [target, setTarget] = useState<'bugs' | 'dev'>('dev')
  const [apiKey, setApiKey] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [boardId, setBoardId] = useState('')
  const [trelloLists, setTrelloLists] = useState<TrelloList[]>([])
  const [devColumns, setDevColumns] = useState<Array<{ id: string; name: string }>>([])
  const [listMapping, setListMapping] = useState<Record<string, string>>({})
  const [captureListIds, setCaptureListIds] = useState<string[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadIntegrations() }, [])

  async function loadIntegrations() {
    setLoading(true)
    try {
      const data = await api.trelloIntegrations.list()
      setIntegrations(data)
    } catch (e: any) {
      console.error('Failed to load integrations:', e)
    }
    setLoading(false)
  }

  async function loadLists() {
    setLoadingLists(true)
    setError('')
    try {
      const lists = await api.trelloIntegrations.getLists({ apiKey, apiToken, boardId })
      setTrelloLists(lists)

      // Also load Dev board columns for mapping
      if (target === 'dev') {
        const board = await api.boards.get('dev-board')
        setDevColumns((board as BoardWithColumns).columns?.map((c: any) => ({ id: c.id, name: c.name })) || [])
      }

      setStep(3)
    } catch (e: any) {
      setError(e.message || 'Failed to load lists. Check credentials and board ID.')
    }
    setLoadingLists(false)
  }

  async function handleCreate() {
    setCreating(true)
    setError('')
    try {
      const configJson = target === 'dev'
        ? JSON.stringify({ listMapping })
        : JSON.stringify({ captureListIds })
      await api.trelloIntegrations.create({
        name: name.trim(),
        target,
        trelloBoardId: boardId,
        apiKey,
        apiToken,
        apiSecret: apiSecret || undefined,
        configJson,
      })
      resetForm()
      loadIntegrations()
    } catch (e: any) {
      setError(e.message || 'Failed to create integration')
    }
    setCreating(false)
  }

  async function handleToggle(integration: TrelloIntegration) {
    await api.trelloIntegrations.update(integration.id, { enabled: !integration.enabled })
    loadIntegrations()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this integration? Imported cards will remain.')) return
    await api.trelloIntegrations.delete(id)
    loadIntegrations()
  }

  async function handleBackfill(id: string) {
    setBackfillResult(prev => ({ ...prev, [id]: 'Running...' }))
    try {
      const result = await api.trelloIntegrations.backfill(id)
      setBackfillResult(prev => ({
        ...prev,
        [id]: `Created: ${result.created}, Updated: ${result.updated}, Ignored: ${result.ignored}, Subtasks linked: ${result.subtasksLinked}`,
      }))
    } catch (e: any) {
      setBackfillResult(prev => ({ ...prev, [id]: `Error: ${e.message}` }))
    }
  }

  function resetForm() {
    setShowCreate(false)
    setStep(1)
    setName('')
    setTarget('dev')
    setApiKey('')
    setApiToken('')
    setApiSecret('')
    setBoardId('')
    setTrelloLists([])
    setDevColumns([])
    setListMapping({})
    setCaptureListIds([])
    setError('')
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Trello Integrations</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Integration
        </Button>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mb-6">
        Import cards from Trello boards. <strong>Bugs</strong> target sends cards to Triage.{' '}
        <strong>Dev</strong> target maps Trello lists to Dev board columns. Import-only — nothing is written back to Trello.
      </p>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map(i => <div key={i} className="h-28 rounded-lg bg-[var(--color-bg-tertiary)]" />)}
        </div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          <span className="text-4xl block mb-3">📋</span>
          <p>No Trello integrations configured yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map(integration => (
            <div key={integration.id} className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{integration.name}</h3>
                  <Badge variant={integration.target === 'bugs' ? 'error' : 'info'}>{integration.target}</Badge>
                  {integration.trelloWebhookId
                    ? <Badge variant="success">Webhook active</Badge>
                    : <Badge variant="warning">No webhook</Badge>
                  }
                  {!integration.enabled && <Badge variant="warning">Disabled</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleBackfill(integration.id)}>
                    <RefreshCw className="w-4 h-4 mr-1" /> Backfill
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(integration)}>
                    {integration.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(integration.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
                <p>Board: {integration.trelloBoardId}</p>
                {integration.lastBackfillAt && <p>Last backfill: {new Date(integration.lastBackfillAt).toLocaleString()}</p>}
              </div>
              {backfillResult[integration.id] && (
                <p className="text-xs mt-2 p-2 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                  {backfillResult[integration.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal open={showCreate} title="Add Trello Integration" onClose={resetForm}>
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded bg-red-500/10 text-red-500 text-sm">{error}</div>
            )}

            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Name</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Product Board" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Target</label>
                  <select
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 text-sm"
                    value={target} onChange={e => setTarget(e.target.value as 'bugs' | 'dev')}
                  >
                    <option value="dev">Dev — map lists to Dev board columns</option>
                    <option value="bugs">Bugs — send cards to Triage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">API Key</label>
                  <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Trello API key" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">API Token</label>
                  <Input value={apiToken} onChange={e => setApiToken(e.target.value)} placeholder="Trello API token" type="password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    API Secret <span className="text-[var(--color-text-secondary)]">(optional, for HMAC verification)</span>
                  </label>
                  <Input value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="OAuth secret" type="password" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Board ID</label>
                  <Input value={boardId} onChange={e => setBoardId(e.target.value)} placeholder="Trello board ID (from URL)" />
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  <a href="https://trello.com/power-ups/admin" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                    Get API credentials <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={resetForm}>Cancel</Button>
                  <Button
                    onClick={() => { setStep(2); loadLists() }}
                    disabled={!name.trim() || !apiKey || !apiToken || !boardId}
                  >
                    Load Lists
                  </Button>
                </div>
              </>
            )}

            {step === 2 && (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--color-text-secondary)]" />
                <p className="text-sm text-[var(--color-text-secondary)]">Loading lists from Trello...</p>
              </div>
            )}

            {step === 3 && (
              <>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {target === 'dev' ? 'Map Trello lists to Dev board columns:' : 'Select lists to capture as bugs:'}
                </p>

                {trelloLists.map(list => (
                  <div key={list.id} className="flex items-center gap-3">
                    <span className="text-sm flex-shrink-0 w-40 truncate" title={list.name}>{list.name}</span>
                    {target === 'dev' ? (
                      <>
                        <span className="text-[var(--color-text-secondary)]">→</span>
                        <select
                          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-2 text-sm"
                          value={listMapping[list.id] || ''}
                          onChange={e => {
                            const val = e.target.value
                            setListMapping(prev => {
                              const next = { ...prev }
                              if (val) next[list.id] = val
                              else delete next[list.id]
                              return next
                            })
                          }}
                        >
                          <option value="">Ignore</option>
                          {devColumns.map(col => (
                            <option key={col.id} value={col.id}>{col.name}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <input
                        type="checkbox"
                        checked={captureListIds.includes(list.id)}
                        onChange={e => {
                          setCaptureListIds(prev =>
                            e.target.checked ? [...prev, list.id] : prev.filter(id => id !== list.id)
                          )
                        }}
                        className="ml-auto"
                      />
                    )}
                  </div>
                ))}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                  <Button
                    onClick={handleCreate}
                    disabled={creating || (target === 'dev' ? Object.keys(listMapping).length === 0 : captureListIds.length === 0)}
                  >
                    {creating ? 'Creating...' : 'Create Integration'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
