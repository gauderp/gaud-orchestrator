import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, Plus, DollarSign, Shield, Check, X, Clock } from 'lucide-react'
import { useAgentStore } from '@/store/agents'
import { useSkillStore } from '@/store/skills'
import { useProviderStore } from '@/store/providers'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type Tab = 'instructions' | 'skills' | 'cost' | 'reviews'

interface CostData {
  totalCostUsd: number
  totalTokensIn: number
  totalTokensOut: number
  limitUsd: number
  isOverLimit: boolean
}

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { selectedAgent, fetchAgent, updateAgent } = useAgentStore()
  const { skills, fetchSkills } = useSkillStore()
  const { providers, fetchProviders } = useProviderStore()

  const [tab, setTab] = useState<Tab>('instructions')
  const [instructions, setInstructions] = useState('')
  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')
  const [costLimit, setCostLimit] = useState('')
  const [costData, setCostData] = useState<CostData | null>(null)
  const [addSkillId, setAddSkillId] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingReviews, setPendingReviews] = useState<any[]>([])
  const [allReviews, setAllReviews] = useState<any[]>([])
  const [hierarchyParentId, setHierarchyParentId] = useState('')
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [escalationTimeout, setEscalationTimeout] = useState('30')
  const [agents, setAgents] = useState<any[]>([])

  useEffect(() => {
    if (!id) return
    fetchAgent(id)
    fetchSkills()
    fetchProviders()
    api.agents.getCost(id).then(setCostData).catch(() => {})
    api.agents.getReviews(id).then(setPendingReviews).catch(() => {})
    api.agents.getAllReviews(id).then(setAllReviews).catch(() => {})
    api.agents.list().then(setAgents).catch(() => {})
  }, [id, fetchAgent, fetchSkills, fetchProviders])

  useEffect(() => {
    if (selectedAgent) {
      setInstructions(selectedAgent.instructions ?? '')
      setProviderId(selectedAgent.providerId ?? '')
      setModel(selectedAgent.model ?? '')
      setCostLimit(String(selectedAgent.costLimitUsd))
      setHierarchyParentId((selectedAgent as any).parentAgentId ?? '')
      setRequiresApproval((selectedAgent as any).requiresParentApproval === 1 || (selectedAgent as any).requiresParentApproval === true)
      setEscalationTimeout(String((selectedAgent as any).escalationTimeoutMinutes ?? 30))
    }
  }, [selectedAgent])

  if (!id) return null

  const agentSkillIds = new Set(selectedAgent?.skills?.map((s) => s.id) ?? [])
  const availableSkills = skills.filter((s) => !agentSkillIds.has(s.id))

  const handleSaveInstructions = async () => {
    setSaving(true)
    try {
      await updateAgent(id, { instructions })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveProvider = async () => {
    setSaving(true)
    try {
      await updateAgent(id, { providerId: providerId || null, model: model || null })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCostLimit = async () => {
    setSaving(true)
    try {
      await updateAgent(id, { costLimitUsd: Number(costLimit) || 0 })
    } finally {
      setSaving(false)
    }
  }

  const handleAddSkill = async () => {
    if (!addSkillId) return
    await api.agents.assignSkill(id, addSkillId)
    setAddSkillId('')
    fetchAgent(id)
  }

  const handleRemoveSkill = async (skillId: string) => {
    await api.agents.removeSkill(id, skillId)
    fetchAgent(id)
  }

  const handleSaveHierarchy = async () => {
    if (!id) return
    setSaving(true)
    try {
      await api.agents.updateHierarchy(id, {
        parentAgentId: hierarchyParentId || null,
        requiresParentApproval: requiresApproval,
        escalationTimeoutMinutes: Number(escalationTimeout) || 30,
      })
      fetchAgent(id)
    } finally {
      setSaving(false)
    }
  }

  const handleResolveReview = async (reviewId: string, status: 'approved' | 'rejected' | 'changes_requested') => {
    if (!id) return
    await api.reviews.resolve(reviewId, { status })
    api.agents.getReviews(id).then(setPendingReviews).catch(() => {})
    api.agents.getAllReviews(id).then(setAllReviews).catch(() => {})
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'instructions', label: 'Instructions' },
    { key: 'skills', label: 'Skills' },
    { key: 'cost', label: 'Cost' },
    { key: 'reviews', label: `Reviews${pendingReviews.length > 0 ? ` (${pendingReviews.length})` : ''}` },
  ]

  return (
    <div className="p-6">
      <Link
        to="/agents"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
      >
        <ArrowLeft size={14} />
        Back to Agents
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          {selectedAgent?.name ?? 'Loading...'}
        </h1>
        {selectedAgent?.role && (
          <p className="mt-1 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            {selectedAgent.role}
          </p>
        )}
      </div>

      <div className="mb-6 flex gap-1 border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
              tab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'instructions' && (
        <div className="space-y-4">
          <Textarea
            label="Agent Instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="min-h-[300px]"
            placeholder="Enter instructions for this agent..."
          />
          <Button onClick={handleSaveInstructions} loading={saving}>
            <Save size={16} className="mr-1.5" />
            Save Instructions
          </Button>
        </div>
      )}

      {tab === 'skills' && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              Assigned Skills
            </h3>
            {selectedAgent?.skills?.length ? (
              <div className="space-y-2">
                {selectedAgent.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 dark:border-[var(--color-border-dark)]"
                  >
                    <div>
                      <div className="font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                        {skill.name}
                      </div>
                      {skill.description && (
                        <div className="mt-0.5 text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                          {skill.description}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSkill(skill.id)}
                    >
                      <Trash2 size={14} className="text-[var(--color-destructive)]" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                No skills assigned yet.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              Add Skill
            </h3>
            <div className="flex gap-2">
              <select
                value={addSkillId}
                onChange={(e) => setAddSkillId(e.target.value)}
                className="h-9 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
              >
                <option value="">Select a skill...</option>
                {availableSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button onClick={handleAddSkill} disabled={!addSkillId} size="sm">
                <Plus size={14} className="mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'cost' && (
        <div className="space-y-6">
          {costData && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-[var(--spacing-lg)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
              <div className="mb-3 flex items-center gap-2">
                <DollarSign size={18} className="text-[var(--color-primary)]" />
                <h3 className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  Cost Summary
                </h3>
                <Badge variant={costData.isOverLimit ? 'error' : 'success'}>
                  {costData.isOverLimit ? 'Over Limit' : 'Within Limit'}
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Total Cost</div>
                  <div className="text-lg font-bold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                    ${costData.totalCostUsd.toFixed(4)} / ${costData.limitUsd.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Tokens In</div>
                  <div className="text-lg font-bold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                    {costData.totalTokensIn.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Tokens Out</div>
                  <div className="text-lg font-bold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                    {costData.totalTokensOut.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              Provider / Model
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  Provider
                </label>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="h-9 w-full box-border rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
                >
                  <option value="">None</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. claude-sonnet-4-20250514"
              />
            </div>
            <Button onClick={handleSaveProvider} loading={saving}>
              <Save size={16} className="mr-1.5" />
              Save Provider
            </Button>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              Cost Limit
            </h3>
            <div className="flex items-end gap-2">
              <Input
                label="Limit (USD)"
                type="number"
                value={costLimit}
                onChange={(e) => setCostLimit(e.target.value)}
                placeholder="0.00"
              />
              <Button onClick={handleSaveCostLimit} loading={saving}>
                <Save size={16} className="mr-1.5" />
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-6">
          {/* Hierarchy Settings */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-[var(--spacing-lg)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
            <div className="mb-3 flex items-center gap-2">
              <Shield size={18} className="text-[var(--color-primary)]" />
              <h3 className="font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                Hierarchy Settings
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  Parent Agent
                </label>
                <select
                  value={hierarchyParentId}
                  onChange={(e) => setHierarchyParentId(e.target.value)}
                  className="h-9 w-full box-border rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
                >
                  <option value="">None (root agent)</option>
                  {agents.filter((a) => a.id !== id).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="requiresApproval"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--color-border)]"
                />
                <label htmlFor="requiresApproval" className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  Requires parent approval before PR creation
                </label>
              </div>
              <Input
                label="Escalation Timeout (minutes)"
                type="number"
                value={escalationTimeout}
                onChange={(e) => setEscalationTimeout(e.target.value)}
                placeholder="30"
              />
              <Button onClick={handleSaveHierarchy} loading={saving}>
                <Save size={16} className="mr-1.5" />
                Save Hierarchy
              </Button>
            </div>
          </div>

          {/* Pending Reviews (as reviewer) */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              Pending Reviews (as reviewer)
            </h3>
            {pendingReviews.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                No pending reviews.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingReviews.map((review: any) => (
                  <div
                    key={review.id}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 dark:border-[var(--color-border-dark)]"
                  >
                    <div>
                      <div className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                        Review for {review.revieweeAgentId}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                        <Clock size={12} />
                        {new Date(review.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => handleResolveReview(review.id, 'approved')}>
                        <Check size={14} className="mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleResolveReview(review.id, 'changes_requested')}>
                        <X size={14} className="mr-1" /> Request Changes
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review History */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
              Review History
            </h3>
            {allReviews.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                No reviews yet.
              </p>
            ) : (
              <div className="space-y-2">
                {allReviews.map((review: any) => (
                  <div
                    key={review.id}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] p-3 dark:border-[var(--color-border-dark)]"
                  >
                    <div>
                      <div className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                        Reviewed by {review.reviewerAgentId}
                      </div>
                      {review.comment && (
                        <div className="mt-0.5 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] max-w-md truncate">
                          {review.comment}
                        </div>
                      )}
                    </div>
                    <Badge variant={
                      review.status === 'approved' ? 'success' :
                      review.status === 'rejected' ? 'error' :
                      review.status === 'changes_requested' ? 'warning' : 'neutral'
                    }>
                      {review.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
