import { describe, it, expect } from 'vitest'
import { createRegistryFromConfigs } from '../services/provider-loader.js'

describe('Provider Loader', () => {
  it('creates claude-cli provider without config', () => {
    const registry = createRegistryFromConfigs([
      { id: 'p1', type: 'claude-cli', configJson: {} },
    ])
    expect(registry.get('p1')).toBeDefined()
    expect(registry.get('p1')?.name).toBe('Claude Code CLI')
  })

  it('creates claude-api provider with apiKey', () => {
    const registry = createRegistryFromConfigs([
      { id: 'p2', type: 'claude-api', configJson: { apiKey: 'test' } },
    ])
    expect(registry.get('p2')).toBeDefined()
    expect(registry.get('p2')?.name).toBe('Claude API (Anthropic)')
  })

  it('creates openai provider', () => {
    const registry = createRegistryFromConfigs([
      { id: 'p3', type: 'openai', configJson: { apiKey: 'test' } },
    ])
    expect(registry.get('p3')).toBeDefined()
  })

  it('creates deepseek provider', () => {
    const registry = createRegistryFromConfigs([
      { id: 'p4', type: 'deepseek', configJson: { apiKey: 'test' } },
    ])
    expect(registry.get('p4')).toBeDefined()
  })

  it('creates gemini provider', () => {
    const registry = createRegistryFromConfigs([
      { id: 'p5', type: 'gemini', configJson: { apiKey: 'test' } },
    ])
    expect(registry.get('p5')).toBeDefined()
  })

  it('creates cursor provider', () => {
    const registry = createRegistryFromConfigs([
      { id: 'p6', type: 'cursor', configJson: {} },
    ])
    expect(registry.get('p6')).toBeDefined()
  })

  it('skips unknown provider types', () => {
    const registry = createRegistryFromConfigs([
      { id: 'p7', type: 'unknown-provider', configJson: {} },
    ])
    expect(registry.get('p7')).toBeUndefined()
  })

  it('registers multiple providers', () => {
    const registry = createRegistryFromConfigs([
      { id: 'p1', type: 'claude-cli', configJson: {} },
      { id: 'p2', type: 'openai', configJson: { apiKey: 'k' } },
    ])
    expect(registry.list()).toHaveLength(2)
  })
})
