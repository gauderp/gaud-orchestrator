import { useEffect, useState, useCallback } from 'react'
import { request } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import type { User } from '@gaud/shared'

const ROLE_VARIANT: Record<string, 'info' | 'neutral'> = {
  admin: 'info',
  editor: 'neutral',
  viewer: 'neutral',
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<User | null>(null)

  // Create form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>('editor')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Reset password form
  const [newPassword, setNewPassword] = useState('')

  const fetchUsers = useCallback(async () => {
    const data = await request<User[]>('/users')
    setUsers(data)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await request('/users', { method: 'POST', body: JSON.stringify({ name, email, password, role }) })
      setShowCreate(false)
      setName(''); setEmail(''); setPassword(''); setRole('editor')
      fetchUsers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setError('')
    setLoading(true)
    try {
      await request(`/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editUser.name, email: editUser.email, role: editUser.role }),
      })
      setEditUser(null)
      fetchUsers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(user: User) {
    if (user.active) {
      await request(`/users/${user.id}`, { method: 'DELETE' })
    } else {
      await request(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ active: 1 }) })
    }
    fetchUsers()
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetUser) return
    setError('')
    setLoading(true)
    try {
      await request(`/users/${resetUser.id}/password`, { method: 'PUT', body: JSON.stringify({ password: newPassword }) })
      setResetUser(null)
      setNewPassword('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setName(''); setEmail(''); setPassword(''); setRole('editor'); setError('')
    setShowCreate(true)
  }

  function ErrorBanner({ message }: { message: string }) {
    if (!message) return null
    return (
      <div className="mb-3 rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
        {message}
      </div>
    )
  }

  function RoleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Role</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full appearance-none rounded-md border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)] dark:text-[var(--color-ink-dark)]"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">Users</h1>
        <Button onClick={openCreate}>Add User</Button>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white dark:border-[var(--color-border-dark)] dark:bg-[var(--color-surface-dark)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] dark:border-[var(--color-border-dark)] bg-[var(--color-surface)] dark:bg-[var(--color-surface-elevated-dark)]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Email</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Status</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">
                  No users yet.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="border-b border-[var(--color-border)] last:border-0 dark:border-[var(--color-border-dark)]">
                <td className="px-4 py-2.5 font-medium text-[var(--color-ink)] dark:text-[var(--color-ink-dark)]">{user.name}</td>
                <td className="px-4 py-2.5 text-[var(--color-muted)] dark:text-[var(--color-muted-dark)]">{user.email}</td>
                <td className="px-4 py-2.5"><Badge variant={ROLE_VARIANT[user.role] ?? 'neutral'}>{user.role}</Badge></td>
                <td className="px-4 py-2.5">
                  <Badge variant={user.active ? 'success' : 'neutral'}>{user.active ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditUser({ ...user }); setError('') }}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setResetUser(user); setNewPassword(''); setError('') }}>Reset PW</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(user)}>
                      {user.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add User">
        <form onSubmit={handleCreate} className="flex flex-col gap-3.5">
          <ErrorBanner message={error} />
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name" />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="user@company.com" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required helper="At least 8 characters" />
          <RoleSelect value={role} onChange={setRole} />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <form onSubmit={handleUpdate} className="flex flex-col gap-3.5">
            <ErrorBanner message={error} />
            <Input label="Name" value={editUser.name} onChange={(e) => setEditUser({ ...editUser, name: e.target.value })} required />
            <Input label="Email" type="email" value={editUser.email} onChange={(e) => setEditUser({ ...editUser, email: e.target.value })} required />
            <RoleSelect value={editUser.role} onChange={(v) => setEditUser({ ...editUser, role: v as any })} />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" loading={loading}>Save</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetUser} onClose={() => setResetUser(null)} title={`Reset Password — ${resetUser?.name ?? ''}`}>
        <form onSubmit={handleResetPassword} className="flex flex-col gap-3.5">
          <ErrorBanner message={error} />
          <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required helper="At least 8 characters" />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button type="submit" loading={loading}>Reset Password</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
