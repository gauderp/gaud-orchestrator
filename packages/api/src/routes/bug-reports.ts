import type { FastifyInstance } from 'fastify'
import { BugTriageService } from '../services/bug-triage.js'
import { LocalFileStorage } from '../services/file-storage.js'
import { randomUUID } from 'crypto'

export async function bugReportRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const providerRegistry = (app as any).providerRegistry
  const triage = new BugTriageService(db)
  const attachmentsDir = process.env['ATTACHMENTS_DIR'] ?? 'data/attachments'
  const storage = new LocalFileStorage(attachmentsDir)

  // List bug reports (optional status filter)
  app.get<{ Querystring: { status?: string } }>('/api/bug-reports', async (req, reply) => {
    const reports = triage.listReports(req.query.status)
    return reply.send(reports)
  })

  // Get bug report with attachments
  app.get<{ Params: { id: string } }>('/api/bug-reports/:id', async (req, reply) => {
    const report = triage.getReport(req.params.id)
    if (!report) return reply.status(404).send({ error: 'Bug report not found' })
    return reply.send(report)
  })

  // Create bug report (multipart for file uploads)
  app.post('/api/bug-reports', async (req, reply) => {
    const parts = req.parts()
    const fields: Record<string, string> = {}
    const attachments: Array<{ filename: string; path: string; fileType?: string }> = []

    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer()
        const reportId = randomUUID()
        const relativePath = await storage.save(`bugs-${reportId}`, part.filename, buffer)
        const fileType = part.filename.match(/\.(png|jpg|jpeg|gif|webp)$/i) ? 'screenshot'
          : part.filename.match(/\.(log|txt)$/i) ? 'log'
          : part.filename.match(/\.(mp4|webm|mov)$/i) ? 'video'
          : 'other'
        attachments.push({
          filename: part.filename,
          path: `${attachmentsDir}/${relativePath}`,
          fileType,
        })
      } else {
        fields[part.fieldname] = (part as any).value
      }
    }

    if (!fields['title'] || !fields['description']) {
      return reply.status(400).send({ error: 'Title and description are required' })
    }

    const report = triage.createReport({
      title: fields['title'],
      description: fields['description'],
      reporterName: fields['reporterName'],
      reporterEmail: fields['reporterEmail'],
      source: fields['source'] as any ?? 'ui',
      attachments,
    })

    return reply.status(201).send(report)
  })

  // Trigger triage
  app.post<{ Params: { id: string } }>('/api/bug-reports/:id/triage', async (req, reply) => {
    const { agentId } = req.body as { agentId: string }
    if (!agentId) return reply.status(400).send({ error: 'agentId is required' })

    const report = triage.getReport(req.params.id)
    if (!report) return reply.status(404).send({ error: 'Bug report not found' })

    // Run triage in background (don't block the response)
    triage.startTriage(req.params.id, agentId, providerRegistry).catch(err => {
      console.error('Triage error:', err)
    })

    return reply.send({ status: 'triaging', id: req.params.id })
  })

  // Respond to agent's questions (for needs_info reports)
  app.post<{ Params: { id: string } }>('/api/bug-reports/:id/respond', async (req, reply) => {
    const { content } = req.body as { content: string }
    if (!content) return reply.status(400).send({ error: 'Content is required' })

    const report = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(req.params.id) as any
    if (!report) return reply.status(404).send({ error: 'Bug report not found' })
    if (!report.conversation_id) return reply.status(400).send({ error: 'No triage conversation' })

    // Add user response to conversation
    db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), report.conversation_id, 'user', content, 'content')

    // Resume conversation
    db.prepare("UPDATE conversations SET status = 'active', updated_at = datetime('now') WHERE id = ?")
      .run(report.conversation_id)

    // Re-run triage turn
    const { runConversationTurn } = await import('../services/conversation-runner.js')
    try {
      const result = await runConversationTurn(db, report.conversation_id, providerRegistry)
      const response = (result.message as any)?.content ?? ''

      if (response.includes('[TRIAGED]')) {
        const severityMatch = response.match(/Severity:\s*(critical|high|medium|low)/i)
        db.prepare(`
          UPDATE bug_reports SET status = 'triaged', severity = ?, triage_summary = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(severityMatch?.[1]?.toLowerCase() ?? 'medium', response, req.params.id)
      } else if (response.includes('[NEEDS_INFO]')) {
        db.prepare("UPDATE bug_reports SET triage_summary = ?, updated_at = datetime('now') WHERE id = ?")
          .run(response, req.params.id)
      } else if (response.includes('[REJECTED]')) {
        db.prepare("UPDATE bug_reports SET status = 'rejected', triage_summary = ?, updated_at = datetime('now') WHERE id = ?")
          .run(response, req.params.id)
      }
    } catch (err) {
      console.error('Respond triage failed:', err)
    }

    return reply.send({ status: 'ok' })
  })

  // Create bug card from triaged report
  app.post<{ Params: { id: string } }>('/api/bug-reports/:id/create-card', async (req, reply) => {
    const { boardId, columnId } = req.body as { boardId: string; columnId: string }
    if (!boardId || !columnId) return reply.status(400).send({ error: 'boardId and columnId are required' })

    try {
      const card = triage.createBugCard(req.params.id, boardId, columnId)
      return reply.status(201).send(card)
    } catch (err: any) {
      return reply.status(404).send({ error: err.message })
    }
  })

  // Delete bug report
  app.delete<{ Params: { id: string } }>('/api/bug-reports/:id', async (req, reply) => {
    const report = db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(req.params.id)
    if (!report) return reply.status(404).send({ error: 'Bug report not found' })

    db.prepare('DELETE FROM bug_report_attachments WHERE bug_report_id = ?').run(req.params.id)
    db.prepare('DELETE FROM bug_reports WHERE id = ?').run(req.params.id)
    return reply.status(204).send()
  })
}
