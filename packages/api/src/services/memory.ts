import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { EmbeddingRegistry } from './embeddings.js'
import { topKSimilar } from './similarity.js'
import { toCamelCase } from '../utils/case.js'
import type { AgentMemoryEntry, MemoryStats, MemoryType } from '@gaud/shared'

interface StoreOpts {
  agentId: string
  type: MemoryType
  content: string
  metadata: Record<string, unknown>
  tags: string[]
}

interface SearchOpts {
  agentId?: string
  type?: MemoryType
  limit?: number
  minSimilarity?: number
}

interface ListOpts {
  type?: MemoryType
  limit?: number
}

export class AgentMemory {
  constructor(
    private db: Database.Database,
    private embeddings: EmbeddingRegistry,
  ) {}

  async store(opts: StoreOpts): Promise<AgentMemoryEntry> {
    const id = randomUUID()
    const now = new Date().toISOString()

    const embedder = this.embeddings.getOrFallback(this.getAgentProvider(opts.agentId))
    const embedding = await embedder.generate(opts.content)
    const embeddingBlob = Buffer.from(new Float64Array(embedding).buffer)

    this.db.prepare(`
      INSERT INTO agent_memories (id, agent_id, type, content, metadata_json, tags, embedding, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, opts.agentId, opts.type, opts.content,
      JSON.stringify(opts.metadata), JSON.stringify(opts.tags),
      embeddingBlob, now, now,
    )

    return this.getById(id)!
  }

  async search(query: string, opts: SearchOpts = {}): Promise<Array<AgentMemoryEntry & { similarity: number }>> {
    const { agentId, type, limit = 5, minSimilarity = 0.3 } = opts

    const embedder = this.embeddings.getOrFallback(agentId ? this.getAgentProvider(agentId) : null)
    const queryEmbedding = await embedder.generate(query)

    let sql = 'SELECT * FROM agent_memories WHERE embedding IS NOT NULL'
    const params: unknown[] = []
    if (agentId) { sql += ' AND agent_id = ?'; params.push(agentId) }
    if (type) { sql += ' AND type = ?'; params.push(type) }

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>

    const entries = rows.map((row) => ({
      ...row,
      id: row['id'] as string,
      embedding: Array.from(new Float64Array(
        (row['embedding'] as Buffer).buffer,
        (row['embedding'] as Buffer).byteOffset,
        (row['embedding'] as Buffer).byteLength / 8,
      )),
    }))

    const results = topKSimilar(queryEmbedding, entries, limit, minSimilarity)

    return results.map((r) => {
      const { embedding: _emb, similarity, ...rest } = r
      return { ...this.parseRow(rest as Record<string, unknown>), similarity } as AgentMemoryEntry & { similarity: number }
    })
  }

  listForAgent(agentId: string, opts: ListOpts = {}): AgentMemoryEntry[] {
    let sql = 'SELECT id, agent_id, type, content, metadata_json, tags, relevance_score, created_at, updated_at FROM agent_memories WHERE agent_id = ?'
    const params: unknown[] = [agentId]
    if (opts.type) { sql += ' AND type = ?'; params.push(opts.type) }
    sql += ' ORDER BY created_at DESC'
    if (opts.limit) { sql += ' LIMIT ?'; params.push(opts.limit) }

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>
    return rows.map((row) => this.parseRow(row))
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM agent_memories WHERE id = ?').run(id)
  }

  startSession(agentId: string, conversationId: string | null): string {
    const id = randomUUID()
    this.db.prepare('INSERT INTO memory_sessions (id, agent_id, conversation_id) VALUES (?, ?, ?)')
      .run(id, agentId, conversationId)
    return id
  }

  endSession(sessionId: string): void {
    this.db.prepare("UPDATE memory_sessions SET ended_at = datetime('now') WHERE id = ?").run(sessionId)
  }

  getStats(): MemoryStats {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM agent_memories').get() as Record<string, unknown>)['c'] as number
    const byTypeRows = this.db.prepare('SELECT type, COUNT(*) as c FROM agent_memories GROUP BY type').all() as Array<Record<string, unknown>>
    const byAgentRows = this.db.prepare('SELECT agent_id, COUNT(*) as c FROM agent_memories GROUP BY agent_id').all() as Array<Record<string, unknown>>

    const byType: Record<string, number> = {}
    for (const row of byTypeRows) byType[row['type'] as string] = row['c'] as number
    const byAgent: Record<string, number> = {}
    for (const row of byAgentRows) byAgent[row['agent_id'] as string] = row['c'] as number

    return { totalMemories: total, byType: byType as MemoryStats['byType'], byAgent }
  }

  private getById(id: string): AgentMemoryEntry | null {
    const row = this.db.prepare('SELECT id, agent_id, type, content, metadata_json, tags, relevance_score, created_at, updated_at FROM agent_memories WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? this.parseRow(row) : null
  }

  private parseRow(row: Record<string, unknown>): AgentMemoryEntry {
    return {
      ...toCamelCase<AgentMemoryEntry>(row),
      metadataJson: JSON.parse(row['metadata_json'] as string ?? '{}'),
      tags: JSON.parse(row['tags'] as string ?? '[]'),
    }
  }

  private getAgentProvider(agentId: string): string | null {
    const agent = this.db.prepare('SELECT provider_id FROM agents WHERE id = ?').get(agentId) as Record<string, unknown> | undefined
    return (agent?.['provider_id'] as string) ?? null
  }
}
