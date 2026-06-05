import { useState, useEffect } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Agent, ConversationType } from '@gaud/shared'
import { api } from '@/api/client'

interface ConversationStarterProps {
  cardId: string
  onStart: (data: { cardId: string; type: string; agentIds: string[] }) => void
}

const CONVERSATION_TYPES: { value: ConversationType; label: string }[] = [
  { value: 'spec', label: 'Spec Generation' },
  { value: 'plan', label: 'Planning' },
  { value: 'code', label: 'Code Discussion' },
  { value: 'research', label: 'Research' },
  { value: 'review', label: 'Review' },
]

export function ConversationStarter({ cardId, onStart }: ConversationStarterProps) {
  const [type, setType] = useState<ConversationType>('spec')
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [agents, setAgents] = useState<Agent[]>([])

  useEffect(() => {
    api.agents.list().then(setAgents)
  }, [])

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const handleStart = () => {
    if (selectedAgentIds.length === 0) return
    onStart({ cardId, type, agentIds: selectedAgentIds })
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
      <div className="flex items-center gap-2">
        <MessageSquarePlus size={18} className="text-[var(--color-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          Start Conversation
        </h3>
      </div>

      {/* Type selector */}
      <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
          TYPE
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ConversationType)}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
        >
          {CONVERSATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Agent selector */}
      <div>
        <label className="mb-1 block text-xs font-medium tracking-wide text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
          AGENTS
        </label>
        <div className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => toggleAgent(agent.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedAgentIds.includes(agent.id)
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-ink)] hover:bg-[var(--color-surface)] dark:border-[var(--color-border-dark)] dark:text-[var(--color-ink-dark)] dark:hover:bg-[var(--color-surface-dark)]'
              }`}
            >
              {agent.name}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={handleStart} disabled={selectedAgentIds.length === 0}>
        Start Conversation
      </Button>
    </div>
  )
}
