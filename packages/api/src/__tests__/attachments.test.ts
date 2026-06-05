import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import { attachmentRoutes } from '../routes/attachments.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TMP = join(tmpdir(), 'attachments-test-' + Date.now())

describe('Attachments API', () => {
  const app = Fastify()
  let db: Database.Database

  beforeAll(async () => {
    mkdirSync(TMP, { recursive: true })
    process.env['ATTACHMENTS_DIR'] = TMP

    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))

    // Seed data
    db.prepare("INSERT INTO boards (id, name) VALUES ('b1', 'Sprint')").run()
    db.prepare("INSERT INTO columns (id, board_id, name, position) VALUES ('c1', 'b1', 'Backlog', 0)").run()
    db.prepare("INSERT INTO cards (id, board_id, column_id, type, title) VALUES ('card1', 'b1', 'c1', 'task', 'Task 1')").run()

    app.decorate('db', db)
    await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })
    await app.register(attachmentRoutes)
    await app.ready()
  })

  afterAll(async () => {
    delete process.env['ATTACHMENTS_DIR']
    await app.close()
    db.close()
    rmSync(TMP, { recursive: true, force: true })
  })

  it('uploads a file', async () => {
    const boundary = '----TestBoundary'
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="hello.txt"',
      'Content-Type: text/plain',
      '',
      'hello world',
      `--${boundary}--`,
    ].join('\r\n')

    const res = await app.inject({
      method: 'POST',
      url: '/api/cards/card1/attachments',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    })
    expect(res.statusCode).toBe(201)
    const data = JSON.parse(res.payload)
    expect(data.filename).toBe('hello.txt')
    expect(data.cardId).toBe('card1')
  })

  it('lists attachments', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cards/card1/attachments' })
    expect(res.statusCode).toBe(200)
    const data = JSON.parse(res.payload)
    expect(data).toHaveLength(1)
    expect(data[0].filename).toBe('hello.txt')
  })

  it('downloads a file', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cards/card1/attachments/hello.txt' })
    expect(res.statusCode).toBe(200)
    expect(res.payload).toBe('hello world')
  })

  it('returns 404 for missing file', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cards/card1/attachments/nope.txt' })
    expect(res.statusCode).toBe(404)
  })

  it('deletes a file', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/cards/card1/attachments/hello.txt' })
    expect(res.statusCode).toBe(204)

    const list = await app.inject({ method: 'GET', url: '/api/cards/card1/attachments' })
    expect(JSON.parse(list.payload)).toHaveLength(0)
  })
})
