import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { broadcast } from '../ws/broadcast.js'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'

export class BugTriageService {
  constructor(private db: Database.Database) {}

  createReport(data: {
    title: string
    description: string
    reporterName?: string
    reporterEmail?: string
    source?: string
    attachments?: Array<{ filename: string; path: string; fileType?: string }>
  }): Record<string, unknown> {
    const id = randomUUID()
    const now = new Date().toISOString()

    this.db.prepare(`
      INSERT INTO bug_reports (id, title, description, reporter_name, reporter_email, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.title, data.description, data.reporterName ?? null,
      data.reporterEmail ?? null, data.source ?? 'ui', now, now)

    if (data.attachments) {
      const insert = this.db.prepare(
        'INSERT INTO bug_report_attachments (id, bug_report_id, filename, path, file_type) VALUES (?, ?, ?, ?, ?)'
      )
      for (const att of data.attachments) {
        insert.run(randomUUID(), id, att.filename, att.path, att.fileType ?? null)
      }
    }

    const report = toCamelCase(this.db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(id) as any) as Record<string, unknown>
    broadcast('bug_report:created', report)
    return report
  }

  async startTriage(
    reportId: string,
    triageAgentId: string,
    providerRegistry: any,
  ): Promise<void> {
    const report = this.db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(reportId) as any
    if (!report) throw new Error('Bug report not found')

    this.db.prepare("UPDATE bug_reports SET status = 'triaging', updated_at = datetime('now') WHERE id = ?")
      .run(reportId)

    const attachments = this.db.prepare('SELECT * FROM bug_report_attachments WHERE bug_report_id = ?')
      .all(reportId) as any[]

    const { readFileSync, existsSync } = await import('fs')
    const attachmentContext = attachments.map(att => {
      if (existsSync(att.path)) {
        try {
          const content = readFileSync(att.path, 'utf-8')
          if (content.length < 8000) return `### ${att.filename}\n\`\`\`\n${content}\n\`\`\``
          return `### ${att.filename}\n\`\`\`\n${content.substring(0, 8000)}\n[truncated]\n\`\`\``
        } catch {
          return `### ${att.filename}\n[Binary file at: ${att.path}]`
        }
      }
      return `### ${att.filename}\n[File at: ${att.path}]`
    }).join('\n\n')

    // Create triage conversation
    const convId = randomUUID()
    const now = new Date().toISOString()
    this.db.prepare('INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(convId, 'research', now, now)
    this.db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)')
      .run(convId, triageAgentId)

    this.db.prepare('UPDATE bug_reports SET conversation_id = ? WHERE id = ?').run(convId, reportId)

    const triagePrompt = `You are a bug triage agent. Analyze the following bug report from support and determine:

1. **Severity**: critical (production down), high (major feature broken), medium (feature partially broken), low (cosmetic/minor)
2. **Affected area**: which module/component/service is affected
3. **Steps to reproduce**: extract or infer from the report
4. **Root cause hypothesis**: based on the description and any logs/screenshots
5. **Missing information**: what else do you need to properly diagnose this

## Bug Report

**Title:** ${report.title}
**Reporter:** ${report.reporter_name ?? 'Unknown'} (${report.reporter_email ?? 'no email'})
**Reported at:** ${report.created_at}

**Description:**
${report.description}

${attachmentContext ? `## Attachments\n\n${attachmentContext}` : ''}

## Response Format

Respond with ONE of:

**If you have enough info to triage:**
[TRIAGED]
- Severity: critical|high|medium|low
- Area: <affected module>
- Steps to reproduce: <numbered list>
- Root cause: <hypothesis>
- Suggested fix: <brief approach>

**If you need more information from the reporter:**
[NEEDS_INFO]
- Question 1: <specific question>
- Question 2: <specific question>

**If this is not a valid bug report:**
[REJECTED]
- Reason: <why this is not a bug>`

    this.db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), convId, 'system', triagePrompt, 'content')

    broadcast('bug_report:triaging', { id: reportId, conversationId: convId })

    try {
      const { runConversationTurn } = await import('./conversation-runner.js')
      const result = await runConversationTurn(this.db, convId, providerRegistry)

      const response = (result.message as any)?.content ?? ''

      if (response.includes('[TRIAGED]')) {
        const severityMatch = response.match(/Severity:\s*(critical|high|medium|low)/i)
        this.db.prepare(`
          UPDATE bug_reports SET status = 'triaged', severity = ?, triage_summary = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(severityMatch?.[1]?.toLowerCase() ?? 'medium', response, reportId)
        broadcast('bug_report:triaged', { id: reportId, severity: severityMatch?.[1] })

      } else if (response.includes('[NEEDS_INFO]')) {
        this.db.prepare("UPDATE bug_reports SET status = 'needs_info', triage_summary = ?, updated_at = datetime('now') WHERE id = ?")
          .run(response, reportId)
        broadcast('bug_report:needs_info', { id: reportId })

      } else if (response.includes('[REJECTED]')) {
        this.db.prepare("UPDATE bug_reports SET status = 'rejected', triage_summary = ?, updated_at = datetime('now') WHERE id = ?")
          .run(response, reportId)
        broadcast('bug_report:rejected', { id: reportId })
      }
    } catch (err) {
      console.error('Triage failed:', err)
      this.db.prepare("UPDATE bug_reports SET status = 'new', updated_at = datetime('now') WHERE id = ?")
        .run(reportId)
    }
  }

  createBugCard(reportId: string, boardId: string, columnId: string): Record<string, unknown> {
    const report = this.db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(reportId) as any
    if (!report) throw new Error('Bug report not found')

    const cardId = randomUUID()
    const now = new Date().toISOString()
    const description = `## Original Report\n\n${report.description}\n\n## Triage Summary\n\n${report.triage_summary ?? 'No triage summary'}`

    const maxPos = this.db.prepare('SELECT MAX(position) as mp FROM cards WHERE column_id = ?').get(columnId) as any
    const position = (maxPos?.mp ?? -1) + 1

    this.db.prepare(`
      INSERT INTO cards (id, board_id, column_id, type, title, description, position, created_at, updated_at)
      VALUES (?, ?, ?, 'bug', ?, ?, ?, ?, ?)
    `).run(cardId, boardId, columnId, report.title, description, position, now, now)

    this.db.prepare('UPDATE bug_reports SET card_id = ?, updated_at = datetime("now") WHERE id = ?')
      .run(cardId, reportId)

    const card = toCamelCase(this.db.prepare('SELECT * FROM cards WHERE id = ?').get(cardId) as any) as Record<string, unknown>
    broadcast('card:created', card)
    return card
  }

  listReports(status?: string): Array<Record<string, unknown>> {
    let sql = 'SELECT * FROM bug_reports'
    const params: any[] = []
    if (status) { sql += ' WHERE status = ?'; params.push(status) }
    sql += ' ORDER BY created_at DESC'
    const rows = this.db.prepare(sql).all(...params) as any[]
    return toCamelCaseArray(rows)
  }

  getReport(id: string): Record<string, unknown> | null {
    const report = this.db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(id) as any
    if (!report) return null
    const attachments = this.db.prepare('SELECT * FROM bug_report_attachments WHERE bug_report_id = ?').all(id) as any[]
    return { ...toCamelCase(report), attachments: toCamelCaseArray(attachments) }
  }
}
