import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { getDb } from '../db/connection.js'

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production'
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '15m'
const JWT_REFRESH_EXPIRES_IN = process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d'

export interface JwtPayload {
  userId: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
}

// Routes that don't need auth
const PUBLIC_ROUTES = [
  'POST /api/auth/login',
  'POST /api/auth/refresh',
  'GET /api/setup/status',
  'POST /api/setup/complete',
  'GET /api/health',
  'POST /api/slack-webhook',
  'GET /api/setup/agent-templates',
]

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any)
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as any)
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

export function registerAuthHook(app: FastifyInstance): void {
  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const routeKey = `${req.method} ${(req.routeOptions as any)?.url ?? req.url.split('?')[0]}`

    // Skip public routes
    if (PUBLIC_ROUTES.some(r => routeKey.startsWith(r))) return

    // Also skip static files and websocket upgrade (WS auth handled separately)
    if (!req.url.startsWith('/api/')) return

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Authentication required' })
    }

    try {
      const token = authHeader.slice(7)
      const payload = verifyToken(token)

      // Verify user still exists and is active
      const db = getDb()
      const user = db.prepare('SELECT id, name, email, role, active FROM users WHERE id = ?').get(payload.userId) as any
      if (!user || !user.active) {
        return reply.status(401).send({ error: 'User not found or inactive' })
      }

      // Attach user to request
      ;(req as any).user = { id: user.id, name: user.name, email: user.email, role: user.role }
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }
  })
}

// Role hierarchy: admin > editor > viewer
const ROLE_LEVEL: Record<string, number> = { admin: 3, editor: 2, viewer: 1 }

export function requireRole(minRole: 'admin' | 'editor' | 'viewer') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user
    if (!user) return reply.status(401).send({ error: 'Authentication required' })
    if ((ROLE_LEVEL[user.role] ?? 0) < (ROLE_LEVEL[minRole] ?? 0)) {
      return reply.status(403).send({ error: 'Insufficient permissions' })
    }
  }
}
