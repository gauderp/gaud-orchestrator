import { useState, useEffect } from 'react'
import { Webhook, Plus, Trash2, Copy, Check, Power, PowerOff } from 'lucide-react'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import type { BugSource } from '@gaud/shared'

const SOURCE_TYPES = [
  { value: 'generic', label: 'Generic (JSON)', description: 'Accepts NormalizedBugIntake JSON — for curl or custom integrations' },
  { value: 'bugsnag', label: 'Bugsnag', description: 'Receives Bugsnag error webhooks (firstException, reopened)' },
]

const selectCls = 'h-9 w-full box-border rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]'

export default function BugSourcesPage() {
  const [sources, setSources] = useState<BugSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('generic')
  const [configJson, setConfigJson] = useState('{}')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => { loadSources() }, [])

  async function loadSources() {
    setLoading(true)
    const data = await api.bugSources.list()
    setSources(data)
    setLoading(false)
  }

  async function handleCreate() {
    if (!name.trim()) return
    await api.bugSources.create({ name: name.trim(), type, configJson })
    setShowCreate(false)
    setName('')
    setType('generic')
    setConfigJson('{}')
    loadSources()
  }

  async function handleToggle(source: BugSource) {
    await api.bugSources.update(source.id, { enabled: !source.enabled })
    loadSources()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this bug source? Existing bug reports will keep their data.')) return
    await api.bugSources.delete(id)
    loadSources()
  }

  function getWebhookUrl(source: BugSource) {
    return `${window.location.origin}/api/intake/bugs/${source.id}?token=${source.webhookSecret}`
  }

  function copyUrl(source: BugSource) {
    navigator.clipboard.writeText(getWebhookUrl(source))
    setCopied(source.id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Webhook className="w-6 h-6 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
          <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Bug Sources</h1>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Source
        </Button>
      </div>

      <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-6">
        External tools send bugs via webhooks. Each source gets a unique URL with an auth token.
        Internal sources (UI, Slack, MCP) work as before.
      </p>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] dark:bg-[var(--color-surface-elevated-dark)]" />)}
        </div>
      ) : sources.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
          <Webhook className="w-12 h-12 opacity-40" />
          <p className="text-sm">No external bug sources configured yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(source => (
            <div key={source.id} className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{source.name}</h3>
                  <Badge variant={source.enabled ? 'success' : 'neutral'}>{source.type}</Badge>
                  {!source.enabled && <Badge variant="warning">Disabled</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleToggle(source)}>
                    {source.enabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(source.id)}>
                    <Trash2 className="w-4 h-4 text-[var(--color-destructive)]" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <code className="flex-1 text-xs p-2 rounded-[var(--radius-md)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated-dark)] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {getWebhookUrl(source)}
                </code>
                <Button variant="ghost" size="sm" onClick={() => copyUrl(source)}>
                  {copied === source.id ? <Check className="w-4 h-4 text-[var(--color-accent)]" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} title="Add Bug Source" onClose={() => { setShowCreate(false); setName(''); setType('generic') }}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-1">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Bugsnag Production" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-1">Type</label>
            <select className={selectCls} value={type} onChange={e => setType(e.target.value)}>
              {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mt-1">
              {SOURCE_TYPES.find(t => t.value === type)?.description}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
