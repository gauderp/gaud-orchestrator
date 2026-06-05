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
import multipart from '@fastify/multipart'

const dbPath = process.env['DATABASE_PATH'] ?? 'data/orchestrator.db'
mkdirSync(dirname(dbPath), { recursive: true })

runMigrations()

// Load configured providers from DB
const providerRows = getDb().prepare('SELECT * FROM providers').all() as any[]
const providerConfigs = providerRows.map((p: any) => ({
  id: p.id,
  type: p.type,
  configJson: JSON.parse(p.config_json),
}))
const providerRegistry = createRegistryFromConfigs(providerConfigs)
console.log(`Loaded ${providerRegistry.list().length} providers: ${providerRegistry.list().map(p => p.id).join(', ') || '(none)'}`)

const server = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
})

// Make provider registry available to all routes
server.decorate('providerRegistry', providerRegistry)

await server.register(cors, {
  origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
})

await server.register(websocket)
await server.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })

server.register(async (app) => {
  app.get('/ws', { websocket: true }, (socket, _req) => {
    addClient(socket)
  })
})

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
