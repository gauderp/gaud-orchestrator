import { describe, it, expect } from 'vitest'
import { createClaudeCliProvider } from '../claude-cli.js'

describe('Claude CLI Provider', () => {
  const provider = createClaudeCliProvider()

  it('has correct id and name', () => {
    expect(provider.id).toBe('claude-cli')
    expect(provider.name).toBe('Claude Code CLI')
  })

  it('lists available models', () => {
    expect(provider.models).toContain('claude-sonnet-4-6')
    expect(provider.models).toContain('claude-opus-4-6')
  })

  it('estimates cost for sonnet', () => {
    const cost = provider.estimateCost('claude-sonnet-4-6', { input: 1000, output: 500 })
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(1)
  })

  it('estimates cost for opus', () => {
    const cost = provider.estimateCost('claude-opus-4-6', { input: 1000, output: 500 })
    expect(cost).toBeGreaterThan(0)
  })

  it('buildArgs returns correct args', () => {
    const args = provider.buildArgs('Do something', 'sonnet')
    expect(args).toContain('-p')
    expect(args).toContain('--output-format')
  })
})
