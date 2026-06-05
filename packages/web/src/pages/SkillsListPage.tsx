import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Edit } from 'lucide-react'
import { useSkillStore } from '@/store/skills'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

export function SkillsListPage() {
  const { skills, loading, fetchSkills, deleteSkill } = useSkillStore()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Skills</h1>
        <Link to="/skills/new">
          <Button>
            <Plus size={16} className="mr-1.5" />
            New Skill
          </Button>
        </Link>
      </div>

      {loading && <p className="text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Loading...</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-border-dark)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Name</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Description</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Updated At</th>
                <th className="px-4 py-2 text-left font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {skills.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                    No skills yet. Create your first skill to get started.
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
    </div>
  )
}
