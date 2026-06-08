import { execFileSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'

const REPOS_DIR = process.env['REPOS_DIR'] ?? join(process.cwd(), 'data', 'repos')

export class GitHubService {
  constructor(private db: Database.Database) {}

  // Check if gh CLI is authenticated
  checkAuth(): { authenticated: boolean; user: string | null; orgs: string[] } {
    try {
      const status = execFileSync('gh', ['auth', 'status'], {
        encoding: 'utf-8', timeout: 10000,
      })
      // Extract username
      const userMatch = status.match(/Logged in to github\.com account (\S+)/)
      const user = userMatch ? userMatch[1] : null

      // Get orgs
      let orgs: string[] = []
      try {
        const orgOutput = execFileSync('gh', ['org', 'list'], {
          encoding: 'utf-8', timeout: 10000,
        })
        orgs = orgOutput.trim().split('\n').filter(Boolean)
      } catch { /* no orgs or permission */ }

      return { authenticated: true, user: user ?? null, orgs }
    } catch {
      return { authenticated: false, user: null, orgs: [] }
    }
  }

  // List repos from a GitHub org or user
  listRemoteRepos(owner: string): Array<{ name: string; fullName: string; description: string; private: boolean }> {
    try {
      const output = execFileSync('gh', [
        'repo', 'list', owner,
        '--json', 'name,nameWithOwner,description,isPrivate',
        '--limit', '100',
      ], { encoding: 'utf-8', timeout: 30000 })
      const repos = JSON.parse(output)
      return repos.map((r: any) => ({
        name: r.name,
        fullName: r.nameWithOwner,
        description: r.description ?? '',
        private: r.isPrivate,
      }))
    } catch (err: any) {
      throw new Error(`Failed to list repos for ${owner}: ${err.message}`)
    }
  }

  // Add a repo to the local registry + clone it
  async addRepo(githubUrl: string, defaultBranch = 'main'): Promise<Record<string, unknown>> {
    // Check if already registered
    const existing = this.db.prepare('SELECT * FROM repositories WHERE github_url = ?').get(githubUrl) as any
    if (existing) {
      // Sync instead
      await this.syncRepo(existing.id)
      return toCamelCase(this.db.prepare('SELECT * FROM repositories WHERE id = ?').get(existing.id) as any)
    }

    const id = randomUUID()
    const localPath = join(REPOS_DIR, ...githubUrl.split('/'))

    this.db.prepare('INSERT INTO repositories (id, github_url, default_branch, local_path, status) VALUES (?, ?, ?, ?, ?)')
      .run(id, githubUrl, defaultBranch, localPath, 'pending')

    // Clone
    await this.cloneRepo(id)

    return toCamelCase(this.db.prepare('SELECT * FROM repositories WHERE id = ?').get(id) as any)
  }

  // Clone a repo
  async cloneRepo(repoId: string): Promise<void> {
    const repo = this.db.prepare('SELECT * FROM repositories WHERE id = ?').get(repoId) as any
    if (!repo) throw new Error('Repository not found')

    const localPath = repo.local_path
    mkdirSync(join(localPath, '..'), { recursive: true })

    try {
      this.db.prepare('UPDATE repositories SET status = ? WHERE id = ?').run('syncing', repoId)

      if (existsSync(join(localPath, '.git'))) {
        // Already cloned, just pull
        execFileSync('git', ['pull', '--ff-only'], { cwd: localPath, encoding: 'utf-8', timeout: 120000 })
      } else {
        // Clone
        execFileSync('gh', ['repo', 'clone', repo.github_url, localPath], {
          encoding: 'utf-8', timeout: 300000,
        })
      }

      this.db.prepare("UPDATE repositories SET status = 'cloned', last_synced_at = datetime('now') WHERE id = ?").run(repoId)
    } catch (err: any) {
      this.db.prepare("UPDATE repositories SET status = 'error' WHERE id = ?").run(repoId)
      throw new Error(`Clone failed: ${err.message}`)
    }
  }

  // Sync (pull latest) a repo
  async syncRepo(repoId: string): Promise<void> {
    const repo = this.db.prepare('SELECT * FROM repositories WHERE id = ?').get(repoId) as any
    if (!repo) throw new Error('Repository not found')
    if (!repo.local_path || !existsSync(join(repo.local_path, '.git'))) {
      return this.cloneRepo(repoId)
    }

    try {
      this.db.prepare('UPDATE repositories SET status = ? WHERE id = ?').run('syncing', repoId)
      execFileSync('git', ['pull', '--ff-only'], { cwd: repo.local_path, encoding: 'utf-8', timeout: 120000 })
      this.db.prepare("UPDATE repositories SET status = 'cloned', last_synced_at = datetime('now') WHERE id = ?").run(repoId)
    } catch (err: any) {
      this.db.prepare("UPDATE repositories SET status = 'error' WHERE id = ?").run(repoId)
      throw new Error(`Sync failed: ${err.message}`)
    }
  }

  // Get resolved local path for a repo (clone if needed)
  async resolveRepoPath(githubUrl: string): Promise<string> {
    const repo = this.db.prepare('SELECT * FROM repositories WHERE github_url = ?').get(githubUrl) as any
    if (!repo) {
      const added = await this.addRepo(githubUrl) as any
      return added.localPath
    }
    if (repo.status !== 'cloned') {
      await this.cloneRepo(repo.id)
    }
    return repo.local_path
  }

  // List registered repos
  listRepos(): Array<Record<string, unknown>> {
    return toCamelCaseArray(this.db.prepare('SELECT * FROM repositories ORDER BY github_url').all() as any[])
  }

  // Remove a repo
  removeRepo(repoId: string): void {
    this.db.prepare('DELETE FROM repositories WHERE id = ?').run(repoId)
    // Don't delete local files — user can do that manually
  }

  // Cleanup orphan worktrees in a repo
  cleanupWorktrees(repoPath: string): number {
    try {
      const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
        cwd: repoPath, encoding: 'utf-8',
      })
      const worktrees = output.split('\n\n').filter(w => w.includes('.worktrees'))
      let cleaned = 0
      for (const wt of worktrees) {
        const pathMatch = wt.match(/worktree (.+)/)
        if (pathMatch?.[1]) {
          try {
            execFileSync('git', ['worktree', 'remove', pathMatch[1], '--force'], {
              cwd: repoPath, encoding: 'utf-8',
            })
            cleaned++
          } catch { /* in use */ }
        }
      }
      return cleaned
    } catch {
      return 0
    }
  }
}
