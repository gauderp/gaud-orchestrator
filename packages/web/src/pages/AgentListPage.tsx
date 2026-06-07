import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { useAgentStore } from '@/store/agents'
import { useProviderStore } from '@/store/providers'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { Agent } from '@gaud/shared'

interface TreeNode {
  agent: Agent
  children: TreeNode[]
}

function buildTree(agents: Agent[]): TreeNode[] {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const agent of agents) {
    map.set(agent.id, { agent, children: [] })
  }

  for (const agent of agents) {
    const node = map.get(agent.id)!
    if (agent.parentAgentId && map.has(agent.parentAgentId)) {
      map.get(agent.parentAgentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function AgentNode({ node, providers, depth = 0 }: { node: TreeNode; providers: { id: string; name: string; type: string }[]; depth?: number }) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const provider = node.agent.providerId
    ? providers.find((p) => p.id === node.agent.providerId)
    : null

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-[var(--color-surface)] dark:hover:bg-[var(--color-surface-dark)]"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)] cursor-pointer"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Bot size={16} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
        <Link
          to={`/agents/${node.agent.id}`}
          className="flex-1 flex items-center gap-2"
        >
          <span className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            {node.agent.name}
          </span>
          {node.agent.role && (
            <span className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              {node.agent.role}
            </span>
          )}
        </Link>
        <Badge variant={provider ? 'info' : 'neutral'}>
          {provider ? provider.type : 'No provider'}
        </Badge>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <AgentNode key={child.agent.id} node={child} providers={providers} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function AgentListPage() {
  const { agents, loading, fetchAgents, createAgent } = useAgentStore()
  const { providers, fetchProviders } = useProviderStore()
  const [view, setView] = useState<'tree' | 'list'>('tree')
  const [showModal, setShowModal] = useState(false)
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formParent, setFormParent] = useState('')
  const [formCostLimit, setFormCostLimit] = useState('')
  const [formProvider, setFormProvider] = useState('')
  const [formModel, setFormModel] = useState('')
  const [creating, setCreating] = useState(false)

  function getModelsForProvider(providerId: string): string[] {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return []
    switch (provider.type) {
      case 'claude-cli':
      case 'claude-api':
        return ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5']
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3-mini']
      case 'gemini':
        return ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']
      case 'deepseek':
        return ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner']
      case 'cursor':
        return ['default']
      default:
        return []
    }
  }

  useEffect(() => {
    fetchAgents()
    fetchProviders()
  }, [fetchAgents, fetchProviders])

  const tree = buildTree(agents)

  const handleCreate = async () => {
    if (!formName.trim()) return
    setCreating(true)
    try {
      await createAgent({
        name: formName.trim(),
        role: formRole.trim() || null,
        parentAgentId: formParent || null,
        costLimitUsd: formCostLimit ? Number(formCostLimit) : 0,
        providerId: formProvider || null,
        model: formModel || null,
      })
      setShowModal(false)
      setFormName('')
      setFormRole('')
      setFormParent('')
      setFormCostLimit('')
      setFormProvider('')
      setFormModel('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Agents</h1>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} className="mr-1.5" />
          New Agent
        </Button>
      </div>

      <div className="mb-4 flex gap-1 border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
        <button
          onClick={() => setView('tree')}
          className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            view === 'tree'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]'
          }`}
        >
          Tree
        </button>
        <button
          onClick={() => setView('list')}
          className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            view === 'list'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]'
          }`}
        >
          List
        </button>
      </div>

      {loading && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-2 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2">
              <div className="h-4 w-4 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              <div className="h-4 w-4 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              <div className="h-4 flex-1 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              <div className="h-5 w-20 rounded-full bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!loading && view === 'tree' && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-2 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Bot size={48} className="text-[var(--color-border)] dark:text-[var(--color-border-dark)]" />
              <p className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">No agents yet</p>
              <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Create your first agent to start orchestrating</p>
              <Button size="sm" onClick={() => setShowModal(true)}>
                <Plus size={14} className="mr-1" />
                New Agent
              </Button>
            </div>
          ) : (
            tree.map((node) => (
              <AgentNode key={node.agent.id} node={node} providers={providers} />
            ))
          )}
        </div>
      )}

      {!loading && view === 'list' && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Name</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Role</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Provider</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Model</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Cost Limit</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Bot size={48} className="mx-auto mb-3 text-[var(--color-border)] dark:text-[var(--color-border-dark)]" />
                    <p className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">No agents yet</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Create your first agent to start orchestrating</p>
                  </td>
                </tr>
              ) : (
                agents.map((agent) => {
                  const provider = agent.providerId
                    ? providers.find((p) => p.id === agent.providerId)
                    : null
                  return (
                    <tr
                      key={agent.id}
                      className="border-b border-[var(--color-border)] bg-white dark:border-[var(--color-border-dark)] dark:bg-transparent"
                    >
                      <td className="px-4 py-2 font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                        {agent.name}
                      </td>
                      <td className="px-4 py-2 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                        {agent.role || '-'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={provider ? 'info' : 'neutral'}>
                          {provider ? provider.name : 'None'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                        {agent.model || '-'}
                      </td>
                      <td className="px-4 py-2 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                        ${agent.costLimitUsd.toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          to={`/agents/${agent.id}`}
                          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Agent">
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Lead Architect"
          />
          <Input
            label="Role"
            value={formRole}
            onChange={(e) => setFormRole(e.target.value)}
            placeholder="e.g. Plans system architecture"
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              Parent Agent
            </label>
            <select
              value={formParent}
              onChange={(e) => setFormParent(e.target.value)}
              className="h-9 w-full box-border rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
            >
              <option value="">None (root agent)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500 }}>Provider</label>
            <select
              value={formProvider}
              onChange={(e) => {
                setFormProvider(e.target.value)
                setFormModel('')
              }}
              style={{
                height: 36, width: '100%', boxSizing: 'border-box',
                borderRadius: 6, border: '1px solid #e2e8f0',
                paddingLeft: 12, paddingRight: 12, fontSize: 14,
                backgroundColor: '#fff',
              }}
            >
              <option value="">No provider</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
          </div>
          {formProvider && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500 }}>Model</label>
              <select
                value={formModel}
                onChange={(e) => setFormModel(e.target.value)}
                style={{
                  height: 36, width: '100%', boxSizing: 'border-box',
                  borderRadius: 6, border: '1px solid #e2e8f0',
                  paddingLeft: 12, paddingRight: 12, fontSize: 14,
                  backgroundColor: '#fff',
                }}
              >
                <option value="">Default model</option>
                {getModelsForProvider(formProvider).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
          <Input
            label="Cost Limit (USD)"
            type="number"
            value={formCostLimit}
            onChange={(e) => setFormCostLimit(e.target.value)}
            placeholder="0.00"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={creating} disabled={!formName.trim()}>
              Create Agent
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
