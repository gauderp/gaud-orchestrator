import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bug, Trash2, RefreshCw, AlertTriangle, CheckCircle2, Paperclip } from 'lucide-react'
import type { BugReportWithAttachments, Agent, CardWithDetails } from '@gaud/shared'
import { TRIAGE_COLUMNS } from '@gaud/shared'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConversationView } from '@/components/conversation/ConversationView'
import { useConversationStore } from '@/store/conversations'

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
  const [card, setCard] = useState<CardWithDetails | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [triageAgentId, setTriageAgentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [triaging, setTriaging] = useState(false)
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
      const [reportData, agentList] = await Promise.all([
        api.bugReports.get(id),
        api.agents.list(),
      ])
      setReport(reportData)
      setAgents(agentList)
      if (agentList.length > 0 && !triageAgentId) {
        const triageAgent = agentList.find(a => a.name === 'triage-agent')
        setTriageAgentId(triageAgent?.id ?? agentList[0]!.id)
      }
      // Fetch the card if one exists
      if (reportData.cardId) {
        const cardData = await api.cards.get(reportData.cardId)
        setCard(cardData)
      } else {
        setCard(null)
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

  async function handleSendToDev() {
    if (!report?.cardId) return
    try {
      await api.cards.sendToDev(report.cardId)
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleSendToSpec() {
    if (!report?.cardId) return
    try {
      await api.cards.sendToSpec(report.cardId)
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleDelete() {
    if (!id) return
    await api.bugReports.delete(id)
    navigate('/bugs')
  }

  if (loading) return <div className="p-6 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</div>
  if (!report) return <div className="p-6 text-[var(--color-destructive)]">Bug report not found</div>

  const columnId = card?.columnId
  const isNew = columnId === TRIAGE_COLUMNS.NEW
  const isInterviewing = columnId === TRIAGE_COLUMNS.INTERVIEWING
  const isTriaged = columnId === TRIAGE_COLUMNS.TRIAGED

  // Derive a human-readable column label for the badge
  const columnLabel = !columnId ? 'New'
    : isNew ? 'New'
    : isInterviewing ? 'Interviewing'
    : isTriaged ? 'Triaged'
    : columnId === TRIAGE_COLUMNS.REJECTED ? 'Rejected'
    : 'In Progress'

  const columnBadgeVariant: 'neutral' | 'warning' | 'success' | 'error' | 'info' =
    isTriaged ? 'success'
    : isInterviewing ? 'warning'
    : columnId === TRIAGE_COLUMNS.REJECTED ? 'error'
    : 'info'

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
        <Badge variant={columnBadgeVariant}>{columnLabel}</Badge>
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

      {/* Conversation — always visible when conversationId exists */}
      {report.conversationId && (
        <div className="mb-5 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
          {/* Conversation header with triage button */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
            <h3 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Conversation</h3>
            {(isNew || columnId === TRIAGE_COLUMNS.REJECTED) && agents.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={triageAgentId}
                  onChange={e => setTriageAgentId(e.target.value)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-2 py-1 text-xs text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <Button size="sm" onClick={handleTriage} disabled={triaging || !triageAgentId} loading={triaging}>
                  <AlertTriangle size={12} className="mr-1" />
                  {columnId === TRIAGE_COLUMNS.REJECTED ? 'Retry Triage' : 'Start Triage'}
                </Button>
              </div>
            )}
            {isInterviewing && (
              <div className="flex items-center gap-2">
                <select
                  value={triageAgentId}
                  onChange={e => setTriageAgentId(e.target.value)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white px-2 py-1 text-xs text-[var(--color-ink)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <Button size="sm" onClick={handleTriage} disabled={triaging || !triageAgentId} loading={triaging}>
                  <RefreshCw size={12} className="mr-1" />
                  Continue Triage
                </Button>
              </div>
            )}
          </div>
          <div className="h-[400px]">
            {activeConversation ? (
              <ConversationView conversation={activeConversation} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center p-6">
                <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                  Add context or click Start Triage to begin AI analysis.
                </p>
              </div>
            )}
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

      {/* Handoff actions — send triaged bug to dev or spec board */}
      {isTriaged && (
        <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
          <h3 className="text-sm font-semibold mb-2 text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Hand off Bug
          </h3>
          <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-3">
            Send this triaged bug to a development or spec board.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSendToDev}>Send to Development</Button>
            <Button variant="ghost" onClick={handleSendToSpec}>Send to Spec</Button>
          </div>
        </div>
      )}
    </div>
  )
}
