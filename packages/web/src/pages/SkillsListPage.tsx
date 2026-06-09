import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Edit, Zap, Download } from 'lucide-react'
import { useSkillStore } from '@/store/skills'
import { api } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'

export function SkillsListPage() {
  const { skills, loading, fetchSkills, deleteSkill } = useSkillStore()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importPreview, setImportPreview] = useState<any[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [importError, setImportError] = useState('')

  async function handlePreview() {
    setPreviewing(true); setImportError(''); setImportPreview(null)
    try {
      const result = await api.skills.previewImport(importUrl)
      setImportPreview(result.skills)
    } catch (err: any) { setImportError(err.message) }
    finally { setPreviewing(false) }
  }

  async function handleImport() {
    setImporting(true); setImportError('')
    try {
      await api.skills.importFromGithub(importUrl)
      setImportOpen(false); setImportUrl(''); setImportPreview(null)
      fetchSkills()
    } catch (err: any) { setImportError(err.message) }
    finally { setImporting(false) }
  }

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteSkill(deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Skills</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Download size={16} className="mr-1.5" />
            Import from GitHub
          </Button>
          <Link to="/skills/new">
            <Button>
              <Plus size={16} className="mr-1.5" />
              New Skill
            </Button>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 w-28 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-4 flex-1 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
                <div className="h-4 w-20 rounded bg-[var(--color-border)] dark:bg-[var(--color-border-dark)] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Name</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Description</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Source</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Updated At</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {skills.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Zap size={48} className="mx-auto mb-3 text-[var(--color-border)] dark:text-[var(--color-border-dark)]" />
                    <p className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">No skills yet</p>
                    <p className="mt-1 text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Create your first skill to teach agents new capabilities</p>
                  </td>
                </tr>
              ) : (
                skills.map((skill) => (
                  <tr
                    key={skill.id}
                    className="border-b border-[var(--color-border)] bg-white dark:border-[var(--color-border-dark)] dark:bg-transparent"
                  >
                    <td className="px-4 py-2 font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                      {skill.name}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                      {skill.description || '-'}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={skill.source === 'github' ? 'info' : 'neutral'}>
                        {skill.source ?? 'manual'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                      {new Date(skill.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/skills/${skill.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
                        >
                          <Edit size={14} />
                          Edit
                        </Link>
                        <button
                          onClick={() => setDeleteTarget({ id: skill.id, name: skill.name })}
                          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-destructive)] hover:underline cursor-pointer"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Skill"
        width="sm"
      >
        <div>
          <p className="text-sm text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => { setImportOpen(false); setImportPreview(null); setImportError('') }}
        title="Import Skills from GitHub"
      >
        <div className="space-y-4">
          <Input
            label="GitHub URL"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="github.com/user/repo or github.com/user/repo/tree/main/skills"
          />

          {importError && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-destructive)] p-3 text-sm text-[var(--color-destructive)]">
              {importError}
            </div>
          )}

          {importPreview && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">
                Found {importPreview.length} skill(s):
              </p>
              {importPreview.map((s, i) => (
                <div key={i} className="rounded-[var(--radius-md)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{s.name}</span>
                    <Badge variant={s.exists ? 'warning' : 'success'}>{s.exists ? 'update' : 'new'}</Badge>
                  </div>
                  <p className="text-xs text-[var(--color-muted)] dark:text-[var(--color-muted-dark)] mt-1">{s.description}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setImportOpen(false); setImportPreview(null) }}>
              Cancel
            </Button>
            {!importPreview ? (
              <Button onClick={handlePreview} loading={previewing} disabled={!importUrl.trim()}>
                Preview
              </Button>
            ) : (
              <Button onClick={handleImport} loading={importing}>
                Import {importPreview.length} Skill(s)
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
