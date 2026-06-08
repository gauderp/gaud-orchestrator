import type { FastifyInstance } from 'fastify'
import { BackupService } from '../services/BackupService.js'

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  const backupService = new BackupService()

  // GET /api/backup — generate and download ZIP
  app.get<{ Querystring: { includeRepos?: string } }>('/api/backup', async (req, reply) => {
    const includeRepos = req.query.includeRepos === 'true'
    try {
      const buffer = await backupService.generateBackup(includeRepos)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      return reply
        .type('application/zip')
        .header('Content-Disposition', `attachment; filename=backup-${timestamp}.zip`)
        .send(buffer)
    } catch (err: any) {
      app.log.error(err, 'Backup generation failed')
      return reply.status(500).send({ error: err.message })
    }
  })

  // POST /api/backup/restore — upload ZIP and restore
  app.post('/api/backup/restore', async (req, reply) => {
    try {
      const data = await req.file({ limits: { fileSize: 500 * 1024 * 1024 } })
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }
      const buffer = await data.toBuffer()
      const result = await backupService.restoreBackup(buffer)
      return reply.send(result)
    } catch (err: any) {
      app.log.error(err, 'Backup restore failed')
      return reply.status(500).send({ error: err.message })
    }
  })

  // POST /api/backup/preview — upload ZIP, return manifest
  app.post('/api/backup/preview', async (req, reply) => {
    try {
      const data = await req.file({ limits: { fileSize: 500 * 1024 * 1024 } })
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' })
      }
      const buffer = await data.toBuffer()
      const manifest = await backupService.previewBackup(buffer)
      return reply.send(manifest)
    } catch (err: any) {
      app.log.error(err, 'Backup preview failed')
      return reply.status(500).send({ error: err.message })
    }
  })
}
