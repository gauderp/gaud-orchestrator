import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Trash2, Plus, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useBoardStore } from '@/store/boards'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Column } from '@gaud/shared'

const PROMPT_TEMPLATES = [
  {
    label: 'Generate Spec',
    description: 'Agent analyzes codebase and writes a technical specification',
    prompt: 'Analyze the codebase of the repos linked to this card. Generate a detailed technical specification as an [ARTIFACT]. Include: requirements, architecture, API changes, database changes, and acceptance criteria.',
  },
  {
    label: 'Review Spec',
    description: 'Agent reviews an existing spec for gaps and risks',
    prompt: 'Review the spec attached to this card for gaps, ambiguities, and technical risks. List each issue found with severity (critical/important/minor). If the spec is solid, respond with "Approved" as an [ARTIFACT].',
  },
  {
    label: 'Decompose into Tasks',
    description: 'Agent breaks a spec into atomic implementation tasks',
    prompt: 'Decompose the approved spec into atomic implementation tasks. For each task: title, description, type (task/bug), dependencies on other tasks, and suggested agent. Output as [ARTIFACT] in JSON format.',
  },
  {
    label: 'Code Review',
    description: 'Agent reviews code changes for quality and bugs',
    prompt: 'Review the code changes in the branch linked to this card. Check for: bugs, security issues, performance problems, test coverage, and adherence to project conventions. Provide feedback as comments.',
  },
  {
    label: 'Write Tests',
    description: 'Agent generates tests based on the spec',
    prompt: 'Based on the spec and acceptance criteria of this card, write comprehensive tests (unit + integration). Follow TDD patterns. Output the test code as an [ARTIFACT].',
  },
  {
    label: 'Estimate Cost',
    description: 'Agent estimates tokens and cost to implement',
    prompt: 'Analyze this card and estimate: (1) number of files to create/modify, (2) approximate lines of code, (3) estimated tokens for implementation, (4) estimated cost in USD. Be specific.',
  },
]

const RECOMMENDED_COLUMNS = [
  { name: 'Backlog', color: '#64748b', agentActionPrompt: null, autoMove: false },
  { name: 'Spec', color: '#3b82f6', agentActionPrompt: 'Analyze the codebase of the repos linked to this card. Generate a detailed technical specification as an [ARTIFACT]. Include: requirements, architecture, API changes, database changes, and acceptance criteria.', autoMove: true },
  { name: 'Review', color: '#f59e0b', agentActionPrompt: 'Review the spec attached to this card for gaps, ambiguities, and technical risks. List each issue found with severity. If solid, respond with "Approved" as an [ARTIFACT].', autoMove: false },
  { name: 'Approved', color: '#8b5cf6', agentActionPrompt: 'Decompose the approved spec into atomic implementation tasks. For each task: title, description, type (task/bug), dependencies, and suggested agent. Output as [ARTIFACT] in JSON.', autoMove: true },
  { name: 'Executing', color: '#2563eb', agentActionPrompt: null, autoMove: false },
  { name: 'Done', color: '#059669', agentActionPrompt: null, autoMove: false },
]

interface ColumnFormState {
  name: string
  color: string
  agentActionPrompt: string
  autoMove: boolean
}

function ColumnRow({
  column,
  onSaved,
  onDeleted,
  showTemplates,
  onToggleTemplates,
}: {
  column: Column
  onSaved: () => void
  onDeleted: () => void
  showTemplates: boolean
  onToggleTemplates: () => void
}) {
  const [form, setForm] = useState<ColumnFormState>({
    name: column.name,
    color: column.color,
    agentActionPrompt: column.agentActionPrompt ?? '',
    autoMove: column.autoMove,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.boards.updateColumn(column.id, {
        name: form.name,
        color: form.color,
        agentActionPrompt: form.agentActionPrompt || null,
        autoMove: form.autoMove,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await api.boards.deleteColumn(column.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      borderRadius: 8,
      border: '1px solid var(--color-border, #e2e8f0)',
      backgroundColor: 'var(--color-bg, #fff)',
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="flex-1"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Color</label>
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="h-9 w-12 cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Auto Move</label>
          <div className="flex h-9 items-center">
            <input
              type="checkbox"
              checked={form.autoMove}
              onChange={(e) => setForm((f) => ({ ...f, autoMove: e.target.checked }))}
              className="h-4 w-4 cursor-pointer rounded-[var(--radius-sm)] border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-ring)]"
            />
          </div>
        </div>
        <Button size="sm" onClick={handleSave} loading={saving}>
          Save
        </Button>
        <Button size="sm" variant="destructive" onClick={handleDelete} loading={deleting}>
          <Trash2 size={14} />
        </Button>
      </div>

      {/* Agent Action Prompt textarea */}
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--color-ink, #0f172a)' }}>
          Agent Action Prompt
        </label>
        <textarea
          value={form.agentActionPrompt}
          onChange={(e) => setForm((f) => ({ ...f, agentActionPrompt: e.target.value }))}
          placeholder="Enter the prompt the agent will execute when a card enters this column..."
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            border: '1px solid var(--color-border, #e2e8f0)',
            fontFamily: 'var(--font-mono, monospace)',
            minHeight: 72,
            backgroundColor: 'var(--color-bg, #fff)',
            color: 'var(--color-ink, #0f172a)',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--color-muted, #64748b)' }}>
            {form.agentActionPrompt ? `${form.agentActionPrompt.length} chars` : 'No prompt — manual column'}
          </span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={onToggleTemplates}
              style={{
                fontSize: 12,
                color: 'var(--color-primary, #2563eb)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Use template
            </button>
            {showTemplates && (
              <div style={{
                position: 'absolute',
                top: 20,
                right: 0,
                zIndex: 10,
                width: 380,
                backgroundColor: 'var(--color-bg, #fff)',
                borderRadius: 8,
                border: '1px solid var(--color-border, #e2e8f0)',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                padding: 4,
              }}>
                {PROMPT_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.label}
                    onClick={() => {
                      setForm((f) => ({ ...f, agentActionPrompt: tpl.prompt }))
                      onToggleTemplates()
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface, #f8fafc)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-ink, #0f172a)' }}>
                      {tpl.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted, #64748b)', marginTop: 2 }}>
                      {tpl.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function BoardSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const { activeBoard, fetchBoard } = useBoardStore()
  const [newCol, setNewCol] = useState({ name: '', color: '#6b7280' })
  const [adding, setAdding] = useState(false)
  const [showHelp, setShowHelp] = useState(true)
  const [showTemplates, setShowTemplates] = useState<string | null>(null)
  const [settingUp, setSettingUp] = useState(false)

  useEffect(() => {
    if (id) fetchBoard(id)
  }, [id, fetchBoard])

  const reload = () => {
    if (id) fetchBoard(id)
  }

  const handleAddColumn = async () => {
    if (!id || !newCol.name.trim()) return
    setAdding(true)
    try {
      await api.boards.createColumn(id, {
        name: newCol.name.trim(),
        color: newCol.color,
        position: activeBoard?.columns.length ?? 0,
      })
      setNewCol({ name: '', color: '#6b7280' })
      reload()
    } finally {
      setAdding(false)
    }
  }

  const handleSetupRecommended = async () => {
    if (!id) return
    setSettingUp(true)
    try {
      for (let i = 0; i < RECOMMENDED_COLUMNS.length; i++) {
        const col = RECOMMENDED_COLUMNS[i]
        await api.boards.createColumn(id, { ...col, position: i })
      }
      reload()
    } finally {
      setSettingUp(false)
    }
  }

  if (!activeBoard) {
    return <p className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</p>
  }

  const sortedColumns = [...activeBoard.columns].sort((a, b) => a.position - b.position)

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-4">
        <Link
          to={`/boards/${id}`}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:bg-[var(--color-surface-dark)] dark:hover:text-[var(--color-ink-dark)]"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          Board Settings — {activeBoard.name}
        </h1>
      </div>

      <div className="flex flex-col gap-3 mb-8">
        <h2 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Columns</h2>

        {/* Help section */}
        <div style={{
          marginBottom: 8,
          padding: 16,
          backgroundColor: 'var(--color-surface, #f8fafc)',
          borderRadius: 8,
          border: '1px solid var(--color-border, #e2e8f0)',
        }}>
          <button
            onClick={() => setShowHelp(!showHelp)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-ink, #0f172a)',
            }}
          >
            <HelpCircle size={16} />
            How Agent Action Prompts work
            {showHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showHelp && (
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-muted, #64748b)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: 8 }}>
                When a card is moved to a column with an Agent Action Prompt, the system automatically
                runs that prompt using the card's assigned agent. The agent receives the card's title,
                description, linked repos, and spec as context.
              </p>
              <p style={{ marginBottom: 8 }}>
                <strong>Auto Move:</strong> When enabled, the card automatically advances to the next
                column after the agent completes its action.
              </p>
              <p style={{ marginBottom: 0 }}>
                <strong>Tip:</strong> Leave the prompt empty for manual columns (like Backlog or Done).
                Use <code style={{
                  backgroundColor: 'var(--color-surface-elevated, #f1f5f9)',
                  padding: '1px 4px',
                  borderRadius: 4,
                  fontSize: 12,
                }}>[ARTIFACT]</code> in your prompt to instruct the agent to produce a final output.
              </p>
            </div>
          )}
        </div>

        {/* Recommended columns preset */}
        {sortedColumns.length <= 1 && (
          <div style={{
            marginBottom: 8,
            padding: 16,
            borderRadius: 8,
            border: '2px dashed var(--color-border, #e2e8f0)',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: 'var(--color-ink, #0f172a)', marginBottom: 8, fontWeight: 500 }}>
              Quick setup
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-muted, #64748b)', marginBottom: 12 }}>
              Create a recommended column set with pre-configured agent prompts for the full SDD workflow:
              Backlog → Spec → Review → Approved → Executing → Done
            </p>
            <button
              onClick={handleSetupRecommended}
              disabled={settingUp}
              style={{
                padding: '8px 20px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: 'var(--color-primary, #2563eb)',
                color: '#fff',
                border: 'none',
                cursor: settingUp ? 'not-allowed' : 'pointer',
                opacity: settingUp ? 0.6 : 1,
              }}
            >
              {settingUp ? 'Setting up...' : 'Setup recommended columns'}
            </button>
          </div>
        )}

        {sortedColumns.map((col) => (
          <ColumnRow
            key={col.id}
            column={col}
            onSaved={reload}
            onDeleted={reload}
            showTemplates={showTemplates === col.id}
            onToggleTemplates={() => setShowTemplates(showTemplates === col.id ? null : col.id)}
          />
        ))}
        {sortedColumns.length === 0 && (
          <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
            No columns yet. Add one below.
          </p>
        )}
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-3">Add Column</h3>
        <div className="flex items-end gap-3">
          <Input
            label="Column Name"
            value={newCol.name}
            onChange={(e) => setNewCol((s) => ({ ...s, name: e.target.value }))}
            placeholder="e.g. In Progress"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn() }}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Color</label>
            <input
              type="color"
              value={newCol.color}
              onChange={(e) => setNewCol((s) => ({ ...s, color: e.target.value }))}
              className="h-9 w-12 cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]"
            />
          </div>
          <Button onClick={handleAddColumn} loading={adding} disabled={!newCol.name.trim()}>
            <Plus size={16} className="mr-1.5" />
            Add Column
          </Button>
        </div>
      </div>
    </div>
  )
}
