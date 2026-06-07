import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type Database from 'better-sqlite3'

export function registerDashboardTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_dashboard',
    'Get full dashboard metrics (agents, cards, specs, executions, cost, memories)',
    {},
    async () => {
      const agentTotal = (db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number }).c
      const agentWithProvider = (db.prepare('SELECT COUNT(*) as c FROM agents WHERE provider_id IS NOT NULL').get() as { c: number }).c

      const cardTotal = (db.prepare('SELECT COUNT(*) as c FROM cards').get() as { c: number }).c
      const cardsByType = db.prepare('SELECT type, COUNT(*) as c FROM cards GROUP BY type').all() as Array<{ type: string; c: number }>

      const specsDraft = (db.prepare("SELECT COUNT(*) as c FROM specs WHERE status = 'draft'").get() as { c: number }).c
      const specsReview = (db.prepare("SELECT COUNT(*) as c FROM specs WHERE status = 'review'").get() as { c: number }).c
      const specsApproved = (db.prepare("SELECT COUNT(*) as c FROM specs WHERE status = 'approved'").get() as { c: number }).c
      const specsTotal = (db.prepare('SELECT COUNT(*) as c FROM specs').get() as { c: number }).c

      const execActive = (db.prepare("SELECT COUNT(*) as c FROM executions WHERE status IN ('planning', 'approving', 'executing')").get() as { c: number }).c
      const execDone = (db.prepare("SELECT COUNT(*) as c FROM executions WHERE status = 'done'").get() as { c: number }).c
      const execFailed = (db.prepare("SELECT COUNT(*) as c FROM executions WHERE status = 'failed'").get() as { c: number }).c
      const execTotal = (db.prepare('SELECT COUNT(*) as c FROM executions').get() as { c: number }).c

      const costThisMonth = (db.prepare(`
        SELECT COALESCE(SUM(cost_usd), 0) as total
        FROM agent_cost_log
        WHERE created_at >= datetime('now', 'start of month')
      `).get() as { total: number }).total
      const tokensThisMonth = db.prepare(`
        SELECT COALESCE(SUM(tokens_in), 0) as input, COALESCE(SUM(tokens_out), 0) as output
        FROM agent_cost_log
        WHERE created_at >= datetime('now', 'start of month')
      `).get() as { input: number; output: number }

      const activeConversations = (db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'active'").get() as { c: number }).c
      const pausedConversations = (db.prepare("SELECT COUNT(*) as c FROM conversations WHERE status = 'paused_for_user'").get() as { c: number }).c

      const totalMemories = (db.prepare('SELECT COUNT(*) as c FROM agent_memories').get() as { c: number }).c
      const recentLearnings = (db.prepare(`
        SELECT COUNT(*) as c FROM agent_memories
        WHERE type IN ('error_correction', 'pattern_success')
          AND created_at >= datetime('now', '-7 days')
      `).get() as { c: number }).c

      const boardsTotal = (db.prepare('SELECT COUNT(*) as c FROM boards').get() as { c: number }).c

      const dashboard = {
        agents: { total: agentTotal, configured: agentWithProvider },
        cards: {
          total: cardTotal,
          byType: Object.fromEntries(cardsByType.map(r => [r.type, r.c])),
        },
        specs: { total: specsTotal, draft: specsDraft, review: specsReview, approved: specsApproved },
        executions: { total: execTotal, active: execActive, done: execDone, failed: execFailed },
        cost: {
          totalThisMonth: costThisMonth,
          tokensIn: tokensThisMonth.input,
          tokensOut: tokensThisMonth.output,
        },
        conversations: { active: activeConversations, pausedForUser: pausedConversations },
        memories: { total: totalMemories, recentLearnings },
        boards: { total: boardsTotal },
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(dashboard, null, 2) }] }
    }
  )
}
