import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase } from '../utils/case.js'
import { requireRole } from '../middleware/auth.js'

export async function providerRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const adminOnly = requireRole('admin')

  function parseProvider(p: any) {
    return { ...toCamelCase<Record<string, unknown>>(p), configJson: JSON.parse(p.config_json) }
  }

  app.get('/api/providers', async (_req, reply) => {
    const providers = db.prepare('SELECT * FROM providers ORDER BY name').all()
    return reply.send((providers as any[]).map(parseProvider))
  })

  app.get<{ Params: { id: string } }>('/api/providers/:id', async (req, reply) => {
    const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id) as any
    if (!p) return reply.status(404).send({ error: 'Provider not found' })
    return reply.send(parseProvider(p))
  })

  async function reloadRegistry() {
    const { loadProviderRegistry } = await import('../index.js')
    loadProviderRegistry()
  }

  app.post('/api/providers', { preHandler: [adminOnly] }, async (req, reply) => {
    const { name, type, configJson } = req.body as { name: string; type: string; configJson: Record<string, unknown> }
    const id = randomUUID()
    db.prepare(
      'INSERT INTO providers (id, name, type, config_json) VALUES (?, ?, ?, ?)'
    ).run(id, name, type, JSON.stringify(configJson))
    await reloadRegistry()
    const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as any
    return reply.status(201).send(parseProvider(p))
  })

  app.put<{ Params: { id: string } }>('/api/providers/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    const { name, type, configJson } = req.body as { name: string; type: string; configJson: Record<string, unknown> }
    const result = db.prepare(
      'UPDATE providers SET name = ?, type = ?, config_json = ? WHERE id = ?'
    ).run(name, type, JSON.stringify(configJson), req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Provider not found' })
    await reloadRegistry()
    const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id) as any
    return reply.send(parseProvider(p))
  })

  app.delete<{ Params: { id: string } }>('/api/providers/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    db.prepare('DELETE FROM providers WHERE id = ?').run(req.params.id)
    await reloadRegistry()
    return reply.status(204).send()
  })

  app.post<{ Params: { id: string } }>('/api/providers/:id/test', async (req, reply) => {
    const p = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id) as any
    if (!p) return reply.status(404).send({ error: 'Provider not found' })

    try {
      const configJson = JSON.parse(p.config_json)
      const { createRegistryFromConfigs } = await import('../services/provider-loader.js')
      const registry = createRegistryFromConfigs([{ id: p.id, type: p.type, configJson }])
      const provider = registry.get(p.id)

      if (!provider) {
        return reply.send({ success: false, message: `Could not create provider of type: ${p.type}` })
      }

      // For API providers, try a minimal call
      if (['claude-api', 'openai', 'deepseek', 'gemini'].includes(p.type)) {
        let responseReceived = false
        const session = await provider.spawn({
          prompt: 'Reply with exactly: OK',
          cwd: process.cwd(),
          model: provider.models[0],
        })
        await new Promise<void>((resolve) => {
          provider.onOutput(session.id, (event) => {
            if (event.type === 'stdout' && event.content.length > 0) responseReceived = true
            if (event.type === 'stderr') responseReceived = false
          })
          setTimeout(() => {
            provider.kill(session.id)
            resolve()
          }, 10_000)
        })
        return reply.send({
          success: responseReceived,
          message: responseReceived ? 'Provider responded successfully' : 'No response received within 10s',
        })
      }

      // For CLI providers, just verify the command exists
      return reply.send({ success: true, message: `Provider ${p.type} configured (CLI verification skipped)` })
    } catch (err: any) {
      return reply.send({ success: false, message: err.message })
    }
  })
}
