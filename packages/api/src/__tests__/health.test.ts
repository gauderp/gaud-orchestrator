import { describe, it, expect, afterAll } from 'vitest'
import Fastify from 'fastify'
import { healthRoutes } from '../routes/health.js'

describe('GET /api/health', () => {
  const app = Fastify()

  afterAll(async () => {
    await app.close()
  })

  it('returns ok status', async () => {
    await app.register(healthRoutes)
    await app.ready()

    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.payload)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeTruthy()
  })
})
