import { spawn, type ChildProcess } from 'child_process'
import { platform } from 'os'
import type { AgentProvider } from './interface.js'
import type { SpawnOpts, OutputEvent, AgentSession } from '@gaud/shared'

interface Session {
  id: string
  process: ChildProcess
  callbacks: Array<(event: OutputEvent) => void>
}

export function createCursorCliProvider(): AgentProvider & { buildArgs: (prompt: string, model?: string) => string[] } {
  const sessions = new Map<string, Session>()

  function buildArgs(prompt: string, _model?: string): string[] {
    return ['--prompt', prompt]
  }

  return {
    id: 'cursor',
    name: 'Cursor IDE',
    models: ['default'],

    async spawn(opts: SpawnOpts): Promise<AgentSession> {
      const id = `cursor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const cursorPath = platform() === 'win32' ? 'cursor.cmd' : 'cursor'
      const args = buildArgs(opts.prompt, opts.model)

      const proc = spawn(cursorPath, args, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      })

      const session: Session = { id, process: proc, callbacks: [] }
      sessions.set(id, session)

      proc.stdout?.on('data', (chunk: Buffer) => {
        for (const cb of session.callbacks) {
          cb({ type: 'stdout', content: chunk.toString(), timestamp: new Date().toISOString() })
        }
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        for (const cb of session.callbacks) {
          cb({ type: 'stderr', content: chunk.toString(), timestamp: new Date().toISOString() })
        }
      })

      proc.on('close', () => sessions.delete(id))
      proc.on('error', () => sessions.delete(id))

      return { id, status: 'running' }
    },

    async send(): Promise<void> {},
    async kill(sessionId: string): Promise<void> {
      const session = sessions.get(sessionId)
      if (session) { session.process.kill('SIGTERM'); sessions.delete(sessionId) }
    },
    onOutput(sessionId: string, cb: (event: OutputEvent) => void): void {
      const session = sessions.get(sessionId)
      if (session) session.callbacks.push(cb)
    },
    estimateCost(_model: string, _tokens: { input: number; output: number }): number {
      // Cursor pricing is subscription-based, estimate token cost as 0
      return 0
    },
    buildArgs,
  }
}
