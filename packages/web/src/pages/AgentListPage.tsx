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
        className="flex items-center gap-2 rounded-[--radius-md] px-2 py-1.5 hover:bg-[--color-surface] dark:hover:bg-[--color-surface-dark]"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 text-[--color-muted] hover:text-[--color-ink] dark:text-[--color-muted-dark] dark:hover:text-[--color-ink-dark] cursor-pointer"
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <Bot size={16} className="text-[--color-muted] dark:text-[--color-muted-dark]" />
        <Link
          to={`/agents/${node.agent.id}`}
          className="flex-1 flex items-center gap-2"
        >
          <span className="font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            {node.agent.name}
          </span>
          {node.agent.role && (
            <span className="text-sm text-[--color-muted] dark:text-[--color-muted-dark]">
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
  const [creating, setCreating] = useState(false)

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
      })
      setShowModal(false)
      setFormName('')
      setFormRole('')
      setFormParent('')
      setFormCostLimit('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[--color-ink] dark:text-[--color-ink-dark]">Agents</h1>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} className="mr-1.5" />
          New Agent
        </Button>
      </div>

      <div className="mb-4 flex gap-1 rounded-[--radius-md] border border-[--color-border] p-1 dark:border-[--color-border-dark] w-fit">
        <button
          onClick={() => setView('tree')}
          className={`rounded-[--radius-md] px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            view === 'tree'
              ? 'bg-[--color-primary] text-[--color-on-primary]'
              : 'text-[--color-muted] hover:text-[--color-ink] dark:text-[--color-muted-dark] dark:hover:text-[--color-ink-dark]'
          }`}
        >
          Tree
        </button>
        <button
          onClick={() => setView('list')}
          className={`rounded-[--radius-md] px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            view === 'list'
              ? 'bg-[--color-primary] text-[--color-on-primary]'
              : 'text-[--color-muted] hover:text-[--color-ink] dark:text-[--color-muted-dark] dark:hover:text-[--color-ink-dark]'
          }`}
        >
          List
        </button>
      </div>

      {loading && <p className="text-[--color-muted] dark:text-[--color-muted-dark]">Loading...</p>}

      {!loading && view === 'tree' && (
        <div className="rounded-[--radius-lg] border border-[--color-border] bg-white p-2 dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
          {tree.length === 0 ? (
            <p className="p-4 text-center text-[--color-muted] dark:text-[--color-muted-dark]">
              No agents yet. Create your first agent to get started.
            </p>
          ) : (
            tree.map((node) => (
              <AgentNode key={node.agent.id} node={node} providers={providers} />
            ))
          )}
        </div>
      )}

      {!loading && view === 'list' && (
        <div className="overflow-x-auto rounded-[--radius-lg] border border-[--color-border] dark:border-[--color-border-dark]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[--color-border] bg-[--color-surface] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark]">
                <th className="px-4 py-2 text-left font-medium text-[--color-muted] dark:text-[--color-muted-dark]">Name</th>
                <th className="px-4 py-2 text-left font-medium text-[--color-muted] dark:text-[--color-muted-dark]">Role</th>
                <th className="px-4 py-2 text-left font-medium text-[--color-muted] dark:text-[--color-muted-dark]">Provider</th>
                <th className="px-4 py-2 text-left font-medium text-[--color-muted] dark:text-[--color-muted-dark]">Model</th>
                <th className="px-4 py-2 text-left font-medium text-[--color-muted] dark:text-[--color-muted-dark]">Cost Limit</th>
                <th className="px-4 py-2 text-left font-medium text-[--color-muted] dark:text-[--color-muted-dark]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[--color-muted] dark:text-[--color-muted-dark]">
                    No agents yet.
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
                      className="border-b border-[--color-border] bg-white dark:border-[--color-border-dark] dark:bg-transparent"
                    >
                      <td className="px-4 py-2 font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
                        {agent.name}
                      </td>
                      <td className="px-4 py-2 text-[--color-muted] dark:text-[--color-muted-dark]">
                        {agent.role || '-'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={provider ? 'info' : 'neutral'}>
                          {provider ? provider.name : 'None'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-[--color-muted] dark:text-[--color-muted-dark]">
                        {agent.model || '-'}
                      </td>
                      <td className="px-4 py-2 text-[--color-ink] dark:text-[--color-ink-dark]">
                        ${agent.costLimitUsd.toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          to={`/agents/${agent.id}`}
                          className="text-sm font-medium text-[--color-primary] hover:underline"
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
            <label className="text-xs font-medium text-[--color-ink] dark:text-[--color-ink-dark]">
              Parent Agent
            </label>
            <select
              value={formParent}
              onChange={(e) => setFormParent(e.target.value)}
              className="h-9 rounded-[--radius-md] border border-[--color-border] bg-white px-3 text-sm text-[--color-ink] dark:border-[--color-border-dark] dark:bg-[--color-surface-dark] dark:text-[--color-ink-dark]"
            >
              <option value="">None (root agent)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
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
