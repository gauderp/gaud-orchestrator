import { readFileSync, existsSync } from 'fs'
import { extname } from 'path'
import type Database from 'better-sqlite3'
import { LocalFileStorage } from './file-storage.js'

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.ts', '.tsx', '.js', '.jsx', '.java', '.py', '.sql',
  '.html', '.css', '.sh', '.env', '.toml', '.ini', '.cfg',
])
const MAX_TEXT_SIZE = 8000

export interface AttachmentContent {
  filename: string
  content: string
  type: 'text' | 'path'
}

export function readCardAttachments(db: Database.Database, cardId: string): AttachmentContent[] {
  const attachmentsDir = process.env['ATTACHMENTS_DIR'] ?? 'data/attachments'
  const storage = new LocalFileStorage(attachmentsDir)

  const rows = db.prepare('SELECT filename, path FROM card_attachments WHERE card_id = ?').all(cardId) as any[]
  const result: AttachmentContent[] = []

  for (const row of rows) {
    const ext = extname(row.filename).toLowerCase()
    const absPath = storage.getAbsolutePath(cardId, row.filename)

    if (TEXT_EXTENSIONS.has(ext) && existsSync(absPath)) {
      try {
        const content = readFileSync(absPath, 'utf-8')
        if (content.length <= MAX_TEXT_SIZE) {
          result.push({ filename: row.filename, content, type: 'text' })
        } else {
          result.push({
            filename: row.filename,
            content: content.substring(0, MAX_TEXT_SIZE) + `\n\n[... truncated, full file at: ${absPath}]`,
            type: 'text',
          })
        }
      } catch {
        result.push({ filename: row.filename, content: absPath, type: 'path' })
      }
    } else {
      result.push({ filename: row.filename, content: absPath, type: 'path' })
    }
  }

  return result
}
