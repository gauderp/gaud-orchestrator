import { useState, useRef } from 'react'
import { HardDrive, Download, Upload, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/store/toast'
import { api } from '@/api/client'

interface ManifestData {
  version: string
  createdAt: string
  appVersion: string
  includesRepos: boolean
  tables: Record<string, number>
  attachmentCount: number
  agentFileCount: number
}

export function BackupPage() {
  const addToast = useToastStore((s) => s.addToast)

  // Export state
  const [includeRepos, setIncludeRepos] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [manifest, setManifest] = useState<ManifestData | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/backup?includeRepos=${includeRepos}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(err.error || 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
      a.click()
      URL.revokeObjectURL(url)
      addToast('success', 'Backup downloaded successfully')
    } catch (err: any) {
      addToast('error', err.message || 'Failed to generate backup')
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file)
    setManifest(null)
    setPreviewing(true)
    try {
      const result = await api.backup.preview(file)
      setManifest(result)
    } catch (err: any) {
      addToast('error', err.message || 'Failed to read backup file')
      setSelectedFile(null)
    } finally {
      setPreviewing(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedFile) return
    setShowConfirm(false)
    setRestoring(true)
    try {
      await api.backup.restore(selectedFile)
      addToast('success', 'Backup restored successfully. Reloading...')
      setTimeout(() => window.location.reload(), 1500)
    } catch (err: any) {
      addToast('error', err.message || 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  const totalRecords = manifest
    ? Object.values(manifest.tables).reduce((sum, n) => sum + n, 0)
    : 0

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HardDrive size={24} className="text-[var(--color-primary)]" />
        <h1 className="text-xl font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
          Backup & Restore
        </h1>
      </div>

      {/* Export Section */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
        <div className="flex items-center gap-2 mb-4">
          <Download size={18} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
          <h2 className="text-base font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Export Backup
          </h2>
        </div>
        <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-4">
          Download a ZIP file containing the full database, agent definitions, and attachments.
          Use this to migrate to another instance or as a safety backup.
        </p>

        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={includeRepos}
            onChange={(e) => setIncludeRepos(e.target.checked)}
            className="rounded border-[var(--color-border)] dark:border-[var(--color-border-dark)]"
          />
          <span className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Include Git repositories
          </span>
          <Badge variant="warning">Large</Badge>
        </label>

        {includeRepos && (
          <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-4 flex items-center gap-1.5">
            <AlertTriangle size={14} />
            Including repos can significantly increase backup size. Repos can be re-cloned later.
          </p>
        )}

        <Button onClick={handleExport} loading={exporting}>
          {exporting ? 'Generating...' : 'Generate Backup'}
        </Button>
      </section>

      {/* Import Section */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
        <div className="flex items-center gap-2 mb-4">
          <Upload size={18} className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]" />
          <h2 className="text-base font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Restore from Backup
          </h2>
        </div>
        <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-4">
          Upload a previously exported backup ZIP to replace all current data.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
          }}
        />

        <Button
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          loading={previewing}
        >
          {previewing ? 'Reading...' : selectedFile ? selectedFile.name : 'Select backup file'}
        </Button>

        {/* Manifest Preview */}
        {manifest && (
          <div className="mt-6 space-y-4">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-elevated-dark)]">
              <h3 className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)] mb-3">
                Backup Contents
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Created</span>
                <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                  {new Date(manifest.createdAt).toLocaleString()}
                </span>
                <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Version</span>
                <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{manifest.appVersion}</span>
                <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Records</span>
                <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{totalRecords.toLocaleString()}</span>
                <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Agent files</span>
                <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{manifest.agentFileCount}</span>
                <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Attachments</span>
                <span className="text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{manifest.attachmentCount}</span>
                <span className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Includes repos</span>
                <span>
                  {manifest.includesRepos ? <Badge variant="info">Yes</Badge> : <Badge variant="neutral">No</Badge>}
                </span>
              </div>
            </div>

            {/* Warning banner */}
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-4">
              <AlertTriangle size={18} className="text-[var(--color-destructive)] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-destructive)]">
                  Destructive operation
                </p>
                <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mt-1">
                  Restoring will permanently replace all existing data including the database, agents, and attachments. This cannot be undone.
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              onClick={() => setShowConfirm(true)}
              loading={restoring}
            >
              {restoring ? 'Restoring...' : 'Restore Backup'}
            </Button>
          </div>
        )}
      </section>

      {/* Confirmation Modal */}
      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Confirm Restore">
        <p className="text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mb-6">
          This will permanently replace all existing data. Are you sure? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleRestore}>
            Yes, restore
          </Button>
        </div>
      </Modal>
    </div>
  )
}
