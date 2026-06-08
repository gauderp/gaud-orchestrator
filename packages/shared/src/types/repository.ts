export type RepositoryStatus = 'pending' | 'cloned' | 'syncing' | 'error'

export interface Repository {
  id: string
  githubUrl: string
  defaultBranch: string
  localPath: string | null
  lastSyncedAt: string | null
  status: RepositoryStatus
  createdAt: string
}
