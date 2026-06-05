import { describe, it, expect } from 'vitest'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'

describe('toCamelCase', () => {
  it('converts snake_case keys to camelCase', () => {
    const row = { parent_agent_id: '123', cost_limit_usd: 50, created_at: '2026-01-01' }
    const result = toCamelCase<{ parentAgentId: string; costLimitUsd: number; createdAt: string }>(row)
    expect(result.parentAgentId).toBe('123')
    expect(result.costLimitUsd).toBe(50)
    expect(result.createdAt).toBe('2026-01-01')
  })

  it('preserves already camelCase keys', () => {
    const row = { id: '1', name: 'test' }
    const result = toCamelCase<{ id: string; name: string }>(row)
    expect(result.id).toBe('1')
    expect(result.name).toBe('test')
  })
})

describe('toCamelCaseArray', () => {
  it('converts array of rows', () => {
    const rows = [
      { agent_id: '1', skill_id: 's1' },
      { agent_id: '2', skill_id: 's2' },
    ]
    const result = toCamelCaseArray<{ agentId: string; skillId: string }>(rows)
    expect(result).toHaveLength(2)
    expect(result[0]!.agentId).toBe('1')
  })
})
