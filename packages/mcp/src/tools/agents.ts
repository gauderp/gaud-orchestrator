import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type Database from 'better-sqlite3'
import { z } from 'zod'

function toCamelCase(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value
  }
  return result
}

export function registerAgentTools(server: McpServer, db: Database.Database): void {

  server.tool(
    'gaud_agents_list',
    'List all agents with hierarchy info',
    {},
    async () => {
      const agents = db.prepare(`
        SELECT a.*, p.name as provider_name,
          (SELECT COUNT(*) FROM agents c WHERE c.parent_agent_id = a.id) as child_count
        FROM agents a
        LEFT JOIN providers p ON p.id = a.provider_id
        ORDER BY a.name
      `).all() as Record<string, unknown>[]
      return { content: [{ type: 'text' as const, text: JSON.stringify(agents.map(toCamelCase), null, 2) }] }
    }
  )

  server.tool(
    'gaud_agents_get',
    'Get agent details with skills and cost',
    { agentId: z.string().describe('Agent ID') },
    async ({ agentId }) => {
      const agent = db.prepare(`
        SELECT a.*, p.name as provider_name
        FROM agents a
        LEFT JOIN providers p ON p.id = a.provider_id
        WHERE a.id = ?
      `).get(agentId) as Record<string, unknown> | undefined
      if (!agent) return { content: [{ type: 'text' as const, text: 'Agent not found' }] }

      const skills = db.prepare(`
        SELECT s.id, s.name, s.description FROM skills s
        JOIN agent_skills ags ON ags.skill_id = s.id
        WHERE ags.agent_id = ?
      `).all(agentId) as Record<string, unknown>[]

      const cost = db.prepare(`
        SELECT COALESCE(SUM(cost_usd), 0) as total_cost,
               COALESCE(SUM(tokens_in), 0) as total_tokens_in,
               COALESCE(SUM(tokens_out), 0) as total_tokens_out
        FROM agent_cost_log WHERE agent_id = ?
      `).get(agentId) as Record<string, unknown>

      return { content: [{ type: 'text' as const, text: JSON.stringify({
        ...toCamelCase(agent),
        skills: skills.map(toCamelCase),
        cost: toCamelCase(cost),
      }, null, 2) }] }
    }
  )

  server.tool(
    'gaud_agents_tree',
    'Get full org chart hierarchy tree',
    {},
    async () => {
      const agents = db.prepare('SELECT id, name, role, parent_agent_id FROM agents').all() as Array<{ id: string; name: string; role: string | null; parent_agent_id: string | null }>

      interface TreeNode { id: string; name: string; role: string | null; children: TreeNode[] }
      const map = new Map<string, TreeNode>()
      for (const a of agents) {
        map.set(a.id, { id: a.id, name: a.name, role: a.role, children: [] })
      }
      const roots: TreeNode[] = []
      for (const a of agents) {
        const node = map.get(a.id)!
        if (a.parent_agent_id && map.has(a.parent_agent_id)) {
          map.get(a.parent_agent_id)!.children.push(node)
        } else {
          roots.push(node)
        }
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(roots, null, 2) }] }
    }
  )
}
