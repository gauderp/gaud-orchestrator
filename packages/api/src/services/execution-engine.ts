import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { toCamelCase } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'
import { GitManager } from './git-manager.js'
import { SessionManager } from './session-manager.js'
import { AgentMemory } from './memory.js'
import { createEmbeddingRegistry } from './embeddings.js'
import { logCost } from './cost-tracker.js'
import { HierarchyService } from './hierarchy.js'
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
    attachments?: Array<{ filename: string; content: string; type: 'text' | 'path' }>
    codebaseAnalysis?: string
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

    if (opts.codebaseAnalysis) {
      sections.push(`## Codebase Analysis\n\n${opts.codebaseAnalysis}`)
    }

    if (opts.learnings && opts.learnings.length > 0) {
      sections.push(`## Previous Learnings\n\n${opts.learnings.map(l => `- ${l}`).join('\n')}`)
    }

    if (opts.attachments && opts.attachments.length > 0) {
      const attachmentSections = opts.attachments.map(a => {
        if (a.type === 'text') {
          return `### ${a.filename}\n\`\`\`\n${a.content}\n\`\`\``
        }
        return `### ${a.filename}\n[File available at: ${a.content}]`
      }).join('\n\n')
      sections.push(`## Card Attachments\n\n${attachmentSections}`)
    }

    sections.push(`## Rules

1. Follow the project's CLAUDE.md and all installed skills
2. Use TDD when applicable
3. Make atomic commits with clear messages
4. If you encounter something unexpected, output:
   [APPROVAL_NEEDED] Your question here
   Then STOP and wait. Do NOT guess or improvise.
5. Stay strictly within scope — implement only what this task describes
6. Git operations: rtk (token-saving proxy) is available. Git commands will automatically be routed through rtk via Claude Code hooks. No action needed.`)

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
      // Resolve repo paths — support both local paths and GitHub URLs
      const cardRepos = card
        ? (this.db.prepare('SELECT * FROM card_repos WHERE card_id = ?').all(exec.card_id) as any[])
        : []
      const repos: string[] = []
      const { GitHubService } = await import('./github.js')
      const githubService = new GitHubService(this.db)
      for (const cr of cardRepos) {
        if (cr.repository_id) {
          const registered = this.db.prepare('SELECT local_path, status FROM repositories WHERE id = ?').get(cr.repository_id) as any
          if (registered?.local_path && registered.status === 'cloned') {
            repos.push(registered.local_path)
          }
        } else if (cr.repo_path) {
          if (cr.repo_path.includes('/') && !cr.repo_path.includes(':') && !cr.repo_path.startsWith('/')) {
            try {
              const path = await githubService.resolveRepoPath(cr.repo_path)
              repos.push(path)
            } catch {
              repos.push(cr.repo_path)
            }
          } else {
            repos.push(cr.repo_path)
          }
        }
      }
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

      // Read card attachments
      let attachments: Array<{ filename: string; content: string; type: 'text' | 'path' }> = []
      if (exec.card_id) {
        try {
          const { readCardAttachments } = await import('./attachment-reader.js')
          attachments = readCardAttachments(this.db, exec.card_id)
        } catch { /* attachments optional */ }
      }

      // Analyze codebase for context
      let codebaseAnalysis: string | undefined
      if (repos.length > 0) {
        try {
          const { analyzeCodebase } = await import('./codebase-analyzer.js')
          const analysis = await analyzeCodebase(repos[0]!)
          codebaseAnalysis = analysis.markdown
        } catch { /* optional */ }
      }

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
        attachments,
        codebaseAnalysis,
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

      // Check if agent requires parent approval before PR creation
      const hierarchy = new HierarchyService(this.db)
      const agentId = task.agent_id

      if (agentId && hierarchy.requiresApproval(agentId)) {
        const parent = hierarchy.getParent(agentId)
        if (parent) {
          const review = hierarchy.createReview({
            executionTaskId: task.id,
            reviewerAgentId: parent.id as string,
            revieweeAgentId: agentId,
          })

          // Create review conversation
          const convId = randomUUID()
          const now = new Date().toISOString()
          const exec = this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any
          this.db.prepare('INSERT INTO conversations (id, card_id, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run(convId, exec?.card_id ?? null, 'review', now, now)
          this.db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)')
            .run(convId, parent.id as string)

          // Seed with task output for review
          const taskLogs = this.db.prepare(
            'SELECT content FROM execution_logs WHERE execution_task_id = ? AND type = ? ORDER BY created_at'
          ).all(task.id, 'stdout') as any[]
          const taskOutput = taskLogs.map((l: any) => l.content).join('').slice(-3000)

          const reviewPrompt = `Review the following work by ${task.agent_id || 'an agent'} on task "${task.title}".

## Task Description
${task.description || 'No description'}

## Agent Output (last 3000 chars)
${taskOutput || 'No output captured'}

## Your Job
As the supervisor, review this work:
1. Does it fulfill the task requirements?
2. Are there bugs, security issues, or quality problems?
3. Is the approach correct?

Respond with one of:
- [APPROVED] if the work is good — include brief comment
- [CHANGES_REQUESTED] if changes are needed — list specific issues
- [REJECTED] if the approach is fundamentally wrong — explain why`

          this.db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
            .run(randomUUID(), convId, 'system', reviewPrompt, 'content')

          // Update review with conversation
          this.db.prepare('UPDATE agent_reviews SET conversation_id = ? WHERE id = ?')
            .run(convId, (review as any).id)

          // Mark task as paused pending review
          this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('paused', task.id)

          broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))
          broadcast('agent:review', { reviewId: (review as any).id, taskId: task.id, reviewerAgentId: parent.id })

          // Trigger the review conversation turn
          if (this.providerRegistry) {
            import('./conversation-runner.js').then(async ({ runConversationTurn }) => {
              try {
                const result = await runConversationTurn(this.db, convId, this.providerRegistry)
                const reviewResponse = result.message?.content ?? ''

                if (reviewResponse.includes('[APPROVED]')) {
                  hierarchy.resolveReview((review as any).id, 'approved', reviewResponse)
                  this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('done', task.id)
                  this.createPR(task)
                } else if (reviewResponse.includes('[CHANGES_REQUESTED]')) {
                  hierarchy.resolveReview((review as any).id, 'changes_requested', reviewResponse)
                  broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))
                  return
                } else if (reviewResponse.includes('[REJECTED]')) {
                  hierarchy.resolveReview((review as any).id, 'rejected', reviewResponse)
                  this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('failed', task.id)
                  broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))
                  return
                } else {
                  // No clear verdict — approve by default
                  hierarchy.resolveReview((review as any).id, 'approved', reviewResponse)
                  this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('done', task.id)
                  this.createPR(task)
                }
              } catch (err) {
                console.error('Supervisor review failed:', err)
                this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('done', task.id)
                this.createPR(task)
              }

              this.storeSuccessLearning(task)
              broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))
              this.scheduleNextTasks(task.execution_id)
            }).catch(() => {
              // Fallback: proceed without review
              this.db.prepare('UPDATE execution_tasks SET status = ? WHERE id = ?').run('done', task.id)
              this.createPR(task)
              this.storeSuccessLearning(task)
              broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))
              this.scheduleNextTasks(task.execution_id)
            })
            return // Don't continue synchronously — async review handles the rest
          }
        }
      }

      // No parent approval needed — proceed normally
      this.createPR(task)
      this.storeSuccessLearning(task)
      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(task.execution_id) as any))
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

  private createPR(task: any): void {
    if (!task.branch) return
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

      // Cleanup worktree
      try { GitManager.removeWorktree(repoPath, task.branch) } catch { /* ignore */ }
    }
  }

  private storeSuccessLearning(task: any): void {
    this.memory.store({
      agentId: task.agent_id ?? 'system',
      type: 'pattern_success',
      content: `Task "${task.title}" completed successfully`,
      metadata: { executionId: task.execution_id, branch: task.branch },
      tags: ['execution', 'success'],
    }).catch(() => {})
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
