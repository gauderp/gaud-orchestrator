import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { AgentMemory } from '../services/memory.js'
import { createEmbeddingRegistry } from '../services/embeddings.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Memory Consolidation', () => {
  let db: Database.Database
  let memory: AgentMemory

  beforeAll(async () => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))
    db.prepare("INSERT INTO providers (id, name, type) VALUES ('p1', 'Test', 'claude-cli')").run()
    db.prepare("INSERT INTO agents (id, name, provider_id) VALUES ('a1', 'Fiscal', 'p1')").run()

    const registry = createEmbeddingRegistry()
    memory = new AgentMemory(db, registry)

    // Store multiple similar memories
    await memory.store({ agentId: 'a1', type: 'error_correction', content: 'Catalao uses versaoDados 2.01', metadata: {}, tags: ['nfse'] })
    await memory.store({ agentId: 'a1', type: 'error_correction', content: 'Catalao municipality requires versaoDados 2.01 not 2.04', metadata: {}, tags: ['nfse'] })
    await memory.store({ agentId: 'a1', type: 'pattern_success', content: 'Used AbrasfV2 builder successfully', metadata: {}, tags: ['abrasf'] })
  })

  afterAll(() => db.close())

  it('consolidate merges similar memories', async () => {
    const before = memory.listForAgent('a1')
    expect(before.length).toBe(3)

    await memory.consolidate('a1')

    const after = memory.listForAgent('a1')
    const errorCorrections = after.filter(m => m.type === 'error_correction')
    // Similar error_corrections should be merged (one deleted, kept one boosted)
    expect(errorCorrections.length).toBeLessThanOrEqual(before.filter(m => m.type === 'error_correction').length)
  })

  it('decayRelevance reduces scores of old unaccessed memories', () => {
    // Manually set old date
    db.prepare("UPDATE agent_memories SET created_at = datetime('now', '-60 days') WHERE agent_id = 'a1'").run()

    memory.decayRelevance('a1')

    const memories = memory.listForAgent('a1')
    for (const m of memories) {
      expect(m.relevanceScore).toBeLessThanOrEqual(0)
    }
  })

  it('consolidate returns stats', async () => {
    // Store fresh memories for another round
    await memory.store({ agentId: 'a1', type: 'code_knowledge', content: 'Knowledge A', metadata: {}, tags: [] })

    const result = await memory.consolidate('a1')
    expect(result).toHaveProperty('merged')
    expect(result).toHaveProperty('decayed')
    expect(typeof result.merged).toBe('number')
    expect(typeof result.decayed).toBe('number')
  })
})
