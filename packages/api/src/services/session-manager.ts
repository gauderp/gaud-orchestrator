import { EventEmitter } from 'events'
import type { AgentProvider, ProviderRegistry } from '@gaud/providers'
import type { OutputEvent } from '@gaud/shared'

interface ActiveSession {
  id: string
  taskId: string
  executionId: string
  agentId: string
  providerId: string
  buffer: string
}

export class SessionManager extends EventEmitter {
  maxConcurrent: number
  private sessions = new Map<string, ActiveSession>()
  private providerRegistry: ProviderRegistry | undefined

  constructor(opts: { maxConcurrent: number; providerRegistry?: ProviderRegistry }) {
    super()
    this.maxConcurrent = opts.maxConcurrent
    this.providerRegistry = opts.providerRegistry
  }

  get activeSessions(): number {
    return this.sessions.size
  }

  canSpawn(): boolean {
    return this.sessions.size < this.maxConcurrent
  }

  static detectApprovalRequest(output: string): string | null {
    const match = output.match(/\[APPROVAL_NEEDED]\s*([\s\S]+?)$/i)
    if (match) return match[1].trim()
    return null
  }

  async spawn(opts: {
    sessionId: string
    executionId: string
    taskId: string
    agentId: string
    providerId: string
    prompt: string
    cwd: string
    model?: string
  }): Promise<void> {
    if (!this.canSpawn()) {
      this.emit('error', opts.sessionId, new Error('Max concurrent sessions reached'))
      return
    }

    const provider = this.providerRegistry?.get(opts.providerId)
    if (!provider) {
      this.emit('error', opts.sessionId, new Error(`Provider not found: ${opts.providerId}`))
      return
    }

    const session: ActiveSession = {
      id: opts.sessionId,
      taskId: opts.taskId,
      executionId: opts.executionId,
      agentId: opts.agentId,
      providerId: opts.providerId,
      buffer: '',
    }
    this.sessions.set(opts.sessionId, session)

    try {
      const agentSession = await provider.spawn({
        prompt: opts.prompt,
        cwd: opts.cwd,
        model: opts.model,
      })

      provider.onOutput(agentSession.id, (event: OutputEvent) => {
        session.buffer += event.content
        this.emit('output', opts.sessionId, event)

        // Check for approval request
        const approval = SessionManager.detectApprovalRequest(session.buffer)
        if (approval) {
          this.emit('approval', opts.sessionId, approval)
          session.buffer = ''
        }

        // Track cost
        if (event.tokens) {
          this.emit('cost', opts.sessionId, {
            agentId: opts.agentId,
            tokensIn: event.tokens.input,
            tokensOut: event.tokens.output,
            cost: event.cost ?? 0,
            providerId: opts.providerId,
            model: opts.model,
          })
        }
      })

      // Timeout after 5 minutes per task
      setTimeout(() => {
        if (this.sessions.has(opts.sessionId)) {
          this.sessions.delete(opts.sessionId)
          this.emit('done', opts.sessionId, 0)
        }
      }, 300_000)

    } catch (err) {
      this.sessions.delete(opts.sessionId)
      this.emit('error', opts.sessionId, err)
    }
  }

  async kill(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    const provider = this.providerRegistry?.get(session.providerId)
    if (provider) {
      await provider.kill(sessionId)
    }
    this.sessions.delete(sessionId)
  }

  async killAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.kill(id)
    }
  }

  markDone(sessionId: string): void {
    this.sessions.delete(sessionId)
    this.emit('done', sessionId, 0)
  }
}
