import { ZipArchive } from 'archiver'
import AdmZip from 'adm-zip'
import { getDb } from '../db/connection.js'
import { runMigrations } from '../db/migrate.js'
import { existsSync, mkdirSync, rmSync, readdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

const TABLE_ORDER = [
  'users', 'setup_state',
  'providers', 'agents', 'skills', 'agent_skills', 'boards', 'columns', 'repositories',
  'cards', 'card_dependencies', 'card_repos', 'card_comments', 'card_attachments',
  'specs', 'spec_reviews', 'spec_repos', 'executions', 'execution_tasks', 'execution_logs', 'execution_gaps',
  'conversations', 'conversation_participants', 'messages',
  'agent_cost_log', 'agent_memories', 'memory_sessions', 'agent_reviews',
  'bug_reports', 'bug_report_attachments',
] as const

export interface Manifest {
  version: string
  createdAt: string
  appVersion: string
  includesRepos: boolean
  tables: Record<string, number>
  attachmentCount: number
  agentFileCount: number
}

export interface RestoreResult {
  status: 'ok'
  tables: Record<string, number>
  restoredAt: string
}

function getAgentsDir(): string {
  return resolve(process.env['AGENTS_DIR'] ?? 'agents')
}

function getAttachmentsDir(): string {
  return resolve(process.env['ATTACHMENTS_DIR'] ?? 'data/attachments')
}

function getReposDir(): string {
  return resolve(process.env['REPOS_DIR'] ?? 'data/repos')
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0
  let count = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) count++
    else if (entry.isDirectory()) count += countFiles(join(dir, entry.name))
  }
  return count
}

export class BackupService {
  async generateBackup(includeRepos: boolean): Promise<Buffer> {
    const db = getDb()

    // Checkpoint WAL before export
    db.pragma('wal_checkpoint(TRUNCATE)')

    // Export all tables as JSON
    const databaseExport: Record<string, unknown[]> = {}
    for (const table of TABLE_ORDER) {
      try {
        const rows = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
        // Convert BLOB fields to base64
        databaseExport[table] = rows.map(row => {
          const processed: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(row)) {
            if (Buffer.isBuffer(value)) {
              processed[key] = { __type: 'buffer', data: value.toString('base64') }
            } else {
              processed[key] = value
            }
          }
          return processed
        })
      } catch {
        // Table may not exist yet (migration not applied)
        databaseExport[table] = []
      }
    }

    const agentsDir = getAgentsDir()
    const attachmentsDir = getAttachmentsDir()
    const reposDir = getReposDir()

    // Build manifest
    const manifest: Manifest = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      appVersion: '0.1.0',
      includesRepos: includeRepos,
      tables: Object.fromEntries(
        TABLE_ORDER.map(t => [t, databaseExport[t]?.length ?? 0])
      ),
      attachmentCount: countFiles(attachmentsDir),
      agentFileCount: countFiles(agentsDir),
    }

    // Create ZIP
    return new Promise<Buffer>((resolvePromise, reject) => {
      const archive = new ZipArchive({ level: 6 })
      const chunks: Buffer[] = []

      archive.on('data', (chunk: Buffer) => chunks.push(chunk))
      archive.on('end', () => resolvePromise(Buffer.concat(chunks)))
      archive.on('error', reject)

      // Add manifest
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })

      // Add database export
      archive.append(JSON.stringify(databaseExport, null, 2), { name: 'database.json' })

      // Add agents directory
      if (existsSync(agentsDir)) {
        archive.directory(agentsDir, 'agents')
      }

      // Add attachments directory
      if (existsSync(attachmentsDir)) {
        archive.directory(attachmentsDir, 'attachments')
      }

      // Optionally add repos
      if (includeRepos && existsSync(reposDir)) {
        archive.directory(reposDir, 'repos')
      }

      archive.finalize()
    })
  }

  async restoreBackup(zipBuffer: Buffer): Promise<RestoreResult> {
    const zip = new AdmZip(zipBuffer)

    // Validate manifest
    const manifestEntry = zip.getEntry('manifest.json')
    if (!manifestEntry) {
      throw new Error('Invalid backup file: missing manifest.json')
    }
    const manifest: Manifest = JSON.parse(manifestEntry.getData().toString('utf-8'))
    if (manifest.version !== '1.0') {
      throw new Error(`Backup version ${manifest.version} not supported`)
    }

    // Parse database export
    const dbEntry = zip.getEntry('database.json')
    if (!dbEntry) {
      throw new Error('Invalid backup file: missing database.json')
    }
    const databaseExport: Record<string, Record<string, unknown>[]> = JSON.parse(
      dbEntry.getData().toString('utf-8')
    )

    const db = getDb()

    // Disable foreign keys for restore
    db.pragma('foreign_keys = OFF')

    try {
      // Drop all tables
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
      ).all() as { name: string }[]

      for (const { name } of tables) {
        db.exec(`DROP TABLE IF EXISTS "${name}"`)
      }

      // Re-run migrations to recreate schema
      runMigrations()

      // Insert data in dependency order
      const counts: Record<string, number> = {}
      for (const table of TABLE_ORDER) {
        const rows = databaseExport[table]
        if (!rows || rows.length === 0) {
          counts[table] = 0
          continue
        }

        // Get column names from first row
        const columns = Object.keys(rows[0]!)
        const placeholders = columns.map(() => '?').join(', ')
        const columnNames = columns.map(c => `"${c}"`).join(', ')
        const insert = db.prepare(
          `INSERT INTO "${table}" (${columnNames}) VALUES (${placeholders})`
        )

        const insertMany = db.transaction((rowsToInsert: Record<string, unknown>[]) => {
          for (const row of rowsToInsert) {
            const values = columns.map(col => {
              const val = row[col]
              // Restore buffers from base64
              if (val && typeof val === 'object' && (val as any).__type === 'buffer') {
                return Buffer.from((val as any).data, 'base64')
              }
              return val
            })
            insert.run(...values)
          }
        })

        insertMany(rows)
        counts[table] = rows.length
      }

      // Restore agents directory
      const agentsDir = getAgentsDir()
      if (existsSync(agentsDir)) {
        rmSync(agentsDir, { recursive: true, force: true })
      }
      mkdirSync(agentsDir, { recursive: true })
      for (const entry of zip.getEntries()) {
        if (entry.entryName.startsWith('agents/') && !entry.isDirectory) {
          const relativePath = entry.entryName.slice('agents/'.length)
          const targetPath = join(agentsDir, relativePath)
          mkdirSync(join(targetPath, '..'), { recursive: true })
          const data = entry.getData()
          writeFileSync(targetPath, data)
        }
      }

      // Restore attachments directory
      const attachmentsDir = getAttachmentsDir()
      if (existsSync(attachmentsDir)) {
        rmSync(attachmentsDir, { recursive: true, force: true })
      }
      mkdirSync(attachmentsDir, { recursive: true })
      for (const entry of zip.getEntries()) {
        if (entry.entryName.startsWith('attachments/') && !entry.isDirectory) {
          const relativePath = entry.entryName.slice('attachments/'.length)
          const targetPath = join(attachmentsDir, relativePath)
          mkdirSync(join(targetPath, '..'), { recursive: true })
          const data = entry.getData()
          writeFileSync(targetPath, data)
        }
      }

      // Restore repos if present
      if (manifest.includesRepos) {
        const reposDir = getReposDir()
        if (existsSync(reposDir)) {
          rmSync(reposDir, { recursive: true, force: true })
        }
        mkdirSync(reposDir, { recursive: true })
        for (const entry of zip.getEntries()) {
          if (entry.entryName.startsWith('repos/') && !entry.isDirectory) {
            const relativePath = entry.entryName.slice('repos/'.length)
            const targetPath = join(reposDir, relativePath)
            mkdirSync(join(targetPath, '..'), { recursive: true })
            writeFileSync(targetPath, entry.getData())
          }
        }
      }

      return {
        status: 'ok',
        tables: counts,
        restoredAt: new Date().toISOString(),
      }
    } finally {
      db.pragma('foreign_keys = ON')
    }
  }

  async previewBackup(zipBuffer: Buffer): Promise<Manifest> {
    const zip = new AdmZip(zipBuffer)
    const manifestEntry = zip.getEntry('manifest.json')
    if (!manifestEntry) {
      throw new Error('Invalid backup file: missing manifest.json')
    }
    return JSON.parse(manifestEntry.getData().toString('utf-8'))
  }
}
