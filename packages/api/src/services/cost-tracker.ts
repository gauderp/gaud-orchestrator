import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface CostSummary {
  totalCostUsd: number
  totalTokensIn: number
  totalTokensOut: number
  limitUsd: number
  isOverLimit: boolean
}

export function getAgentCostSummary(db: Database.Database, agentId: string): CostSummary {
  const agent = db.prepare('SELECT cost_limit_usd FROM agents WHERE id = ?').get(agentId) as { cost_limit_usd: number } | undefined
  if (!agent) return { totalCostUsd: 0, totalTokensIn: 0, totalTokensOut: 0, limitUsd: 0, isOverLimit: false }

  const stats = db.prepare(`
    SELECT COALESCE(SUM(cost_usd), 0) as total_cost,
           COALESCE(SUM(tokens_in), 0) as total_in,
           COALESCE(SUM(tokens_out), 0) as total_out
    FROM agent_cost_log
    WHERE agent_id = ?
      AND created_at >= datetime('now', 'start of month')
  `).get(agentId) as { total_cost: number; total_in: number; total_out: number }

  return {
    totalCostUsd: stats.total_cost,
    totalTokensIn: stats.total_in,
    totalTokensOut: stats.total_out,
    limitUsd: agent.cost_limit_usd,
    isOverLimit: agent.cost_limit_usd > 0 && stats.total_cost >= agent.cost_limit_usd,
  }
}

export function logCost(db: Database.Database, entry: {
  agentId: string; tokensIn: number; tokensOut: number; costUsd: number;
  providerId?: string; model?: string; taskId?: string;
}): void {
  db.prepare(`
    INSERT INTO agent_cost_log (id, agent_id, tokens_in, tokens_out, cost_usd, provider_id, model, task_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), entry.agentId, entry.tokensIn, entry.tokensOut, entry.costUsd,
    entry.providerId ?? null, entry.model ?? null, entry.taskId ?? null)
}
