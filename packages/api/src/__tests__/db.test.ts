import { describe, it, expect, afterAll } from 'vitest'
import Database from 'better-sqlite3'

describe('SQLite migrations', () => {
  const db = new Database(':memory:')

  afterAll(() => db.close())

  it('creates all tables from migration SQL', async () => {
    const { readFileSync } = await import('fs')
    const { join, dirname } = await import('path')
    const { fileURLToPath } = await import('url')
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const sql = readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8')

    db.pragma('foreign_keys = ON')
    db.exec(sql)

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>

    const tableNames = tables.map(t => t.name)
    expect(tableNames).toContain('agents')
    expect(tableNames).toContain('boards')
    expect(tableNames).toContain('cards')
    expect(tableNames).toContain('columns')
    expect(tableNames).toContain('skills')
    expect(tableNames).toContain('specs')
    expect(tableNames).toContain('executions')
    expect(tableNames).toContain('providers')
    expect(tableNames).toContain('conversations')
    expect(tableNames).toContain('messages')
    expect(tableNames).toContain('agent_memories')
    expect(tableNames).toContain('memory_sessions')
  })

  it('enforces foreign keys', () => {
    expect(() => {
      db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('c1', 'nonexistent', 'col1', 'task', 'Test')").run()
    }).toThrow()
  })
})
