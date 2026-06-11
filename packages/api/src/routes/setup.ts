import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
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

  // Return available agent templates parsed from agents/*.md files
  app.get('/api/setup/agent-templates', async (_req, reply) => {
    const agentsDir = process.env['AGENTS_DIR'] ?? 'agents'
    let files: string[]
    try {
      files = readdirSync(agentsDir).filter(f => f.endsWith('.md'))
    } catch {
      return reply.send([])
    }

    const templates = files.map(file => {
      const content = readFileSync(join(agentsDir, file), 'utf-8')
      const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (!match?.[1] || !match[2]) return null

      const frontmatter = match[1]
      const body = match[2].trim()

      const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? file.replace('.md', '')
      const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? ''
      const model = frontmatter.match(/^model:\s*(.+)$/m)?.[1]?.trim() ?? 'claude-sonnet-4-6'
      const color = frontmatter.match(/^color:\s*(.+)$/m)?.[1]?.trim() ?? 'gray'

      return { name, description, model, color, instructions: body }
    }).filter(Boolean)

    return reply.send(templates)
  })

  // Complete setup — creates admin user, providers, and optionally GitHub token
  app.post('/api/setup/complete', async (req, reply) => {
    // Check not already completed
    const row = db.prepare("SELECT value FROM setup_state WHERE key = 'setup_completed'").get() as any
    if (row?.value === 'true') {
      return reply.status(400).send({ error: 'Setup already completed' })
    }

    const { admin, providers, githubToken, agents } = req.body as {
      admin: { name: string; email: string; password: string }
      providers?: Array<{ name: string; type: string; configJson: Record<string, unknown> }>
      githubToken?: string
      agents?: Array<{ name: string; role: string; instructions: string; model: string; parentName?: string | null }>
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

      // Create agents if any
      if (agents?.length) {
        // Use the first provider created (if any) as default
        const firstProvider = providers?.length
          ? db.prepare('SELECT id FROM providers ORDER BY created_at DESC LIMIT 1').get() as any
          : null

        // Map to track name → generated ID for hierarchy resolution
        const nameToId = new Map<string, string>()

        // Sort: agents without parentName first (roots), then children
        const sorted = [...agents].sort((a, b) => {
          if (!a.parentName && b.parentName) return -1
          if (a.parentName && !b.parentName) return 1
          return 0
        })

        for (const a of sorted) {
          const agentId = randomUUID()
          const parentId = a.parentName ? nameToId.get(a.parentName) ?? null : null
          db.prepare(`
            INSERT INTO agents (id, name, role, instructions, provider_id, model, parent_agent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(agentId, a.name, a.role, a.instructions, firstProvider?.id ?? null, a.model, parentId)
          nameToId.set(a.name, agentId)
        }
      }

      // Mark setup complete
      db.prepare("UPDATE setup_state SET value = 'true' WHERE key = 'setup_completed'").run()
    })
    tx()

    // Reload provider registry so newly created providers are available immediately
    if (providers?.length) {
      const { loadProviderRegistry } = await import('../index.js')
      loadProviderRegistry()
    }

    // Return tokens so user is immediately logged in
    const payload = { userId, email: admin.email, role: 'admin' as const }
    return reply.status(201).send({
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: { id: userId, name: admin.name, email: admin.email, role: 'admin' },
    })
  })
}
