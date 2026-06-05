import { describe, it, expect } from 'vitest'
import { createCursorCliProvider } from '../cursor-cli.js'

describe('Cursor CLI Provider', () => {
  const provider = createCursorCliProvider()

  it('has correct id and name', () => {
    expect(provider.id).toBe('cursor')
    expect(provider.name).toBe('Cursor IDE')
  })

  it('lists models', () => {
    expect(provider.models.length).toBeGreaterThan(0)
  })

  it('estimates cost (flat rate estimate)', () => {
    const cost = provider.estimateCost('default', { input: 1000, output: 500 })
    expect(cost).toBeGreaterThanOrEqual(0)
  })

  it('builds correct args', () => {
    const args = (provider as any).buildArgs('Fix the bug', 'default')
    expect(args).toContain('--prompt')
    expect(args.some((a: string) => a.includes('Fix the bug'))).toBe(true)
  })
})
