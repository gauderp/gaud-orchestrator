import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bug, Plus, Upload, AlertTriangle, CheckCircle2, HelpCircle, XCircle, Clock } from 'lucide-react'
import type { BugReport } from '@gaud/shared'
import { api } from '@/api/client'

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  new: { label: 'New', bg: '#dbeafe', text: '#1e40af', icon: Clock },
  triaging: { label: 'Triaging', bg: '#fef9c3', text: '#854d0e', icon: Clock },
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

type TabStatus = 'all' | 'new' | 'needs_info' | 'triaged' | 'rejected'

export function BugReportPage() {
  const [reports, setReports] = useState<BugReport[]>([])
  const [tab, setTab] = useState<TabStatus>('all')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadReports() }, [tab])

  async function loadReports() {
    try {
      const result = await api.bugReports.list(tab === 'all' ? undefined : tab)
      setReports(result)
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
      if (reporterName) formData.append('reporterName', reporterName)
      if (reporterEmail) formData.append('reporterEmail', reporterEmail)
      for (const file of files) {
        formData.append('files', file)
      }
      await api.bugReports.create(formData)
      setTitle('')
      setDescription('')
      setReporterName('')
      setReporterEmail('')
      setFiles([])
      setShowForm(false)
      await loadReports()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const tabs: { key: TabStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'needs_info', label: 'Needs Info' },
    { key: 'triaged', label: 'Triaged' },
    { key: 'rejected', label: 'Rejected' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Bug size={20} style={{ color: '#dc2626' }} />
          <h1 style={{ fontSize: '20px', fontWeight: 600 }}>Bug Reports</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '6px',
            background: '#dc2626', color: '#fff', border: 'none',
            fontSize: '13px', cursor: 'pointer', fontWeight: 500,
          }}
        >
          <Plus size={14} />
          Report Bug
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

      {/* Submit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{
          padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb',
          background: '#fff', marginBottom: '24px',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>New Bug Report</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Brief summary of the bug"
                required
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Description *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What happened? What did you expect? Steps to reproduce..."
                required
                rows={6}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '6px',
                  border: '1px solid #e5e7eb', fontSize: '13px', resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Reporter Name</label>
                <input
                  value={reporterName}
                  onChange={e => setReporterName(e.target.value)}
                  placeholder="Your name"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Reporter Email</label>
                <input
                  value={reporterEmail}
                  onChange={e => setReporterEmail(e.target.value)}
                  placeholder="your@email.com"
                  type="email"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid #e5e7eb', fontSize: '13px', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Attachments</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={e => setFiles(Array.from(e.target.files ?? []))}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '6px', border: '1px dashed #d1d5db',
                  background: '#f9fafb', fontSize: '13px', cursor: 'pointer', color: '#6b7280',
                }}
              >
                <Upload size={14} />
                Upload screenshots, logs, videos...
              </button>
              {files.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {files.map((f, i) => (
                    <span key={i} style={{
                      fontSize: '12px', padding: '4px 8px', borderRadius: '4px',
                      background: '#f3f4f6', color: '#374151',
                    }}>
                      {f.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  padding: '8px 14px', borderRadius: '6px', border: '1px solid #e5e7eb',
                  fontSize: '13px', cursor: 'pointer', background: '#fff',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim() || !description.trim()}
                style={{
                  padding: '8px 18px', borderRadius: '6px', border: 'none',
                  background: '#dc2626', color: '#fff', fontSize: '13px',
                  cursor: 'pointer', fontWeight: 500,
                  opacity: submitting || !title.trim() || !description.trim() ? 0.5 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', fontSize: '13px', cursor: 'pointer',
              border: 'none', background: 'none', fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#dc2626' : '#6b7280',
              borderBottom: tab === t.key ? '2px solid #dc2626' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Report List */}
      {reports.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>
          No bug reports{tab !== 'all' ? ` with status "${tab}"` : ''}.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reports.map(report => {
            const status = (statusConfig[report.status] ?? statusConfig['new'])!
            const severity = report.severity ? severityConfig[report.severity]! : null
            const StatusIcon = status.icon
            return (
              <div
                key={report.id}
                onClick={() => navigate(`/bugs/${report.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: '8px',
                  border: '1px solid #e5e7eb', background: '#fff',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#d1d5db')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e7eb')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {report.title}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#9ca3af' }}>
                    {report.reporterName && <span>{report.reporterName}</span>}
                    <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    {report.source !== 'ui' && (
                      <span style={{
                        fontSize: '11px', padding: '1px 5px', borderRadius: '3px',
                        background: '#f3f4f6', color: '#6b7280',
                      }}>
                        {report.source}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {severity && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                      background: severity.bg, color: severity.text, fontWeight: 500,
                    }}>
                      {report.severity}
                    </span>
                  )}
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                    background: status.bg, color: status.text, fontWeight: 500,
                  }}>
                    <StatusIcon size={12} />
                    {status.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
