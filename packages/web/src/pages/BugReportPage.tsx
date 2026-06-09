import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, Plus, Upload, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Clock, Kanban, List } from 'lucide-react'
import type { BugReport, Board } from '@gaud/shared'
import { api } from '@/api/client'
import { useBoardStore } from '@/store/boards'
import { KanbanBoard } from '@/components/kanban/KanbanBoard'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const statusConfig: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'error' | 'neutral'; icon: any }> = {
  new: { label: 'New', variant: 'info', icon: Clock },
  triaging: { label: 'Triaging', variant: 'warning', icon: Clock },
  needs_info: { label: 'Needs Info', variant: 'warning', icon: HelpCircle },
  triaged: { label: 'Triaged', variant: 'success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', variant: 'error', icon: XCircle },
}

const severityConfig: Record<string, { variant: 'error' | 'warning' | 'info' | 'neutral' }> = {
  critical: { variant: 'error' },
  high: { variant: 'warning' },
  medium: { variant: 'warning' },
  low: { variant: 'info' },
}

type ViewMode = 'board' | 'list'

export function BugReportPage() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [view, setView] = useState<ViewMode>('board')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bugBoardId, setBugBoardId] = useState<string | null>(null)
  const navigate = useNavigate()

  const { activeBoard, cards, fetchBoard, fetchCards, moveCard } = useBoardStore()

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadReports()
    // Find Bug Triage board
    api.boards.list().then((boards: Board[]) => {
      const bugBoard = boards.find(b => b.name === 'Bug Triage')
      if (bugBoard) {
        setBugBoardId(bugBoard.id)
        fetchBoard(bugBoard.id)
        fetchCards(bugBoard.id)
      }
    })
  }, [])

  async function loadReports() {
    try {
      setReports(await api.bugReports.list())
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !description.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('description', description)
      for (const file of files) {
        formData.append('files', file)
      }
      await api.bugReports.create(formData)
      setTitle('')
      setDescription('')
      setFiles([])
      setShowForm(false)
      await loadReports()
      if (bugBoardId) fetchCards(bugBoardId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMove(cardId: string, columnId: string, position: number) {
    await moveCard(cardId, columnId, position)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <Bug size={20} className="text-[var(--color-destructive)]" />
          <h1 className="text-xl font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Bug Reports</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] overflow-hidden">
            <button
              onClick={() => setView('board')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                view === 'board'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-white text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-muted-dark)]'
              }`}
            >
              <Kanban size={13} /> Board
            </button>
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                view === 'list'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-white text-[var(--color-muted)] hover:text-[var(--color-ink)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-muted-dark)]'
              }`}
            >
              <List size={13} /> List
            </button>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm" variant="destructive">
            <Plus size={14} className="mr-1.5" />
            Report Bug
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-6 rounded-[var(--radius-md)] border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/5 px-3.5 py-2.5 mb-4 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}

      {/* Submit Form */}
      {showForm && (
        <div className="mx-6 mb-4">
          <form onSubmit={handleSubmit} className="rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-white dark:bg-[var(--color-surface-dark)] p-5">
            <h2 className="text-sm font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-4">New Bug Report</h2>
            <div className="flex flex-col gap-3">
              <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief summary of the bug" required />
              <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="What happened? What did you expect? Steps to reproduce..." required rows={6} className="min-h-[100px]" />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Attachments</span>
                <input ref={fileInputRef} type="file" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-dark)] px-3.5 py-2 text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] cursor-pointer hover:border-[var(--color-muted)] dark:hover:border-[var(--color-muted-dark)]">
                  <Upload size={14} /> Upload screenshots, logs, videos...
                </button>
                {files.length > 0 && (
                  <div className="mt-2 flex gap-1.5 flex-wrap">{files.map((f, i) => <Badge key={i} variant="neutral">{f.name}</Badge>)}</div>
                )}
              </div>
              <div className="flex gap-2 justify-end mt-1">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" variant="destructive" size="sm" loading={submitting} disabled={!title.trim() || !description.trim()}>Submit Report</Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Board View */}
      {view === 'board' && (
        <div className="flex-1 overflow-hidden">
          {activeBoard ? (
            <KanbanBoard
              columns={activeBoard.columns}
              cards={cards}
              agents={[]}
              onMoveCard={handleMove}
              onAddCard={() => setShowForm(true)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
              No Bug Triage board found. Create one in Boards.
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {reports.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] text-center py-10">
              No bug reports yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {reports.map(report => {
                const status = statusConfig[report.status] ?? statusConfig['new']!
                const severity = report.severity ? severityConfig[report.severity] : null
                const StatusIcon = status.icon
                return (
                  <div
                    key={report.id}
                    onClick={() => navigate(`/bugs/${report.id}`)}
                    className="flex items-center justify-between px-4 py-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-white dark:bg-[var(--color-surface-dark)] cursor-pointer transition-colors hover:border-[var(--color-muted)] dark:hover:border-[var(--color-muted-dark)]"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-[var(--color-destructive)] shrink-0" />
                        <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] truncate">{report.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                        {report.reporterName && <span>{report.reporterName}</span>}
                        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        {report.source !== 'ui' && <Badge variant="neutral">{report.source}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {severity && <Badge variant={severity.variant}>{report.severity}</Badge>}
                      <Badge variant={status.variant}>
                        <StatusIcon size={12} className="mr-1" />{status.label}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
