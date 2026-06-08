import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/connection.js'
import { signAccessToken, signRefreshToken } from '../middleware/auth.js'

export async function setupRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb()

  // Check setup status
  app.get('/api/setup/status', async (_req, reply) => {
    const row = db.prepare("SELECT value FROM setup_state WHERE key = 'setup_completed'").get() as any
    return reply.send({ completed: row?.value === 'true' })
  })

  // Complete setup — creates admin user, providers, and optionally GitHub token
  app.post('/api/setup/complete', async (req, reply) => {
    // Check not already completed
    const row = db.prepare("SELECT value FROM setup_state WHERE key = 'setup_completed'").get() as any
    if (row?.value === 'true') {
      return reply.status(400).send({ error: 'Setup already completed' })
    }

    const { admin, providers, githubToken } = req.body as {
      admin: { name: string; email: string; password: string }
      providers?: Array<{ name: string; type: string; configJson: Record<string, unknown> }>
      githubToken?: string
    }

    // Validate admin
    if (!admin?.name || !admin?.email || !admin?.password) {
      return reply.status(400).send({ error: 'Admin name, email, and password are required' })
    }
    if (admin.password.length < 8) {
      return reply.status(400).send({ error: 'Password must be at least 8 characters' })
    }

    const userId = randomUUID()
    const hash = bcrypt.hashSync(admin.password, 12)

    // Transaction: create admin + providers + mark setup complete
    const tx = db.transaction(() => {
      // Create admin user
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'admin')
      `).run(userId, admin.name, admin.email, hash)

      // Create providers if any
      if (providers?.length) {
        for (const p of providers) {
          db.prepare('INSERT INTO providers (id, name, type, config_json) VALUES (?, ?, ?, ?)')
            .run(randomUUID(), p.name, p.type, JSON.stringify(p.configJson))
        }
      }

      // Store GitHub token as env hint
      if (githubToken) {
        db.prepare("INSERT OR REPLACE INTO setup_state (key, value) VALUES ('github_token', ?)")
          .run(githubToken)
      }

      // Mark setup complete
      db.prepare("UPDATE setup_state SET value = 'true' WHERE key = 'setup_completed'").run()
    })
    tx()

    // Return tokens so user is immediately logged in
    const payload = { userId, email: admin.email, role: 'admin' as const }
    return reply.status(201).send({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: { id: userId, name: admin.name, email: admin.email, role: 'admin' },
    })
  })
}
