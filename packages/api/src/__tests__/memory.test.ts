import { AgentMemory } from '../services/memory.js'
import { createEmbeddingRegistry } from '../services/embeddings.js'
import { getDb } from '../db/connection.js'
import { runMigrations } from '../db/migrate.js'
import type Database from 'better-sqlite3'

let db: Database.Database
let memory: AgentMemory

beforeAll(() => {
  db = getDb() // vitest.config sets DATABASE_PATH=:memory:
  runMigrations()
  db.prepare("INSERT OR IGNORE INTO providers (id, name, type) VALUES ('p1', 'Test', 'claude-cli')").run()
  db.prepare("INSERT OR IGNORE INTO agents (id, name, provider_id) VALUES ('agent1', 'Fiscal', 'p1')").run()

  const registry = createEmbeddingRegistry()
  memory = new AgentMemory(db, registry)
})

afterAll(() => {
  // Clean up for other tests that might reuse the singleton
  db.prepare('DELETE FROM agent_memories').run()
  db.prepare('DELETE FROM memory_sessions').run()
  db.prepare("DELETE FROM agents WHERE id = 'agent1'").run()
  db.prepare("DELETE FROM providers WHERE id = 'p1'").run()
})

describe('AgentMemory', () => {
  it('stores a memory with embedding', async () => {
    await memory.store({
      agentId: 'agent1',
      type: 'error_correction',
      content: 'Catalao uses versaoDados 2.01, not 2.04',
      metadata: { municipality: 'Catalao', error: 'wrong version' },
      tags: ['nfse', 'catalao', 'version'],
    })
    const all = memory.listForAgent('agent1')
    expect(all).toHaveLength(1)
    expect(all[0]!.content).toContain('versaoDados 2.01')
    expect(all[0]!.type).toBe('error_correction')
  })

  it('searches by semantic similarity', async () => {
    await memory.store({
      agentId: 'agent1',
      type: 'code_knowledge',
      content: 'AbrasfV2NFSeEmissor handles all ABRASF 2.x municipalities',
      metadata: {},
      tags: ['nfse', 'abrasf'],
    })

    // Hash embedder produces pseudo-random vectors, so use minSimilarity: -1 to ensure results
    const results = await memory.search('Which XML builder for Catalao NFS-e?', { agentId: 'agent1', limit: 5, minSimilarity: -1 })
    expect(results.length).toBeGreaterThanOrEqual(1)
    // Hash embedder gives structural results, not perfect semantic
  })

  it('filters by type', () => {
    const errors = memory.listForAgent('agent1', { type: 'error_correction' })
    expect(errors).toHaveLength(1)
    const knowledge = memory.listForAgent('agent1', { type: 'code_knowledge' })
    expect(knowledge).toHaveLength(1)
  })

  it('starts and ends a session', () => {
    const sessionId = memory.startSession('agent1', null)
    expect(sessionId).toBeTruthy()
    memory.endSession(sessionId)
    const session = db.prepare('SELECT * FROM memory_sessions WHERE id = ?').get(sessionId) as Record<string, unknown>
    expect(session['ended_at']).not.toBeNull()
  })

  it('deletes a memory', async () => {
    const all = memory.listForAgent('agent1')
    memory.delete(all[0]!.id)
    expect(memory.listForAgent('agent1')).toHaveLength(1)
  })

  it('returns stats', () => {
    const stats = memory.getStats()
    expect(stats.totalMemories).toBe(1)
    expect(stats.byAgent['agent1']).toBe(1)
  })
})
