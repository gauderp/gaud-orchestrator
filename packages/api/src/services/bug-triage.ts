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
    const { resolve: resolvePath } = await import('path')
    const textFileTypes = new Set(['log', 'other'])
    const imageFileTypes = new Set(['screenshot'])
    const attachmentContext = attachments.map(att => {
      const absPath = resolvePath(att.path)
      if (!existsSync(absPath)) return `### ${att.filename}\n[File not found]`

      if (imageFileTypes.has(att.file_type ?? '')) {
        // Screenshots/images: include absolute path so the agent can use Read tool to view them
        return `### ${att.filename}\n[Screenshot — use Read tool to view: ${absPath}]`
      }

      if (textFileTypes.has(att.file_type ?? '')) {
        try {
          const content = readFileSync(absPath, 'utf-8')
          if (content.includes('\0')) return `### ${att.filename}\n[Binary file — ${att.file_type}]`
          if (content.length < 8000) return `### ${att.filename}\n\`\`\`\n${content}\n\`\`\``
          return `### ${att.filename}\n\`\`\`\n${content.substring(0, 8000)}\n[truncated]\n\`\`\``
        } catch {
          return `### ${att.filename}\n[Could not read file]`
        }
      }

      return `### ${att.filename}\n[${att.file_type ?? 'file'}: ${absPath}]`
    }).join('\n\n')

    // Create triage conversation
    const convId = randomUUID()
    const now = new Date().toISOString()
    this.db.prepare('INSERT INTO conversations (id, type, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(convId, 'research', now, now)
    this.db.prepare('INSERT INTO conversation_participants (conversation_id, agent_id) VALUES (?, ?)')
      .run(convId, triageAgentId)

    this.db.prepare('UPDATE bug_reports SET conversation_id = ? WHERE id = ?').run(convId, reportId)

    // Load triage skill content
    const { readFileSync: readSkill } = await import('fs')
    const { join: joinPath } = await import('path')
    let skillContent = ''
    try {
      const skillPath = joinPath(process.cwd(), 'skills', 'triage', 'SKILL.md')
      const raw = readSkill(skillPath, 'utf-8')
      const match = raw.match(/^---[\s\S]*?---\n([\s\S]*)$/)
      skillContent = match ? match[1]!.trim() : raw
    } catch { /* skill file not found — use inline fallback */ }

    const triageSystemPrompt = skillContent || `You are a bug triage agent. Analyze bug reports and produce structured triage results or ask clarifying questions.
Ask ONE question at a time in simple language. When the question has common answers, use [OPTIONS]...[/OPTIONS] format.
Respond with [TRIAGED] (severity, area, steps, root cause, fix) or [REJECTED] (reason) when done.`

    const triagePrompt = `## Bug Report

**Title:** ${report.title}
**Reporter:** ${report.reporter_name ?? 'Unknown'}
**Description:**
${report.description}

${attachmentContext ? `## Attachments\n\n${attachmentContext}` : ''}

Analyze this bug report. If you have enough information, provide your triage result. Otherwise, ask ONE clarifying question with options if applicable.`

    // Store bug report context as system message in conversation
    this.db.prepare('INSERT INTO messages (id, conversation_id, sender_type, content, message_type) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), convId, 'system', triagePrompt, 'content')

    broadcast('bug_report:triaging', { id: reportId, conversationId: convId })

    try {
      // Get agent's provider
      const agent = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(triageAgentId) as any
      const provider = providerRegistry.get(agent?.provider_id ?? 'claude-cli')
      if (!provider) throw new Error(`Provider not found: ${agent?.provider_id}`)

      broadcast('conversation:typing', { conversationId: convId, agentId: triageAgentId, typing: true })

      let responseText = ''
      try {
        // Call provider directly with skill as system prompt
        const attachmentsDir = process.env['ATTACHMENTS_DIR'] ?? 'data/attachments'
        const session = await provider.spawn({
          prompt: triagePrompt,
          systemPrompt: triageSystemPrompt,
          cwd: process.cwd(),
          model: agent?.model ?? undefined,
          addDirs: attachments.length > 0 ? [resolvePath(attachmentsDir)] : undefined,
        })

        // Collect output — wait for "result" type JSON or timeout
        await new Promise<void>((resolve) => {
          let resolved = false
          const done = () => { if (!resolved) { resolved = true; resolve() } }
          provider.onOutput(session.id, (event: any) => {
            if (event.type === 'stdout') {
              responseText += event.content
              // Check if we received the result JSON (means response is complete)
              if (responseText.includes('"type":"result"')) done()
            }
            if (event.type === 'stderr') {
              console.error('[triage-stderr]', event.content)
            }
          })
          setTimeout(() => { provider.kill(session.id); done() }, 120_000)
        })
      } finally {
        broadcast('conversation:typing', { conversationId: convId, agentId: triageAgentId, typing: false })
      }

      // Parse stream-json output to extract text
      const response = this.parseStreamJsonOutput(responseText)

      // Store agent response as message
      this.db.prepare('INSERT INTO messages (id, conversation_id, sender_type, sender_id, content, message_type) VALUES (?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), convId, 'agent', triageAgentId, response, 'content')

      broadcast('conversation:message', { conversationId: convId, message: { senderType: 'agent', senderId: triageAgentId, content: response } })

      if (response.includes('[TRIAGED]')) {
        const severityMatch = response.match(/Severity:\s*(critical|high|medium|low)/i)
        this.db.prepare(`
          UPDATE bug_reports SET status = 'triaged', severity = ?, triage_summary = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(severityMatch?.[1]?.toLowerCase() ?? 'medium', response, reportId)

        // Auto-create card on Bug Triage board → "Triaged" column
        const bugBoard = this.db.prepare("SELECT id FROM boards WHERE name = 'Bug Triage'").get() as any
        if (bugBoard) {
          const triagedCol = this.db.prepare("SELECT id FROM columns WHERE board_id = ? AND name = 'Triaged'").get(bugBoard.id) as any
          if (triagedCol) {
            this.createBugCard(reportId, bugBoard.id, triagedCol.id)
          }
        }

        broadcast('bug_report:triaged', { id: reportId, severity: severityMatch?.[1] })

      } else if (response.includes('[REJECTED]')) {
        this.db.prepare("UPDATE bug_reports SET status = 'rejected', triage_summary = ?, updated_at = datetime('now') WHERE id = ?")
          .run(response, reportId)
        broadcast('bug_report:rejected', { id: reportId })

      } else {
        // Agent asked a question — set needs_info and wait for user response
        this.db.prepare("UPDATE bug_reports SET status = 'needs_info', updated_at = datetime('now') WHERE id = ?")
          .run(reportId)
        broadcast('bug_report:needs_info', { id: reportId })
      }
    } catch (err) {
      console.error('Triage failed:', err)
      this.db.prepare("UPDATE bug_reports SET status = 'new', updated_at = datetime('now') WHERE id = ?")
        .run(reportId)
    }
  }

  private parseStreamJsonOutput(raw: string): string {
    // Claude CLI stream-json emits JSON lines. Key types:
    // {"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}
    // {"type":"result","result":"full text response"}
    const lines = raw.split('\n').filter(l => l.trim())
    let resultText = ''

    for (const line of lines) {
      try {
        const obj = JSON.parse(line)

        // Best source: result object has the complete response
        if (obj.type === 'result' && obj.result) {
          resultText = obj.result
        }

        // Fallback: assistant message with content array
        if (obj.type === 'assistant' && obj.message?.content) {
          const texts = (obj.message.content as any[])
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
          if (texts.length > 0 && !resultText) {
            resultText = texts.join('')
          }
        }
      } catch {
        // Not JSON — skip
      }
    }

    return resultText || raw
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
