import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import { api } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface BugReportFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function BugReportForm({ onSuccess, onCancel }: BugReportFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/5 px-3.5 py-2.5 mb-4 text-sm text-[var(--color-destructive)]">
          {error}
        </div>
      )}
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
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="destructive" size="sm" loading={submitting} disabled={!title.trim() || !description.trim()}>Submit Report</Button>
        </div>
      </div>
    </form>
  )
}
