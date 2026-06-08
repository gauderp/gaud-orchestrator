import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Bug, Send, Kanban, Trash2, RefreshCw, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Clock, Paperclip } from 'lucide-react'
import type { BugReportWithAttachments, Agent, Board, BoardWithColumns } from '@gaud/shared'
import { api } from '@/api/client'

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  new: { label: 'New', bg: '#dbeafe', text: '#1e40af', icon: Clock },
  triaging: { label: 'Triaging...', bg: '#fef9c3', text: '#854d0e', icon: RefreshCw },
  needs_info: { label: 'Needs Info', bg: '#fef3c7', text: '#92400e', icon: HelpCircle },
  triaged: { label: 'Triaged', bg: '#dcfce7', text: '#166534', icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: '#fecaca', text: '#991b1b', icon: XCircle },
}

const severityConfig: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#fecaca', text: '#991b1b' },
  high: { bg: '#fed7aa', text: '#9a3412' },
  medium: { bg: '#fef9c3', text: '#854d0e' },
  low: { bg: '#e0e7ff', text: '#3730a3' },
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
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(true)
  const [triaging, setTriaging] = useState(false)
  const [responding, setResponding] = useState(false)
  const [creatingCard, setCreatingCard] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [id])

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
      // Poll for update
      setTimeout(loadData, 2000)
      setTimeout(loadData, 5000)
      setTimeout(loadData, 10000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTriaging(false)
    }
  }

  async function handleRespond() {
    if (!id || !response.trim()) return
    setResponding(true)
    setError(null)
    try {
      await api.bugReports.respond(id, response)
      setResponse('')
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResponding(false)
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

  if (loading) return <div style={{ padding: '24px', color: '#6b7280' }}>Loading...</div>
  if (!report) return <div style={{ padding: '24px', color: '#991b1b' }}>Bug report not found</div>

  const status = (statusConfig[report.status] ?? statusConfig['new'])!
  const severity = report.severity ? severityConfig[report.severity]! : null
  const StatusIcon = status.icon

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <button
        onClick={() => navigate('/bugs')}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0', border: 'none', background: 'none',
          fontSize: '13px', color: '#6b7280', cursor: 'pointer', marginBottom: '16px',
        }}
      >
        <ArrowLeft size={14} /> Back to Bug Reports
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bug size={20} style={{ color: '#dc2626' }} />
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>{report.title}</h1>
        </div>
        <button
          onClick={handleDelete}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '6px 10px', borderRadius: '6px', border: '1px solid #fecaca',
            cursor: 'pointer', background: '#fff', color: '#dc2626', fontSize: '12px',
          }}
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
          background: '#fef2f2', color: '#991b1b', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      {/* Meta */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '12px', padding: '4px 10px', borderRadius: '4px',
          background: status.bg, color: status.text, fontWeight: 500,
        }}>
          <StatusIcon size={12} /> {status.label}
        </span>
        {severity && (
          <span style={{
            fontSize: '12px', padding: '4px 10px', borderRadius: '4px',
            background: severity.bg, color: severity.text, fontWeight: 500,
          }}>
            {report.severity}
          </span>
        )}
        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px', background: '#f3f4f6', color: '#6b7280' }}>
          Source: {report.source}
        </span>
        {report.reporterName && (
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px', background: '#f3f4f6', color: '#6b7280' }}>
            Reporter: {report.reporterName}
          </span>
        )}
        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '4px', background: '#f3f4f6', color: '#6b7280' }}>
          {new Date(report.createdAt).toLocaleString()}
        </span>
      </div>

      {/* Description */}
      <div style={{
        padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb',
        background: '#fff', marginBottom: '20px',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Description</h3>
        <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{report.description}</div>
      </div>

      {/* Attachments */}
      {report.attachments.length > 0 && (
        <div style={{
          padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb',
          background: '#fff', marginBottom: '20px',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Paperclip size={14} /> Attachments
          </h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {report.attachments.map(att => (
              <div key={att.id} style={{
                padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb',
                fontSize: '12px', color: '#374151', background: '#f9fafb',
              }}>
                {att.filename}
                {att.fileType && (
                  <span style={{ marginLeft: '6px', color: '#9ca3af' }}>({att.fileType})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triage Summary */}
      {report.triageSummary && (
        <div style={{
          padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb',
          background: '#f0fdf4', marginBottom: '20px',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Triage Summary</h3>
          <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{report.triageSummary}</div>
        </div>
      )}

      {/* Conversation link */}
      {report.conversationId && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => navigate(`/conversations/${report.conversationId}`)}
            style={{
              padding: '8px 14px', borderRadius: '6px', border: '1px solid #e5e7eb',
              fontSize: '13px', cursor: 'pointer', background: '#f9fafb', color: '#374151',
            }}
          >
            View Triage Conversation
          </button>
        </div>
      )}

      {/* Card link */}
      {report.cardId && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', border: '1px solid #dcfce7',
          background: '#f0fdf4', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <CheckCircle2 size={14} style={{ color: '#166534' }} />
          <span style={{ fontSize: '13px', color: '#166534' }}>Bug card created.</span>
          <button
            onClick={() => navigate(`/cards/${report.cardId}`)}
            style={{
              padding: '4px 10px', borderRadius: '4px', border: '1px solid #bbf7d0',
              fontSize: '12px', cursor: 'pointer', background: '#fff', color: '#166534',
            }}
          >
            View Card
          </button>
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: '16px', borderRadius: '8px', border: '1px solid #e5e7eb',
        background: '#fff',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Actions</h3>

        {/* Triage action */}
        {(report.status === 'new' || report.status === 'rejected') && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
            <select
              value={triageAgentId}
              onChange={e => setTriageAgentId(e.target.value)}
              style={{
                padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb',
                fontSize: '13px', background: '#fff',
              }}
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button
              onClick={handleTriage}
              disabled={triaging || !triageAgentId}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '6px', border: 'none',
                background: '#2563eb', color: '#fff', fontSize: '13px',
                cursor: 'pointer', fontWeight: 500,
                opacity: triaging ? 0.5 : 1,
              }}
            >
              <AlertTriangle size={14} />
              {triaging ? 'Triaging...' : 'Start Triage'}
            </button>
          </div>
        )}

        {/* Respond action (needs_info) */}
        {report.status === 'needs_info' && (
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', color: '#92400e', marginBottom: '8px' }}>
              The triage agent needs more information. Please respond below:
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Provide additional information..."
                rows={3}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid #e5e7eb', fontSize: '13px', resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleRespond}
                disabled={responding || !response.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '6px', border: 'none',
                  background: '#2563eb', color: '#fff', fontSize: '13px',
                  cursor: 'pointer', alignSelf: 'flex-end',
                  opacity: responding || !response.trim() ? 0.5 : 1,
                }}
              >
                <Send size={14} />
                {responding ? 'Sending...' : 'Respond'}
              </button>
            </div>
          </div>
        )}

        {/* Create card action (triaged) */}
        {report.status === 'triaged' && !report.cardId && (
          <div>
            <p style={{ fontSize: '13px', color: '#166534', marginBottom: '8px' }}>
              Bug triaged successfully. Create a card on a board:
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                value={selectedBoard?.id ?? ''}
                onChange={e => handleBoardSelect(e.target.value)}
                style={{
                  padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb',
                  fontSize: '13px', background: '#fff',
                }}
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
                  style={{
                    padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb',
                    fontSize: '13px', background: '#fff',
                  }}
                >
                  {selectedBoard.columns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleCreateCard}
                disabled={creatingCard || !selectedBoard || !selectedColumnId}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '6px', border: 'none',
                  background: '#16a34a', color: '#fff', fontSize: '13px',
                  cursor: 'pointer', fontWeight: 500,
                  opacity: creatingCard || !selectedBoard || !selectedColumnId ? 0.5 : 1,
                }}
              >
                <Kanban size={14} />
                {creatingCard ? 'Creating...' : 'Create Bug Card'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
