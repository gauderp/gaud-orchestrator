import { getDb } from './connection.js'
import { readFileSync, readdirSync, existsSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function runMigrations(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r: any) => r.name)
  )

  const migrationsDir = join(__dirname, 'migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  const pending = files.filter(f => !applied.has(f))
  if (pending.length === 0) return

  backupDatabase(db)

  for (const file of pending) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    db.exec(sql)
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    console.log(`Migration applied: ${file}`)
  }
}

// Snapshot the SQLite file before applying pending migrations, so destructive
// migrations (table rebuilds, drops) can be rolled back by restoring the copy.
function backupDatabase(db: ReturnType<typeof getDb>): void {
  const dbPath = process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'orchestrator.db')
  if (dbPath === ':memory:' || !existsSync(dbPath)) return

  // Fold the WAL into the main file so the copy is complete
  db.pragma('wal_checkpoint(TRUNCATE)')

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = `${dbPath}.${stamp}.bak`
  copyFileSync(dbPath, backupPath)
  console.log(`Database backed up to: ${backupPath}`)
}
