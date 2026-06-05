import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { toCamelCase } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'
import { GitManager } from './git-manager.js'
import { SessionManager } from './session-manager.js'
import { AgentMemory } from './memory.js'
import { createEmbeddingRegistry } from './embeddings.js'
import { logCost } from './cost-tracker.js'
import type { ProviderRegistry } from '@gaud/providers'

interface TaskRow {
  id: string
  status: string
  dependsOn: string | null
  title?: string
  description?: string
  agent_id?: string
  execution_id?: string
  branch?: string
  [key: string]: unknown
}

export class ExecutionEngine {
  private db: Database.Database
  private sessionManager: SessionManager
  private providerRegistry: ProviderRegistry
  private memory: AgentMemory

  constructor(db: Database.Database, providerRegistry: ProviderRegistry, maxConcurrent = 3) {
    this.db = db
    this.providerRegistry = providerRegistry
    this.sessionManager = new SessionManager({ maxConcurrent, providerRegistry })
    this.memory = new AgentMemory(db, createEmbeddingRegistry())
    this.setupEventHandlers()
  }

  // --- Static helpers (testable without DB) ---

  static getExecutableTasks(tasks: TaskRow[]): TaskRow[] {
    const doneIds = new Set(tasks.filter(t => t.status === 'done').map(t => t.id))
    return tasks.filter(t => {
      if (t.status !== 'pending') return false
      const deps: string[] = JSON.parse(t.dependsOn ?? '[]')
      return deps.every(depId => doneIds.has(depId))
    })
  }

  static buildTaskPrompt(opts: {
    title: string
    description: string
    branch: string
    specContent?: string
    agentInstructions?: string
    agentSkills?: string[]
    learnings?: string[]
  }): string {
    const sections: string[] = []

    sections.push(`You are executing a specific task. Follow the project harness strictly.

## Your Task

**Title:** ${opts.title}
**Description:** ${opts.description}
**Branch:** ${opts.branch}`)

    if (opts.agentInstructions) {
      sections.push(`## Your Knowledge\n\n${opts.agentInstructions}`)
    }

    if (opts.agentSkills && opts.agentSkills.length > 0) {
      sections.push(`## Your Skills\n\n${opts.agentSkills.join('\n\n')}`)
    }

    if (opts.specContent) {
      sections.push(`## Spec Context\n\n${opts.specContent}`)
    }

    if (opts.learnings && opts.learnings.length > 0) {
      sections.push(`## Previous Learnings\n\n${opts.learnings.map(l => `- ${l}`).join('\n')}`)
    }

    sections.push(`## Rules

1. Follow the project's CLAUDE.md and all installed skills
2. Use TDD when applicable
3. Make atomic commits with clear messages
4. If you encounter something unexpected, output:
   [APPROVAL_NEEDED] Your question here
   Then STOP and wait. Do NOT guess or improvise.
5. Stay strictly within scope — implement only what this task describes
6. Use rtk for git operations when available (token savings)`)

    return sections.join('\n\n')
  }

  // --- Execution lifecycle ---

  async startExecution(executionId: string): Promise<void> {
    const exec = this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any
    if (!exec) throw new Error('Execution not found')
    if (exec.status !== 'planning' && exec.status !== 'executing') {
      throw new Error(`Cannot start execution in status: ${exec.status}`)
    }

    this.db.prepare(`UPDATE executions SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run('executing', executionId)
    broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any))

    await this.scheduleNextTasks(executionId)
  }

  async scheduleNextTasks(executionId: string): Promise<void> {
    const exec = this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any
    if (!exec || exec.status !== 'executing') return

    const tasks = this.db.prepare('SELECT * FROM execution_tasks WHERE execution_id = ?').all(executionId) as TaskRow[]
    const executable = ExecutionEngine.getExecutableTasks(tasks)

    for (const task of executable) {
      if (!this.sessionManager.canSpawn()) break

      const sessionId = `session-${task.id}`

      // Update task status
      this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('running', task.id)
      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any))

      // Resolve agent, spec, repos
      const agent = task.agent_id
        ? this.db.prepare('SELECT * FROM agents WHERE id = ?').get(task.agent_id) as any
        : null
      const spec = exec.spec_id
        ? this.db.prepare('SELECT * FROM specs WHERE id = ?').get(exec.spec_id) as any
        : null
      const card = exec.card_id
        ? this.db.prepare('SELECT * FROM cards WHERE id = ?').get(exec.card_id) as any
        : null
      const repos = card
        ? (this.db.prepare('SELECT repo_path FROM card_repos WHERE card_id = ?').all(exec.card_id) as any[]).map(r => r.repo_path)
        : []
      const skills = agent
        ? (this.db.prepare('SELECT s.content FROM skills s JOIN agent_skills ags ON ags.skill_id = s.id WHERE ags.agent_id = ?').all(agent.id) as any[]).map(s => s.content)
        : []

      // Query learnings from memory
      let learnings: string[] = []
      try {
        const queryText = `${task.title ?? ''} ${task.description ?? ''}`
        const memories = await this.memory.search(queryText, {
          agentId: agent?.id,
          limit: 5,
          minSimilarity: 0.4,
        })
        learnings = memories.map(m => `[${(m as any).type}] ${(m as any).content}`)
      } catch { /* memory search optional */ }

      // Build prompt
      const branch = task.branch ?? GitManager.branchName(task.id, task.title ?? '')
      const prompt = ExecutionEngine.buildTaskPrompt({
        title: task.title ?? '',
        description: task.description ?? '',
        branch,
        specContent: spec?.content,
        agentInstructions: agent?.instructions,
        agentSkills: skills,
        learnings,
      })

      // Create worktree (best effort)
      let cwd = repos[0] ?? process.cwd()
      try {
        cwd = GitManager.createWorktree(cwd, branch)
      } catch {
        // Worktree creation may fail; use repo path directly
      }

      // Update branch in DB
      this.db.prepare('UPDATE execution_tasks SET branch = ? WHERE id = ?').run(branch, task.id)

      // Spawn agent session
      await this.sessionManager.spawn({
        sessionId,
        executionId,
        taskId: task.id,
        agentId: agent?.id ?? 'default',
        providerId: agent?.provider_id ?? 'claude-cli',
        prompt,
        cwd,
        model: agent?.model,
      })
    }

    // Check if all done
    this.checkCompletion(executionId)
  }

  private checkCompletion(executionId: string): void {
    const tasks = this.db.prepare('SELECT * FROM execution_tasks WHERE execution_id = ?').all(executionId) as any[]
    const allDone = tasks.every(t => t.status === 'done' || t.status === 'failed')
    if (allDone && tasks.length > 0) {
      const anyFailed = tasks.some(t => t.status === 'failed')
      this.db.prepare(`UPDATE executions SET status = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(anyFailed ? 'failed' : 'done', executionId)
      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any))

      // Update linked card if exists
      const exec = this.db.prepare('SELECT card_id FROM executions WHERE id = ?').get(executionId) as any
      if (exec?.card_id) {
        broadcast('card:updated', { id: exec.card_id, executionStatus: anyFailed ? 'failed' : 'done' })
      }
    }
  }

  // --- Event handlers ---

  private setupEventHandlers(): void {
    this.sessionManager.on('output', (sessionId: string, event: any) => {
      const task = this.findTaskBySession(sessionId)
      if (!task) return

      // Store log
      this.db.prepare('INSERT INTO execution_logs (id, execution_task_id, content, type) VALUES (?, ?, ?, ?)')
        .run(randomUUID(), task.id, event.content, event.type ?? 'stdout')

      broadcast('execution:task:log', {
        executionId: task.execution_id,
        taskId: task.id,
        content: event.content,
        type: event.type ?? 'stdout',
      })
    })

    this.sessionManager.on('approval', (sessionId: string, question: string) => {
      const task = this.findTaskBySession(sessionId)
      if (!task) return

      // Pause task
      this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('paused', task.id)

      // Create gap
      this.db.prepare('INSERT INTO execution_gaps (id, execution_id, question) VALUES (?, ?, ?)')
        .run(randomUUID(), task.execution_id, question)

      // Update execution status
      this.db.prepare(`UPDATE executions SET status = ?, updated_at = datetime('now') WHERE id = ?`)
        .run('approving', task.execution_id)

      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))
    })

    this.sessionManager.on('cost', (sessionId: string, costData: any) => {
      logCost(this.db, {
        agentId: costData.agentId,
        tokensIn: costData.tokensIn,
        tokensOut: costData.tokensOut,
        costUsd: costData.cost,
        providerId: costData.providerId,
        model: costData.model,
        taskId: sessionId,
      })
    })

    this.sessionManager.on('done', (sessionId: string, _exitCode: number) => {
      const task = this.findTaskBySession(sessionId)
      if (!task) return

      // Mark task done
      this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('done', task.id)

      // Create PR (best effort)
      if (task.branch) {
        const exec = this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any
        const repos = exec?.card_id
          ? (this.db.prepare('SELECT repo_path FROM card_repos WHERE card_id = ?').all(exec.card_id) as any[])
          : []
        const repoPath = repos[0]?.repo_path

        if (repoPath) {
          try {
            GitManager.pushBranch(repoPath, task.branch)
            const prUrl = GitManager.createPR({
              repoPath,
              branch: task.branch,
              title: task.title,
              body: GitManager.prBody({
                title: task.title,
                description: task.description ?? '',
                executionId: task.execution_id,
                taskId: task.id,
              }),
            })
            this.db.prepare('UPDATE execution_tasks SET pr_url = ? WHERE id = ?').run(prUrl, task.id)
          } catch (err) {
            console.error('PR creation failed:', err)
          }
        }

        // Cleanup worktree
        if (repoPath) {
          try { GitManager.removeWorktree(repoPath, task.branch) } catch { /* ignore */ }
        }
      }

      // Store success learning
      this.memory.store({
        agentId: task.agent_id ?? 'system',
        type: 'pattern_success',
        content: `Task "${task.title}" completed successfully`,
        metadata: { executionId: task.execution_id, branch: task.branch },
        tags: ['execution', 'success'],
      }).catch(() => {})

      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))

      // Schedule next wave
      this.scheduleNextTasks(task.execution_id)
    })

    this.sessionManager.on('error', (sessionId: string, err: Error) => {
      const task = this.findTaskBySession(sessionId)
      if (!task) return

      this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('failed', task.id)

      // Store error learning
      this.memory.store({
        agentId: task.agent_id ?? 'system',
        type: 'error_correction',
        content: `Task "${task.title}" failed: ${err.message}`,
        metadata: { executionId: task.execution_id, error: err.message },
        tags: ['execution', 'error'],
      }).catch(() => {})

      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))
      this.scheduleNextTasks(task.execution_id)
    })
  }

  private findTaskBySession(sessionId: string): any | null {
    const tasks = this.db.prepare('SELECT * FROM execution_tasks').all() as any[]
    return tasks.find(t => `session-${t.id}` === sessionId) ?? null
  }

  // --- Public API ---

  cancelExecution(executionId: string): void {
    this.db.prepare(`UPDATE executions SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run('failed', executionId)
    this.sessionManager.killAll()
    broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any))
  }

  async resolveGapAndResume(executionId: string, gapId: string, response: string): Promise<void> {
    this.db.prepare('UPDATE execution_gaps SET response = ?, status = ? WHERE id = ?')
      .run(response, 'resolved', gapId)

    // Check if all gaps resolved
    const pendingGaps = this.db.prepare(
      'SELECT COUNT(*) as c FROM execution_gaps WHERE execution_id = ? AND status = ?'
    ).get(executionId, 'pending') as { c: number }

    if (pendingGaps.c === 0) {
      this.db.prepare(`UPDATE executions SET status = ?, updated_at = datetime('now') WHERE id = ?`)
        .run('executing', executionId)
      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any))
      await this.scheduleNextTasks(executionId)
    }
  }
}
