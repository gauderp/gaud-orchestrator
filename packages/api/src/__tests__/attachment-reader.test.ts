import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Database from 'better-sqlite3'
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TMP = join(tmpdir(), 'attach-reader-' + Date.now())

describe('Attachment Reader', () => {
  let db: Database.Database

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))

    db.prepare("INSERT INTO boards (id, name) VALUES ('b1', 'Board')").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position) VALUES ('col1', 'b1', 'Col', 0)").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('c1', 'b1', 'col1', 'task', 'Card')").run()

    // Create temp attachments dir
    mkdirSync(join(TMP, 'c1'), { recursive: true })
    writeFileSync(join(TMP, 'c1', 'spec.md'), '# My Spec\n\nSome content here')
    writeFileSync(join(TMP, 'c1', 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    db.prepare("INSERT INTO card_attachments (id, card_id, filename, path) VALUES ('a1', 'c1', 'spec.md', 'c1/spec.md')").run()
    db.prepare("INSERT INTO card_attachments (id, card_id, filename, path) VALUES ('a2', 'c1', 'image.png', 'c1/image.png')").run()

    process.env['ATTACHMENTS_DIR'] = TMP
  })

  afterAll(() => {
    db.close()
    rmSync(TMP, { recursive: true, force: true })
    delete process.env['ATTACHMENTS_DIR']
  })

  it('reads text attachments inline', async () => {
    const { readCardAttachments } = await import('../services/attachment-reader.js')
    const attachments = readCardAttachments(db, 'c1')
    const spec = attachments.find(a => a.filename === 'spec.md')
    expect(spec).toBeDefined()
    expect(spec!.type).toBe('text')
    expect(spec!.content).toContain('# My Spec')
  })

  it('returns binary attachments as path', async () => {
    const { readCardAttachments } = await import('../services/attachment-reader.js')
    const attachments = readCardAttachments(db, 'c1')
    const img = attachments.find(a => a.filename === 'image.png')
    expect(img).toBeDefined()
    expect(img!.type).toBe('path')
    expect(img!.content).toContain('image.png')
  })

  it('returns empty array for cards with no attachments', async () => {
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('c2', 'b1', 'col1', 'task', 'Empty')").run()
    const { readCardAttachments } = await import('../services/attachment-reader.js')
    const attachments = readCardAttachments(db, 'c2')
    expect(attachments).toEqual([])
  })
})
