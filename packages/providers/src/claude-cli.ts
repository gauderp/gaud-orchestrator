import { spawn, type ChildProcess, execFileSync } from 'child_process'
import { platform } from 'os'
import type { AgentProvider } from './interface.js'
import type { SpawnOpts, OutputEvent, AgentSession } from '@gaud/shared'

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  'claude-opus-4-6': { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  'claude-haiku-4-5': { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
}

interface Session {
  id: string
  process: ChildProcess
  callbacks: Array<(event: OutputEvent) => void>
}

function detectRtk(): boolean {
  try {
    execFileSync('rtk', ['--version'], { encoding: 'utf-8', timeout: 5000 })
    return true
  } catch { return false }
}

export function createClaudeCliProvider(): AgentProvider & { buildArgs: (prompt: string, model?: string) => string[] } {
  const sessions = new Map<string, Session>()
  const hasRtk = detectRtk()

  function buildArgs(prompt: string, model?: string, systemPrompt?: string, addDirs?: string[]): string[] {
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose']
    if (model) args.push('--model', model)
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt)
    }
    if (addDirs?.length) {
      for (const dir of addDirs) args.push('--add-dir', dir)
    }
    return args
  }

  return {
    id: 'claude-cli',
    name: 'Claude Code CLI',
    models: Object.keys(PRICING),

    async spawn(opts: SpawnOpts): Promise<AgentSession> {
      const id = `claude-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const claudePath = platform() === 'win32' ? 'claude.cmd' : 'claude'
      const args = buildArgs(opts.prompt, opts.model, opts.systemPrompt, opts.addDirs)

      const proc = spawn(claudePath, args, {
        cwd: opts.cwd,
        env: {
          ...process.env,
          ...opts.env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const session: Session = { id, process: proc, callbacks: [] }
      sessions.set(id, session)

      proc.stdout?.on('data', (chunk: Buffer) => {
        const event: OutputEvent = {
          type: 'stdout',
          content: chunk.toString(),
          timestamp: new Date().toISOString(),
        }
        for (const cb of session.callbacks) cb(event)
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        const event: OutputEvent = {
          type: 'stderr',
          content: chunk.toString(),
          timestamp: new Date().toISOString(),
        }
        for (const cb of session.callbacks) cb(event)
      })

      proc.on('close', () => { sessions.delete(id) })
      proc.on('error', () => { sessions.delete(id) })

      return { id, status: 'running' }
    },

    async send(_sessionId: string, _message: string): Promise<void> {
      // Claude CLI doesn't support sending messages to a running session
    },

    async kill(sessionId: string): Promise<void> {
      const session = sessions.get(sessionId)
      if (session) {
        session.process.kill('SIGTERM')
        sessions.delete(sessionId)
      }
    },

    onOutput(sessionId: string, cb: (event: OutputEvent) => void): void {
      const session = sessions.get(sessionId)
      if (session) session.callbacks.push(cb)
    },

    estimateCost(model: string, tokens: { input: number; output: number }): number {
      const pricing = PRICING[model] ?? PRICING['claude-sonnet-4-6']!
      return tokens.input * pricing.input + tokens.output * pricing.output
    },

    buildArgs,
  }
}
