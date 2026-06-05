import { describe, it, expect } from 'vitest'
import { createGeminiProvider } from '../gemini.js'

describe('Gemini Provider', () => {
  const provider = createGeminiProvider({ apiKey: 'test-key' })

  it('has correct id and name', () => {
    expect(provider.id).toBe('gemini')
    expect(provider.name).toBe('Google Gemini')
  })

  it('lists models', () => {
    expect(provider.models).toContain('gemini-2.5-pro')
    expect(provider.models).toContain('gemini-2.5-flash')
  })

  it('estimates cost for pro', () => {
    const cost = provider.estimateCost('gemini-2.5-pro', { input: 1_000_000, output: 1_000_000 })
    expect(cost).toBeGreaterThan(0)
  })

  it('builds correct request body', () => {
    const body = (provider as any).buildRequestBody('Hello', 'gemini-2.5-flash')
    expect(body.contents[0].parts[0].text).toBe('Hello')
  })
})
