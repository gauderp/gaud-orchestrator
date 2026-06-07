import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import Database from 'better-sqlite3'
import { join } from 'path'
import { registerCardTools } from './tools/cards.js'
import { registerBoardTools } from './tools/boards.js'
import { registerAgentTools } from './tools/agents.js'
import { registerSpecTools } from './tools/specs.js'
import { registerExecutionTools } from './tools/executions.js'
import { registerConversationTools } from './tools/conversations.js'
import { registerMemoryTools } from './tools/memory.js'
import { registerDashboardTools } from './tools/dashboard.js'

const dbPath = process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'orchestrator.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const server = new McpServer({
  name: 'gaud-orchestrator',
  version: '0.1.0',
})

// Register all tool groups
registerCardTools(server, db)
registerBoardTools(server, db)
registerAgentTools(server, db)
registerSpecTools(server, db)
registerExecutionTools(server, db)
registerConversationTools(server, db)
registerMemoryTools(server, db)
registerDashboardTools(server, db)

// Start stdio transport
const transport = new StdioServerTransport()
await server.connect(transport)
