import type { AgentProvider } from './interface.js'
import type { SpawnOpts, OutputEvent, AgentSession } from '@gaud/shared'

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  'claude-opus-4-6': { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  'claude-haiku-4-5': { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
}

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

interface Session {
  id: string
  abortController: AbortController
  callbacks: Array<(event: OutputEvent) => void>
}

export function createClaudeApiProvider(config: { apiKey: string }): AgentProvider & { buildRequestBody: (prompt: string, model: string) => any } {
  const sessions = new Map<string, Session>()

  function buildRequestBody(prompt: string, model: string) {
    return {
      model,
      max_tokens: 8192,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }
  }

  return {
    id: 'claude-api',
    name: 'Claude API (Anthropic)',
    models: Object.keys(PRICING),

    async spawn(opts: SpawnOpts): Promise<AgentSession> {
      const id = `claude-api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const abortController = new AbortController()
      const session: Session = { id, abortController, callbacks: [] }
      sessions.set(id, session)

      const model = opts.model ?? 'claude-sonnet-4-6'
      const body = buildRequestBody(opts.prompt, model)

      // Fire-and-forget streaming request
      ;(async () => {
        try {
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': config.apiKey,
              'anthropic-version': API_VERSION,
            },
            body: JSON.stringify(body),
            signal: abortController.signal,
          })

          if (!res.ok) {
            const err = await res.text()
            for (const cb of session.callbacks) {
              cb({ type: 'stderr', content: `API Error: ${res.status} ${err}`, timestamp: new Date().toISOString() })
            }
            sessions.delete(id)
            return
          }

          const reader = res.body?.getReader()
          if (!reader) return
          const decoder = new TextDecoder()
          let inputTokens = 0
          let outputTokens = 0

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const event = JSON.parse(data)
                if (event.type === 'content_block_delta' && event.delta?.text) {
                  for (const cb of session.callbacks) {
                    cb({
                      type: 'stdout',
                      content: event.delta.text,
                      timestamp: new Date().toISOString(),
                    })
                  }
                }
                if (event.type === 'message_delta' && event.usage) {
                  outputTokens = event.usage.output_tokens ?? outputTokens
                }
                if (event.type === 'message_start' && event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens ?? 0
                }
              } catch { /* skip malformed lines */ }
            }
          }

          // Emit final cost event
          const pricing = PRICING[model] ?? PRICING['claude-sonnet-4-6']!
          const cost = inputTokens * pricing.input + outputTokens * pricing.output
          for (const cb of session.callbacks) {
            cb({
              type: 'cost',
              content: '',
              timestamp: new Date().toISOString(),
              tokens: { input: inputTokens, output: outputTokens },
              cost,
            })
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            for (const cb of session.callbacks) {
              cb({ type: 'stderr', content: `Error: ${err.message}`, timestamp: new Date().toISOString() })
            }
          }
        } finally {
          sessions.delete(id)
        }
      })()

      return { id, status: 'running' }
    },

    async send(_sessionId: string, _message: string): Promise<void> {
      // Claude API messages are single-shot; multi-turn requires new request
    },

    async kill(sessionId: string): Promise<void> {
      const session = sessions.get(sessionId)
      if (session) {
        session.abortController.abort()
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

    buildRequestBody,
  }
}
