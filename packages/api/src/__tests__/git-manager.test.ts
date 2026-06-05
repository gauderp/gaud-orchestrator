import { describe, it, expect } from 'vitest'
import { GitManager } from '../services/git-manager.js'

describe('GitManager', () => {
  it('generates branch name from task', () => {
    const branch = GitManager.branchName('etask-123', 'Build auth endpoint')
    expect(branch).toBe('feature/etask-123-build-auth-endpoint')
  })

  it('sanitizes special characters in branch name', () => {
    const branch = GitManager.branchName('etask-1', 'Fix API (v2) — login')
    expect(branch).toMatch(/^feature\/etask-1-fix-api-v2-login$/)
  })

  it('truncates long branch names to 80 chars', () => {
    const branch = GitManager.branchName('etask-1', 'A'.repeat(100))
    expect(branch.length).toBeLessThanOrEqual(80)
  })

  it('builds worktree path', () => {
    const path = GitManager.worktreePath('/repo', 'feature/etask-1-auth')
    expect(path).toContain('.worktrees')
    expect(path).toContain('feature-etask-1-auth')
  })

  it('builds PR body with execution context', () => {
    const body = GitManager.prBody({
      title: 'Build auth endpoint',
      description: 'POST /auth/login with JWT tokens',
      executionId: 'exec-1',
      taskId: 'etask-1',
    })
    expect(body).toContain('Build auth endpoint')
    expect(body).toContain('POST /auth/login')
    expect(body).toContain('exec-1')
    expect(body).toContain('Gaud Orchestrator')
  })
})
