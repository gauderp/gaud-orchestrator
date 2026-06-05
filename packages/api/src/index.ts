import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { mkdirSync } from 'fs'
import { dirname } from 'path'
import { runMigrations } from './db/migrate.js'
import { addClient } from './ws/broadcast.js'
import { healthRoutes } from './routes/health.js'

const dbPath = process.env['DATABASE_PATH'] ?? 'data/orchestrator.db'
mkdirSync(dirname(dbPath), { recursive: true })

runMigrations()

const server = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
})

await server.register(cors, {
  origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  credentials: true,
})

await server.register(websocket)

server.register(async (app) => {
  app.get('/ws', { websocket: true }, (socket, _req) => {
    addClient(socket)
  })
})

await server.register(healthRoutes)

const PORT = Number(process.env['PORT'] ?? 3001)
await server.listen({ port: PORT, host: '0.0.0.0' })
console.log(`Gaud Orchestrator API listening on port ${PORT}`)
