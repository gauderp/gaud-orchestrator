import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { LocalFileStorage } from '../services/file-storage.js'
import { toCamelCase } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'

export async function attachmentRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const attachmentsDir = process.env['ATTACHMENTS_DIR'] ?? 'data/attachments'
  const storage = new LocalFileStorage(attachmentsDir)

  // Upload attachment (multipart/form-data)
  app.post<{ Params: { id: string } }>('/api/cards/:id/attachments', async (req, reply) => {
    const file = await req.file()
    if (!file) return reply.status(400).send({ error: 'No file uploaded' })

    const buffer = await file.toBuffer()
    const filename = file.filename
    const relativePath = await storage.save(req.params.id, filename, buffer)

    const attachmentId = randomUUID()
    db.prepare('INSERT INTO card_attachments (id, card_id, filename, path) VALUES (?, ?, ?, ?)')
      .run(attachmentId, req.params.id, filename, relativePath)

    const attachment = toCamelCase(db.prepare('SELECT * FROM card_attachments WHERE id = ?').get(attachmentId) as any)
    broadcast('card:updated', { id: req.params.id })
    return reply.status(201).send(attachment)
  })

  // List attachments for a card
  app.get<{ Params: { id: string } }>('/api/cards/:id/attachments', async (req, reply) => {
    const attachments = db.prepare('SELECT * FROM card_attachments WHERE card_id = ? ORDER BY created_at')
      .all(req.params.id)
    return reply.send((attachments as any[]).map((a) => toCamelCase(a)))
  })

  // Download attachment
  app.get<{ Params: { id: string; filename: string } }>('/api/cards/:id/attachments/:filename', async (req, reply) => {
    try {
      const buffer = await storage.get(req.params.id, req.params.filename)
      return reply.header('Content-Disposition', `attachment; filename="${req.params.filename}"`).send(buffer)
    } catch {
      return reply.status(404).send({ error: 'File not found' })
    }
  })

  // Delete attachment
  app.delete<{ Params: { id: string; filename: string } }>('/api/cards/:id/attachments/:filename', async (req, reply) => {
    try {
      await storage.delete(req.params.id, req.params.filename)
    } catch { /* file may not exist on disk */ }
    db.prepare('DELETE FROM card_attachments WHERE card_id = ? AND filename = ?')
      .run(req.params.id, req.params.filename)
    return reply.status(204).send()
  })
}
