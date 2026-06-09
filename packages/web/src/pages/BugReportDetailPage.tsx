import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bug, Kanban, Trash2, RefreshCw, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Clock, Paperclip } from 'lucide-react'
import type { BugReportWithAttachments, Agent, Board, BoardWithColumns } from '@gaud/shared'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConversationView } from '@/components/conversation/ConversationView'
import { useConversationStore } from '@/store/conversations'

const statusConfig: Record<string, { label: string; icon: any }> = {
  new: { label: 'New', icon: Clock },
  triaging: { label: 'Triaging...', icon: RefreshCw },
  needs_info: { label: 'Needs Info', icon: HelpCircle },
  triaged: { label: 'Triaged', icon: CheckCircle2 },
  rejected: { label: 'Rejected', icon: XCircle },
}

const statusBadgeVariant: Record<string, 'neutral' | 'warning' | 'success' | 'error' | 'info'> = {
  new: 'info',
  triaging: 'warning',
  needs_info: 'warning',
  triaged: 'success',
  rejected: 'error',
}

const severityBadgeVariant: Record<string, 'error' | 'warning' | 'neutral' | 'info'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'info',
}

export function BugReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<BugReportWithAttachments | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoard, setSelectedBoard] = useState<BoardWithColumns | null>(null)
  const [selectedColumnId, setSelectedColumnId] = useState('')
  const [triageAgentId, setTriageAgentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [triaging, setTriaging] = useState(false)
  const [creatingCard, setCreatingCard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeConversation = useConversationStore((s) => s.activeConversation)

  // Track conversationId separately to avoid re-fetch loops
  const [convId, setConvId] = useState<string | null>(null)

  useEffect(() => { loadData() }, [id])

  // When report loads/updates with a conversationId, fetch it once
  useEffect(() => {
    if (report?.conversationId && report.conversationId !== convId) {
      setConvId(report.conversationId)
      useConversationStore.getState().fetchConversation(report.conversationId)
    }
  }, [report?.conversationId, convId])

  async function loadData() {
    if (!id) return
    setLoading(true)
    try {
      const [reportData, agentList, boardList] = await Promise.all([
        api.bugReports.get(id),
        api.agents.list(),
        api.boards.list(),
      ])
      setReport(reportData)
      setAgents(agentList)
      setBoards(boardList)
      if (agentList.length > 0 && !triageAgentId) {
        const triageAgent = agentList.find(a => a.name === 'triage-agent')
        setTriageAgentId(triageAgent?.id ?? agentList[0]!.id)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleTriage() {
    if (!id || !triageAgentId) return
    setTriaging(true)
    setError(null)
    try {
      await api.bugReports.triage(id, triageAgentId)
      setTimeout(loadData, 2000)
      setTimeout(loadData, 5000)
      setTimeout(loadData, 10000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTriaging(false)
    }
  }

  async function handleCreateCard() {
    if (!id || !selectedBoard || !selectedColumnId) return
    setCreatingCard(true)
    setError(null)
    try {
      await api.bugReports.createCard(id, selectedBoard.id, selectedColumnId)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreatingCard(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    await api.bugReports.delete(id)
    navigate('/bugs')
  }

  async function handleBoardSelect(boardId: string) {
    if (!boardId) { setSelectedBoard(null); return }
    const board = await api.boards.get(boardId)
    setSelectedBoard(board)
    if (board.columns?.length) setSelectedColumnId(board.columns[0]!.id)
  }

  if (loading) return <div className="p-6 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</div>
  if (!report) return <div className="p-6 text-[var(--color-destructive)]">Bug report not found</div>

  const status = statusConfig[report.status] ?? statusConfig['new']!
  const StatusIcon = status.icon

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Header */}
      <button
        onClick={() => navigate('/bugs')}
        className="mb-4 flex items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:text-[var(--color-muted-dark)] dark:hover:text-[var(--color-ink-dark)] cursor-pointer"
      >
        <ArrowLeft size={14} /> Back to Bug Reports
      </button>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Bug size={20} className="shrink-0 text-[var(--color-destructive)]" />
          <h1 className="text-xl font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] break-words">{report.title}</h1>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete} className="shrink-0">
          <Trash2 size={12} className="mr-1" /> Delete
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-[var(--radius-lg)] bg-[var(--color-destructive)]/10 px-3.5 py-2.5 text-[13px] text-[var(--color-destructive)]">
          {error}
        </div>
      )}

      {/* Meta badges */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Badge variant={statusBadgeVariant[report.status] ?? 'neutral'}>
          <StatusIcon size={12} className="mr-1" />
          {status.label}
        </Badge>
        {report.severity && (
          <Badge variant={severityBadgeVariant[report.severity] ?? 'neutral'}>
            {report.severity}
          </Badge>
        )}
        <Badge variant="neutral">Source: {report.source}</Badge>
        {report.reporterName && (
          <Badge variant="neutral">Reporter: {report.reporterName}</Badge>
        )}
        <Badge variant="neutral">{new Date(report.createdAt).toLocaleString()}</Badge>
      </div>

      {/* Description */}
      <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
        <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Description</h3>
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{report.description}</div>
      </div>

      {/* Attachments */}
      {report.attachments.length > 0 && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            <Paperclip size={14} /> Attachments
          </h3>
          <div className="flex flex-wrap gap-2">
            {report.attachments.map(att => (
              <div key={att.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]">
                {att.filename}
                {att.fileType && (
                  <span className="ml-1.5 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">({att.fileType})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triage Summary */}
      {report.triageSummary && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Triage Summary</h3>
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{report.triageSummary}</div>
        </div>
      )}

      {/* Inline Triage Conversation */}
      {report.conversationId && activeConversation && (
        <div className="mb-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
          <div className="h-[400px]">
            <ConversationView conversation={activeConversation} />
          </div>
        </div>
      )}

      {/* Card link */}
      {report.cardId && (
        <div className="mb-5 flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-4 py-3">
          <CheckCircle2 size={14} className="text-[var(--color-accent)]" />
          <span className="text-[13px] text-[var(--color-accent)]">Bug card created.</span>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/cards/${report.cardId}`)}>
            View Card
          </Button>
        </div>
      )}

      {/* Triage / Retry action */}
      {(report.status === 'new' || report.status === 'rejected' || report.status === 'triaging') && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
          {agents.length === 0 ? (
            <p className="text-[13px] text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              No agents configured. <a href="/agents" className="text-[var(--color-primary)] hover:underline">Create an agent</a> to enable triage.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={triageAgentId}
                onChange={e => setTriageAgentId(e.target.value)}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <Button onClick={handleTriage} disabled={triaging || !triageAgentId} loading={triaging}>
                <AlertTriangle size={14} className="mr-1.5" />
                {report.status === 'triaging' ? 'Retry Triage' : triaging ? 'Triaging...' : 'Start Triage'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Needs info hint — conversation inline handles responses */}
      {report.status === 'needs_info' && !report.conversationId && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-4">
          <p className="text-[13px] text-[var(--color-warning)]">
            The triage agent needs more information. Please respond in the conversation above.
          </p>
        </div>
      )}

      {/* Create card action (triaged) */}
      {report.status === 'triaged' && !report.cardId && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
          <p className="mb-2 text-[13px] text-[var(--color-accent)]">
            Bug triaged successfully. Create a card on a board:
          </p>
          <div className="flex items-center gap-2">
            <select
              value={selectedBoard?.id ?? ''}
              onChange={e => handleBoardSelect(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
            >
              <option value="">Select board...</option>
              {boards.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {selectedBoard?.columns && (
              <select
                value={selectedColumnId}
                onChange={e => setSelectedColumnId(e.target.value)}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
              >
                {selectedBoard.columns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            <Button
              onClick={handleCreateCard}
              disabled={creatingCard || !selectedBoard || !selectedColumnId}
              loading={creatingCard}
              className="bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:opacity-90"
            >
              <Kanban size={14} className="mr-1.5" />
              {creatingCard ? 'Creating...' : 'Create Bug Card'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
