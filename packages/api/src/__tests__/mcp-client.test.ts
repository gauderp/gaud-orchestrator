import { describe, it, expect } from 'vitest'
import { getAvailableToolsForAgent, formatToolsForPrompt } from '../services/mcp-client.js'
import Database from 'better-sqlite3'

describe('MCP Client', () => {
  it('returns builtin tools for any agent', () => {
    const db = new Database(':memory:')
    const tools = getAvailableToolsForAgent(db, 'any-agent')
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.some(t => t.name === 'gaud_cards_create')).toBe(true)
    expect(tools.some(t => t.name === 'gaud_dashboard')).toBe(true)
    db.close()
  })

  it('formats tools for prompt injection', () => {
    const tools = [
      { name: 'gaud_cards_list', description: 'List cards', serverId: 'gaud' },
      { name: 'gaud_agents_list', description: 'List agents', serverId: 'gaud' },
    ]
    const formatted = formatToolsForPrompt(tools)
    expect(formatted).toContain('gaud_cards_list')
    expect(formatted).toContain('gaud_agents_list')
    expect(formatted).toContain('## Available Tools')
  })

  it('returns empty string for no tools', () => {
    expect(formatToolsForPrompt([])).toBe('')
  })
})
