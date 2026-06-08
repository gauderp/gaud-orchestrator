import { useState, useEffect } from 'react'
import { RefreshCw, Trash2, Plus, Search, GitBranch, Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Repository } from '@gaud/shared'
import { api } from '@/api/client'

const statusColors: Record<string, { bg: string; text: string }> = {
  cloned: { bg: '#dcfce7', text: '#166534' },
  pending: { bg: '#fef9c3', text: '#854d0e' },
  syncing: { bg: '#dbeafe', text: '#1e40af' },
  error: { bg: '#fecaca', text: '#991b1b' },
}

export function RepositoryListPage() {
  const [repos, setRepos] = useState<Repository[]>([])
  const [auth, setAuth] = useState<{ authenticated: boolean; user: string | null; orgs: string[] } | null>(null)
  const [owner, setOwner] = useState('')
  const [remoteRepos, setRemoteRepos] = useState<Array<{ name: string; fullName: string; description: string; private: boolean }>>([])
  const [browsing, setBrowsing] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [authRes, reposRes] = await Promise.all([
      api.github.auth(),
      api.repositories.list(),
    ])
    setAuth(authRes)
    setRepos(reposRes)
  }

  async function handleBrowse() {
    if (!owner.trim()) return
    setBrowsing(true)
    setError(null)
    try {
      const result = await api.github.listRemoteRepos(owner.trim())
      setRemoteRepos(result)
    } catch (err: any) {
      setError(err.message)
      setRemoteRepos([])
    } finally {
      setBrowsing(false)
    }
  }

  async function handleAdd(githubUrl: string) {
    setAdding(githubUrl)
    setError(null)
    try {
      await api.repositories.add(githubUrl)
      await loadData()
      setRemoteRepos(prev => prev.filter(r => r.fullName !== githubUrl))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAdding(null)
    }
  }

  async function handleManualAdd() {
    if (!manualUrl.trim()) return
    await handleAdd(manualUrl.trim())
    setManualUrl('')
  }

  async function handleSync(id: string) {
    setSyncing(id)
    try {
      await api.repositories.sync(id)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSyncing(null)
    }
  }

  async function handleDelete(id: string) {
    await api.repositories.delete(id)
    await loadData()
  }

  async function handleCleanup(id: string) {
    try {
      const result = await api.repositories.cleanupWorktrees(id)
      setError(null)
      if (result.cleaned > 0) {
        setError(`Cleaned ${result.cleaned} orphan worktree(s)`)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Repositories</h1>

      {/* Auth status */}
      {auth && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '20px',
          background: auth.authenticated ? '#dcfce7' : '#fecaca',
          color: auth.authenticated ? '#166534' : '#991b1b',
          fontSize: '13px', fontWeight: 500,
        }}>
          {auth.authenticated ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {auth.authenticated
            ? `Authenticated as @${auth.user}${auth.orgs.length ? ` — Orgs: ${auth.orgs.join(', ')}` : ''}`
            : 'Not authenticated. Run `gh auth login` to connect GitHub.'}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
          background: '#fef2f2', color: '#991b1b', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      {/* Registered repos */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Registered Repositories</h2>
        {repos.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6b7280' }}>No repositories registered yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {repos.map(repo => {
              const colors = statusColors[repo.status] ?? { bg: '#fef9c3', text: '#854d0e' }
              return (
                <div key={repo.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: '8px',
                  border: '1px solid #e5e7eb', background: '#fff',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GitBranch size={14} style={{ color: '#6b7280', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 500 }}>{repo.githubUrl}</span>
                      <span style={{
                        fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                        background: colors.bg, color: colors.text, fontWeight: 500,
                      }}>{repo.status}</span>
                    </div>
                    {repo.lastSyncedAt && (
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        Last synced: {new Date(repo.lastSyncedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleSync(repo.id)}
                      disabled={syncing === repo.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb',
                        fontSize: '12px', cursor: 'pointer', background: '#f9fafb',
                      }}
                    >
                      <RefreshCw size={12} className={syncing === repo.id ? 'animate-spin' : ''} />
                      Sync
                    </button>
                    <button
                      onClick={() => handleCleanup(repo.id)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #e5e7eb',
                        fontSize: '12px', cursor: 'pointer', background: '#f9fafb',
                      }}
                    >
                      Cleanup
                    </button>
                    <button
                      onClick={() => handleDelete(repo.id)}
                      style={{
                        display: 'flex', alignItems: 'center',
                        padding: '6px 8px', borderRadius: '6px', border: '1px solid #fecaca',
                        cursor: 'pointer', background: '#fff', color: '#dc2626',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Repository */}
      <div>
        <h2 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Add Repository</h2>

        {/* Browse orgs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            value={owner}
            onChange={e => setOwner(e.target.value)}
            placeholder="GitHub org or username"
            onKeyDown={e => e.key === 'Enter' && handleBrowse()}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px',
              border: '1px solid #e5e7eb', fontSize: '13px',
            }}
          />
          <button
            onClick={handleBrowse}
            disabled={browsing || !owner.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '6px', border: '1px solid #e5e7eb',
              fontSize: '13px', cursor: 'pointer', background: '#f9fafb',
            }}
          >
            <Search size={14} />
            {browsing ? 'Browsing...' : 'Browse'}
          </button>
        </div>

        {/* Remote repos list */}
        {remoteRepos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            {remoteRepos.map(r => (
              <div key={r.fullName} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: '6px', border: '1px solid #e5e7eb',
                background: '#fafafa',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {r.private && <Lock size={12} style={{ color: '#6b7280' }} />}
                  <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{r.fullName}</span>
                  {r.description && (
                    <span style={{ fontSize: '12px', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      — {r.description}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleAdd(r.fullName)}
                  disabled={adding === r.fullName}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '6px 12px', borderRadius: '6px',
                    background: '#2563eb', color: '#fff', border: 'none',
                    fontSize: '12px', cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <Plus size={12} />
                  {adding === r.fullName ? 'Adding...' : 'Add'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Manual add */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={manualUrl}
            onChange={e => setManualUrl(e.target.value)}
            placeholder="org/repo (e.g. gauderp/gaud-erp-api)"
            onKeyDown={e => e.key === 'Enter' && handleManualAdd()}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px',
              border: '1px solid #e5e7eb', fontSize: '13px',
            }}
          />
          <button
            onClick={handleManualAdd}
            disabled={!manualUrl.trim() || adding !== null}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '6px',
              background: '#2563eb', color: '#fff', border: 'none',
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
