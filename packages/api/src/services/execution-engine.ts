import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { toCamelCase } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'
import { GitManager } from './git-manager.js'
import { SessionManager } from './session-manager.js'
import { AgentMemory } from './memory.js'
import { createEmbeddingRegistry } from './embeddings.js'
import { logCost } from './cost-tracker.js'
import { DEV_COLUMNS } from '@gaud/shared'
import type { ProviderRegistry } from '@gaud/providers'

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
  }

  // --- Static helpers (testable without DB) ---

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

  /**
   * Execute a card: create run-log entry, move card to In Progress,
   * spawn agent, handle completion.
   */
  async executeCard(cardId: string, agentId?: string): Promise<string> {
    const card = this.db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as any
    if (!card) throw new Error('Card not found')

    // Create execution run-log entry
    const executionId = randomUUID()
    const branch = GitManager.branchName(executionId, card.title ?? '')
    this.db.prepare(
      "INSERT INTO executions (id, card_id, branch, started_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(executionId, cardId, branch)

    // Move card to In Progress
    this.db.prepare("UPDATE cards SET column_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(DEV_COLUMNS.IN_PROGRESS, cardId)
    broadcast('card:moved', { id: cardId, columnId: DEV_COLUMNS.IN_PROGRESS })

    // Resolve agent
    const agent = agentId
      ? this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any
      : this.db.prepare('SELECT * FROM agents LIMIT 1').get() as any

    // Resolve repos
    const cardRepos = (this.db.prepare('SELECT * FROM card_repos WHERE card_id = ?').all(cardId) as any[])
    const repos: string[] = []
    const { GitHubService } = await import('./github.js')
    const githubService = new GitHubService(this.db)
    for (const cr of cardRepos) {
      if (cr.repository_id) {
        const registered = this.db.prepare('SELECT local_path, status FROM repositories WHERE id = ?').get(cr.repository_id) as any
        if (registered?.local_path && registered.status === 'cloned') repos.push(registered.local_path)
      } else if (cr.repo_path) {
        if (cr.repo_path.includes('/') && !cr.repo_path.includes(':') && !cr.repo_path.startsWith('/')) {
          try { repos.push(await githubService.resolveRepoPath(cr.repo_path)) } catch { repos.push(cr.repo_path) }
        } else {
          repos.push(cr.repo_path)
        }
      }
    }

    // Get spec content if card has a parent spec card
    let specContent: string | undefined
    if (card.parent_card_id) {
      const spec = this.db.prepare('SELECT content FROM specs WHERE card_id = ?').get(card.parent_card_id) as any
      specContent = spec?.content
    }

    // Skills and memory
    const skills = agent
      ? (this.db.prepare('SELECT s.content FROM skills s JOIN agent_skills ags ON ags.skill_id = s.id WHERE ags.agent_id = ?').all(agent.id) as any[]).map(s => s.content)
      : []

    let learnings: string[] = []
    try {
      const memories = await this.memory.search(`${card.title ?? ''} ${card.description ?? ''}`, { agentId: agent?.id, limit: 5, minSimilarity: 0.4 })
      learnings = memories.map(m => `[${(m as any).type}] ${(m as any).content}`)
    } catch { /* memory search optional */ }

    // Attachments
    let attachments: Array<{ filename: string; content: string; type: 'text' | 'path' }> = []
    try {
      const { readCardAttachments } = await import('./attachment-reader.js')
      attachments = readCardAttachments(this.db, cardId)
    } catch { /* attachments optional */ }

    // Codebase analysis
    let codebaseAnalysis: string | undefined
    if (repos.length > 0) {
      try {
        const { analyzeCodebase } = await import('./codebase-analyzer.js')
        codebaseAnalysis = (await analyzeCodebase(repos[0]!)).markdown
      } catch { /* optional */ }
    }

    const prompt = ExecutionEngine.buildTaskPrompt({
      title: card.title ?? '',
      description: card.description ?? '',
      branch,
      specContent,
      agentInstructions: agent?.instructions,
      agentSkills: skills,
      learnings,
      attachments,
      codebaseAnalysis,
    })

    // Create worktree
    let cwd = repos[0] ?? process.cwd()
    try { cwd = GitManager.createWorktree(cwd, branch) } catch { /* worktree creation may fail */ }

    // Setup event handlers for this execution
    const sessionId = `exec-${executionId}`

    this.sessionManager.on('cost', (sid: string, costData: any) => {
      if (sid !== sessionId) return
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

    this.sessionManager.on('done', (sid: string) => {
      if (sid !== sessionId) return
      // Success: record outcome, create PR, move to Review
      this.db.prepare("UPDATE executions SET finished_at = datetime('now'), outcome = 'success' WHERE id = ?").run(executionId)
      this.createPR(executionId, cardId, card.title, card.description, branch, repos[0])

      // Move to Review if PR created, Done otherwise
      const exec = this.db.prepare('SELECT pr_url FROM executions WHERE id = ?').get(executionId) as any
      const targetColumn = exec?.pr_url ? DEV_COLUMNS.REVIEW : DEV_COLUMNS.DONE
      this.db.prepare("UPDATE cards SET column_id = ?, updated_at = datetime('now') WHERE id = ?").run(targetColumn, cardId)
      broadcast('card:moved', { id: cardId, columnId: targetColumn })
      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any))

      // Store success learning
      this.memory.store({
        agentId: agent?.id ?? 'system',
        type: 'pattern_success',
        content: `Task "${card.title}" completed successfully`,
        metadata: { executionId, branch },
        tags: ['execution', 'success'],
      }).catch(() => {})
    })

    this.sessionManager.on('error', (sid: string, err: Error) => {
      if (sid !== sessionId) return
      // Failure: record outcome, move card back to To Do
      this.db.prepare("UPDATE executions SET finished_at = datetime('now'), outcome = 'failed' WHERE id = ?").run(executionId)
      this.db.prepare("UPDATE cards SET column_id = ?, updated_at = datetime('now') WHERE id = ?").run(DEV_COLUMNS.TODO, cardId)

      // Add error comment
      this.db.prepare("INSERT INTO card_comments (id, card_id, author_type, author_id, content, created_at) VALUES (?, ?, 'system', 'system', ?, datetime('now'))")
        .run(randomUUID(), cardId, `Execution failed: ${err.message}`)

      broadcast('card:moved', { id: cardId, columnId: DEV_COLUMNS.TODO })
      broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any))

      this.memory.store({
        agentId: agent?.id ?? 'system',
        type: 'error_correction',
        content: `Task "${card.title}" failed: ${err.message}`,
        metadata: { executionId, error: err.message },
        tags: ['execution', 'error'],
      }).catch(() => {})
    })

    // Spawn agent session
    await this.sessionManager.spawn({
      sessionId,
      executionId,
      taskId: cardId,
      agentId: agent?.id ?? 'default',
      providerId: agent?.provider_id ?? 'claude-cli',
      prompt,
      cwd,
      model: agent?.model,
    })

    return executionId
  }

  private createPR(executionId: string, cardId: string, title: string, description: string, branch: string, repoPath?: string): void {
    if (!branch || !repoPath) return
    try {
      GitManager.pushBranch(repoPath, branch)
      const prUrl = GitManager.createPR({
        repoPath,
        branch,
        title,
        body: GitManager.prBody({ title, description: description ?? '', executionId, taskId: cardId }),
      })
      this.db.prepare('UPDATE executions SET pr_url = ? WHERE id = ?').run(prUrl, executionId)
    } catch (err) {
      console.error('PR creation failed:', err)
    }
    try { GitManager.removeWorktree(repoPath, branch) } catch { /* ignore */ }
  }

  cancelExecution(executionId: string): void {
    this.db.prepare("UPDATE executions SET finished_at = datetime('now'), outcome = 'failed' WHERE id = ?").run(executionId)
    this.sessionManager.killAll()
    const exec = this.db.prepare('SELECT card_id FROM executions WHERE id = ?').get(executionId) as any
    if (exec?.card_id) {
      this.db.prepare("UPDATE cards SET column_id = ?, updated_at = datetime('now') WHERE id = ?").run(DEV_COLUMNS.TODO, exec.card_id)
    }
    broadcast('execution:updated', toCamelCase(this.db.prepare('SELECT * FROM executions WHERE id = ?').get(executionId) as any))
  }
}
