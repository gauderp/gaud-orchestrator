import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'

interface TreeNode {
  agent: Record<string, unknown>
  children: TreeNode[]
}

export class HierarchyService {
  constructor(private db: Database.Database) {}

  getParent(agentId: string): Record<string, unknown> | null {
    const agent = this.db.prepare('SELECT parent_agent_id FROM agents WHERE id = ?').get(agentId) as any
    if (!agent?.parent_agent_id) return null
    const parent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agent.parent_agent_id) as any
    return parent ? toCamelCase(parent) : null
  }

  getChildren(agentId: string): Array<Record<string, unknown>> {
    const children = this.db.prepare('SELECT * FROM agents WHERE parent_agent_id = ?').all(agentId) as any[]
    return toCamelCaseArray(children)
  }

  getChain(agentId: string): Array<Record<string, unknown>> {
    const chain: Array<Record<string, unknown>> = []
    let currentId: string | null = agentId
    const visited = new Set<string>()

    while (currentId) {
      if (visited.has(currentId)) break
      visited.add(currentId)
      const agent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(currentId) as any
      if (!agent?.parent_agent_id) break
      const parent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(agent.parent_agent_id) as any
      if (!parent) break
      chain.push(toCamelCase(parent))
      currentId = parent.id
    }
    return chain
  }

  requiresApproval(agentId: string): boolean {
    const agent = this.db.prepare('SELECT requires_parent_approval FROM agents WHERE id = ?').get(agentId) as any
    return agent?.requires_parent_approval === 1
  }

  getTree(): TreeNode[] {
    const agents = this.db.prepare('SELECT * FROM agents ORDER BY name').all() as any[]
    const map = new Map<string, TreeNode>()
    const roots: TreeNode[] = []

    for (const agent of agents) {
      map.set(agent.id, { agent: toCamelCase(agent), children: [] })
    }

    for (const agent of agents) {
      const node = map.get(agent.id)!
      if (agent.parent_agent_id && map.has(agent.parent_agent_id)) {
        map.get(agent.parent_agent_id)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }

  findBestChild(parentId: string, taskDescription: string): Record<string, unknown> | null {
    const children = this.db.prepare('SELECT * FROM agents WHERE parent_agent_id = ?').all(parentId) as any[]
    if (children.length === 0) return null

    const descLower = taskDescription.toLowerCase()
    let bestMatch: any = null
    let bestScore = 0

    for (const child of children) {
      let score = 0
      const role = (child.role ?? '').toLowerCase()
      const name = child.name.toLowerCase()
      const instructions = (child.instructions ?? '').toLowerCase()

      const words = descLower.split(/\s+/)
      for (const word of words) {
        if (word.length < 3) continue
        if (role.includes(word)) score += 3
        if (name.includes(word)) score += 2
        if (instructions.includes(word)) score += 1
      }

      if (score > bestScore) {
        bestScore = score
        bestMatch = child
      }
    }

    return bestMatch ? toCamelCase(bestMatch) : toCamelCase(children[0])
  }

  // --- Reviews ---

  createReview(opts: {
    executionTaskId?: string | null
    conversationId?: string | null
    reviewerAgentId: string
    revieweeAgentId: string
  }): Record<string, unknown> {
    const id = randomUUID()
    this.db.prepare(`
      INSERT INTO agent_reviews (id, execution_task_id, conversation_id, reviewer_agent_id, reviewee_agent_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, opts.executionTaskId ?? null, opts.conversationId ?? null, opts.reviewerAgentId, opts.revieweeAgentId)
    return toCamelCase(this.db.prepare('SELECT * FROM agent_reviews WHERE id = ?').get(id) as any)
  }

  getPendingReviews(reviewerAgentId: string): Array<Record<string, unknown>> {
    const reviews = this.db.prepare(
      "SELECT * FROM agent_reviews WHERE reviewer_agent_id = ? AND status = 'pending' ORDER BY created_at"
    ).all(reviewerAgentId) as any[]
    return toCamelCaseArray(reviews)
  }

  resolveReview(reviewId: string, status: 'approved' | 'rejected' | 'changes_requested', comment?: string): void {
    this.db.prepare(
      "UPDATE agent_reviews SET status = ?, comment = ?, resolved_at = datetime('now') WHERE id = ?"
    ).run(status, comment ?? null, reviewId)
  }

  getReviewsForTask(executionTaskId: string): Array<Record<string, unknown>> {
    const reviews = this.db.prepare('SELECT * FROM agent_reviews WHERE execution_task_id = ? ORDER BY created_at').all(executionTaskId) as any[]
    return toCamelCaseArray(reviews)
  }

  getReviewsForAgent(agentId: string): Array<Record<string, unknown>> {
    const reviews = this.db.prepare('SELECT * FROM agent_reviews WHERE reviewee_agent_id = ? ORDER BY created_at').all(agentId) as any[]
    return toCamelCaseArray(reviews)
  }
}
