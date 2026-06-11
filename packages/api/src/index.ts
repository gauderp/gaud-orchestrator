import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import fastifyStatic from '@fastify/static'
import { runMigrations } from './db/migrate.js'
import { getDb } from './db/connection.js'
import { createRegistryFromConfigs } from './services/provider-loader.js'
import { addClient } from './ws/broadcast.js'
import { registerAuthHook } from './middleware/auth.js'
import { verifyToken } from './middleware/auth.js'
import { authRoutes } from './routes/auth.js'
import { setupRoutes } from './routes/setup.js'
import { userRoutes } from './routes/users.js'
import { healthRoutes } from './routes/health.js'
import { skillRoutes } from './routes/skills.js'
import { providerRoutes } from './routes/providers.js'
import { agentRoutes } from './routes/agents.js'
import { boardRoutes } from './routes/boards.js'
import { cardRoutes } from './routes/cards.js'
import { conversationRoutes } from './routes/conversations.js'
import { memoryRoutes } from './routes/memory.js'
import { specRoutes } from './routes/specs.js'
import { executionRoutes } from './routes/executions.js'
import { attachmentRoutes } from './routes/attachments.js'
import { dashboardRoutes } from './routes/dashboard.js'
import { githubRoutes } from './routes/github.js'
import { bugReportRoutes } from './routes/bug-reports.js'
import { slackWebhookRoutes } from './routes/slack-webhook.js'
import { intakeRoutes } from './routes/intake.js'
import { bugSourceRoutes } from './routes/bug-sources.js'
import { backupRoutes } from './routes/backup.js'
import multipart from '@fastify/multipart'
import rawBody from 'fastify-raw-body'

const dbPath = process.env['DATABASE_PATH'] ?? 'data/orchestrator.db'
mkdirSync(dirname(dbPath), { recursive: true })

runMigrations()

// Load configured providers from DB (reloadable)
let providerRegistry = createRegistryFromConfigs([])

function loadProviderRegistry() {
  const rows = getDb().prepare('SELECT * FROM providers').all() as any[]
  const configs = rows.map((p: any) => ({
    id: p.id,
    type: p.type,
    configJson: JSON.parse(p.config_json),
  }))
  providerRegistry = createRegistryFromConfigs(configs)
  console.log(`Loaded ${providerRegistry.list().length} providers: ${providerRegistry.list().map(p => p.id).join(', ') || '(none)'}`)
}

loadProviderRegistry()

// Export reload function for use by routes (setup, providers CRUD)
export { loadProviderRegistry }

const server = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
  // Behind a reverse proxy, req.protocol/hostname must reflect the original
  // request — Trello webhook HMAC verification rebuilds the callback URL
  trustProxy: true,
})

// Make provider registry available to all routes
server.decorate('providerRegistry', providerRegistry)

await server.register(cors, {
  origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
})

await server.register(websocket)
await server.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })
// Raw body for webhook signature verification (opt-in per route via config.rawBody)
await server.register(rawBody, { field: 'rawBody', global: false, encoding: 'utf8', runFirst: true })

server.register(async (app) => {
  app.get('/ws', { websocket: true }, (socket, req) => {
    // Validate token from query param
    const url = new URL(req.url, `http://${req.headers.host}`)
    const token = url.searchParams.get('token')
    if (!token) { socket.close(4001, 'Token required'); return }
    try {
      verifyToken(token)
      addClient(socket)
    } catch {
      socket.close(4001, 'Invalid token')
    }
  })
})

// Auth hook (called directly on server, not via register, to avoid Fastify encapsulation)
registerAuthHook(server)
await server.register(authRoutes)
await server.register(setupRoutes)
await server.register(userRoutes)

await server.register(healthRoutes)
await server.register(skillRoutes)
await server.register(providerRoutes)
await server.register(agentRoutes)
await server.register(boardRoutes)
await server.register(cardRoutes)
await server.register(conversationRoutes)
await server.register(memoryRoutes)
await server.register(specRoutes)
await server.register(executionRoutes)
await server.register(attachmentRoutes)
await server.register(dashboardRoutes)
await server.register(githubRoutes)
await server.register(bugReportRoutes)
await server.register(slackWebhookRoutes)
await server.register(intakeRoutes)
await server.register(bugSourceRoutes)
await server.register(backupRoutes)

// Serve frontend in production
if (process.env['NODE_ENV'] === 'production') {
  const webDistPath = join(process.cwd(), 'packages', 'web', 'dist')
  if (existsSync(webDistPath)) {
    await server.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    })
    // SPA fallback: serve index.html for all non-API routes
    server.setNotFoundHandler(async (_req, reply) => {
      return reply.sendFile('index.html', webDistPath)
    })
  }
}

const PORT = Number(process.env['PORT'] ?? 3001)
await server.listen({ port: PORT, host: '0.0.0.0' })
console.log(`Gaud Orchestrator API listening on port ${PORT}`)
