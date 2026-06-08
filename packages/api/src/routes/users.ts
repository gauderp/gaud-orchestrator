import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/connection.js'
import { requireRole } from '../middleware/auth.js'
import { toCamelCase } from '../utils/case.js'

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb()
  const adminOnly = requireRole('admin')

  function sanitize(u: any) {
    const { password_hash, ...rest } = u
    return toCamelCase(rest)
  }

  // List users
  app.get('/api/users', { preHandler: [adminOnly] }, async (_req, reply) => {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at').all() as any[]
    return reply.send(users.map(sanitize))
  })

  // Create user
  app.post('/api/users', { preHandler: [adminOnly] }, async (req, reply) => {
    const { name, email, password, role } = req.body as any
    if (!name || !email || !password) return reply.status(400).send({ error: 'name, email, password required' })
    if (password.length < 8) return reply.status(400).send({ error: 'Password must be at least 8 characters' })

    const id = randomUUID()
    const hash = bcrypt.hashSync(password, 12)
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, email, hash, role ?? 'editor')
    return reply.status(201).send(sanitize(db.prepare('SELECT * FROM users WHERE id = ?').get(id)))
  })

  // Update user
  app.put<{ Params: { id: string } }>('/api/users/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    const { name, email, role, active } = req.body as any
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any
    if (!existing) return reply.status(404).send({ error: 'User not found' })

    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(name ?? existing.name, email ?? existing.email, role ?? existing.role, active ?? existing.active, req.params.id)
    return reply.send(sanitize(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)))
  })

  // Delete (soft) — set active=0
  app.delete<{ Params: { id: string } }>('/api/users/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    const user = (req as any).user
    if (user.id === req.params.id) return reply.status(400).send({ error: 'Cannot deactivate yourself' })
    db.prepare("UPDATE users SET active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id)
    return reply.status(204).send()
  })

  // Reset password
  app.put<{ Params: { id: string } }>('/api/users/:id/password', { preHandler: [adminOnly] }, async (req, reply) => {
    const { password } = req.body as { password: string }
    if (!password || password.length < 8) return reply.status(400).send({ error: 'Password must be at least 8 characters' })
    const hash = bcrypt.hashSync(password, 12)
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.params.id)
    return reply.status(204).send()
  })
}
