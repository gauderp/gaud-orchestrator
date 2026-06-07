import type Database from 'better-sqlite3'

export interface AvailableTool {
  name: string
  description: string
  serverId: string
}

/**
 * Lists available MCP tools from configured servers.
 * For now, returns the orchestrator's own tools as available.
 * Future: connect to external MCP servers configured per agent.
 */
export function getAvailableToolsForAgent(_db: Database.Database, _agentId: string): AvailableTool[] {
  const builtinTools: AvailableTool[] = [
    { name: 'gaud_boards_list', description: 'List all boards', serverId: 'gaud' },
    { name: 'gaud_boards_get', description: 'Get board with columns and cards', serverId: 'gaud' },
    { name: 'gaud_cards_list', description: 'List cards on a board', serverId: 'gaud' },
    { name: 'gaud_cards_create', description: 'Create a new card', serverId: 'gaud' },
    { name: 'gaud_cards_move', description: 'Move card to column', serverId: 'gaud' },
    { name: 'gaud_agents_list', description: 'List all agents', serverId: 'gaud' },
    { name: 'gaud_specs_list', description: 'List specs', serverId: 'gaud' },
    { name: 'gaud_specs_create', description: 'Create a spec', serverId: 'gaud' },
    { name: 'gaud_executions_list', description: 'List executions', serverId: 'gaud' },
    { name: 'gaud_conversations_create', description: 'Create conversation', serverId: 'gaud' },
    { name: 'gaud_memory_search', description: 'Search agent memories', serverId: 'gaud' },
    { name: 'gaud_dashboard', description: 'Get dashboard metrics', serverId: 'gaud' },
  ]

  return builtinTools
}

/**
 * Format available tools as a text section for injection into agent prompts.
 */
export function formatToolsForPrompt(tools: AvailableTool[]): string {
  if (tools.length === 0) return ''
  const lines = tools.map(t => `- **${t.name}**: ${t.description}`)
  return `## Available Tools\n\nYou can reference these tools in your responses:\n${lines.join('\n')}`
}
