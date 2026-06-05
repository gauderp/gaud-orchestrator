import { describe, it, expect } from 'vitest'
import { createClaudeApiProvider } from '../claude-api.js'

describe('Claude API Provider', () => {
  const provider = createClaudeApiProvider({ apiKey: 'test-key' })

  it('has correct id and name', () => {
    expect(provider.id).toBe('claude-api')
    expect(provider.name).toBe('Claude API (Anthropic)')
  })

  it('lists available models', () => {
    expect(provider.models).toContain('claude-sonnet-4-6')
    expect(provider.models).toContain('claude-opus-4-6')
    expect(provider.models).toContain('claude-haiku-4-5')
  })

  it('estimates cost correctly for sonnet', () => {
    const cost = provider.estimateCost('claude-sonnet-4-6', { input: 1_000_000, output: 1_000_000 })
    expect(cost).toBeCloseTo(3 + 15) // $3/1M in + $15/1M out
  })

  it('estimates cost correctly for opus', () => {
    const cost = provider.estimateCost('claude-opus-4-6', { input: 1_000_000, output: 1_000_000 })
    expect(cost).toBeCloseTo(15 + 75)
  })

  it('builds correct request body', () => {
    const body = (provider as any).buildRequestBody('Hello', 'claude-sonnet-4-6')
    expect(body.model).toBe('claude-sonnet-4-6')
    expect(body.messages[0].content).toBe('Hello')
    expect(body.max_tokens).toBeDefined()
    expect(body.stream).toBe(true)
  })
})
