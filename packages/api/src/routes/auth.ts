import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { getDb } from '../db/connection.js'
import { signAccessToken, signRefreshToken, verifyToken } from '../middleware/auth.js'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const db = getDb()

  // Login
  app.post('/api/auth/login', async (req, reply) => {
    const { email, password } = req.body as { email: string; password: string }
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as any
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' })

    const valid = bcrypt.compareSync(password, user.password_hash)
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' })

    const payload = { userId: user.id, email: user.email, role: user.role }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  })

  // Refresh token
  app.post('/api/auth/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    try {
      const payload = verifyToken(refreshToken)
      // Verify user still active
      const user = db.prepare('SELECT id, email, role, active FROM users WHERE id = ?').get(payload.userId) as any
      if (!user || !user.active) return reply.status(401).send({ error: 'User not found or inactive' })

      const newPayload = { userId: user.id, email: user.email, role: user.role }
      return reply.send({ accessToken: signAccessToken(newPayload) })
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }
  })

  // Get current user
  app.get('/api/auth/me', async (req, reply) => {
    const user = (req as any).user
    if (!user) return reply.status(401).send({ error: 'Not authenticated' })
    return reply.send(user)
  })
}
