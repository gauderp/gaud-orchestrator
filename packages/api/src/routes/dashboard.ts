import type { FastifyInstance } from 'fastify'
import { clientCount } from '../ws/broadcast.js'
import { isRtkAvailable, getRtkGain } from '../services/rtk.js'

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()

  app.get('/api/dashboard', async (_req, reply) => {
    // Agents
    const agentTotal = (db.prepare('SELECT COUNT(*) as c FROM agents').get() as any).c
    const agentWithProvider = (db.prepare('SELECT COUNT(*) as c FROM agents WHERE provider_id IS NOT NULL').get() as any).c

    // Cards by status
    const cardTotal = (db.prepare('SELECT COUNT(*) as c FROM cards').get() as any).c
    const cardsByType = db.prepare('SELECT type, COUNT(*) as c FROM cards GROUP BY type').all() as any[]

    // Specs
    const specsDraft = (db.prepare("SELECT COUNT(*) as c FROM specs WHERE status = 'draft'").get() as any).c
    const specsReview = (db.prepare("SELECT COUNT(*) as c FROM specs WHERE status = 'review'").get() as any).c
    const specsApproved = (db.prepare("SELECT COUNT(*) as c FROM specs WHERE status = 'approved'").get() as any).c
    const specsTotal = (db.prepare('SELECT COUNT(*) as c FROM specs').get() as any).c

    // Executions
    const execActive = (db.prepare("SELECT COUNT(*) as c FROM executions WHERE status IN ('planning', 'approving', 'executing')").get() as any).c
    const execDone = (db.prepare("SELECT COUNT(*) as c FROM executions WHERE status = 'done'").get() as any).c
    const execFailed = (db.prepare("SELECT COUNT(*) as c FROM executions WHERE status = 'failed'").get() as any).c
    const execTotal = (db.prepare('SELECT COUNT(*) as c FROM executions').get() as any).c

    // Cost this month
    const costThisMonth = (db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) as total
      FROM agent_cost_log
      WHERE created_at >= datetime('now', 'start of month')
    `).get() as any).total
    const tokensThisMonth = db.prepare(`
      SELECT COALESCE(SUM(tokens_in), 0) as input, COALESCE(SUM(tokens_out), 0) as output
      FROM agent_cost_log
      WHERE created_at >= datetime('now', 'start of month')
    `).get() as any

    // Conversations
    const activeConversations = (db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'active'").get() as any).c
    const pausedConversations = (db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'paused_for_user'").get() as any).c

    // Memories
    const totalMemories = (db.prepare('SELECT COUNT(*) as c FROM agent_memories').get() as any).c
    const recentLearnings = (db.prepare(`
      SELECT COUNT(*) as c FROM agent_memories
      WHERE type IN ('error_correction', 'pattern_success')
        AND created_at >= datetime('now', '-7 days')
    `).get() as any).c

    // Skills
    const skillsTotal = (db.prepare('SELECT COUNT(*) as c FROM skills').get() as any).c

    // Boards
    const boardsTotal = (db.prepare('SELECT COUNT(*) as c FROM boards').get() as any).c

    return reply.send({
      health: { status: 'ok', wsClients: clientCount() },
      agents: { total: agentTotal, configured: agentWithProvider },
      cards: {
        total: cardTotal,
        byType: Object.fromEntries(cardsByType.map((r: any) => [r.type, r.c])),
      },
      specs: { total: specsTotal, draft: specsDraft, review: specsReview, approved: specsApproved, pending: specsDraft + specsReview },
      executions: { total: execTotal, active: execActive, done: execDone, failed: execFailed },
      cost: {
        totalThisMonth: costThisMonth,
        tokensIn: tokensThisMonth.input,
        tokensOut: tokensThisMonth.output,
      },
      conversations: { active: activeConversations, pausedForUser: pausedConversations },
      memories: { total: totalMemories, recentLearnings },
      skills: { total: skillsTotal },
      boards: { total: boardsTotal },
      rtk: {
        available: isRtkAvailable(),
        gain: getRtkGain(),
      },
    })
  })
}
