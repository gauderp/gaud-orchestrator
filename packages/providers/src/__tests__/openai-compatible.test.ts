import { describe, it, expect } from 'vitest'
import { createOpenAICompatibleProvider } from '../openai-compatible.js'

describe('OpenAI Provider', () => {
  const provider = createOpenAICompatibleProvider({
    id: 'openai',
    name: 'OpenAI',
    apiKey: 'test-key',
    baseUrl: 'https://api.openai.com/v1',
    models: {
      'gpt-4o': { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
      'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
    },
  })

  it('has correct id and name', () => {
    expect(provider.id).toBe('openai')
    expect(provider.name).toBe('OpenAI')
  })

  it('lists models from config', () => {
    expect(provider.models).toContain('gpt-4o')
    expect(provider.models).toContain('gpt-4o-mini')
  })

  it('estimates cost for gpt-4o', () => {
    const cost = provider.estimateCost('gpt-4o', { input: 1_000_000, output: 1_000_000 })
    expect(cost).toBeCloseTo(2.5 + 10)
  })

  it('builds correct request body', () => {
    const body = (provider as any).buildRequestBody('Hello', 'gpt-4o')
    expect(body.model).toBe('gpt-4o')
    expect(body.messages[0].content).toBe('Hello')
    expect(body.stream).toBe(true)
  })
})

describe('DeepSeek Provider (OpenAI-compatible)', () => {
  const provider = createOpenAICompatibleProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    apiKey: 'test-key',
    baseUrl: 'https://api.deepseek.com/v1',
    models: {
      'deepseek-coder': { input: 0.14 / 1_000_000, output: 0.28 / 1_000_000 },
      'deepseek-chat': { input: 0.14 / 1_000_000, output: 0.28 / 1_000_000 },
    },
  })

  it('has correct id', () => {
    expect(provider.id).toBe('deepseek')
  })

  it('lists deepseek models', () => {
    expect(provider.models).toContain('deepseek-coder')
  })

  it('uses deepseek base URL', () => {
    const body = (provider as any).buildRequestBody('test', 'deepseek-coder')
    expect(body.model).toBe('deepseek-coder')
  })
})
