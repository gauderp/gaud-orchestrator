import type { FastifyInstance } from 'fastify'

/**
 * Register a test auth hook that attaches a fake admin user to all requests.
 * Must be called BEFORE registering routes that use requireRole().
 */
export async function setupTestAuth(app: FastifyInstance) {
  app.addHook('onRequest', async (req) => {
    ;(req as any).user = {
      id: 'test-user-id',
      name: 'Test Admin',
      email: 'test@test.com',
      role: 'admin',
    }
  })
}
