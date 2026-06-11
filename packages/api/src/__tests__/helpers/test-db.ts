import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, '..', '..', 'db', 'migrations')

/**
 * Create an in-memory database with ALL migrations applied in order —
 * the same schema a real instance has after boot, including the 3 fixed
 * boards (triage-board, spec-board, dev-board) created by migration 011.
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
  for (const file of files) {
    db.exec(readFileSync(join(migrationsDir, file), 'utf-8'))
  }
  db.pragma('foreign_keys = ON')
  return db
}
