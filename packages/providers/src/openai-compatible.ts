import type { AgentProvider } from './interface.js'
import type { SpawnOpts, OutputEvent, AgentSession } from '@gaud/shared'

interface OpenAIConfig {
  id: string
  name: string
  apiKey: string
  baseUrl: string
  models: Record<string, { input: number; output: number }>
}

interface Session {
  id: string
  abortController: AbortController
  callbacks: Array<(event: OutputEvent) => void>
}

export function createOpenAICompatibleProvider(config: OpenAIConfig): AgentProvider & { buildRequestBody: (prompt: string, model: string) => any } {
  const sessions = new Map<string, Session>()

  function buildRequestBody(prompt: string, model: string) {
    return {
      model,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }
  }

  return {
    id: config.id,
    name: config.name,
    models: Object.keys(config.models),

    async spawn(opts: SpawnOpts): Promise<AgentSession> {
      const id = `${config.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const abortController = new AbortController()
      const session: Session = { id, abortController, callbacks: [] }
      sessions.set(id, session)

      const model = opts.model ?? Object.keys(config.models)[0] ?? 'gpt-4o'
      const body = buildRequestBody(opts.prompt, model)

      ;(async () => {
        try {
          const res = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.apiKey}`,
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

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content
                if (delta) {
                  for (const cb of session.callbacks) {
                    cb({ type: 'stdout', content: delta, timestamp: new Date().toISOString() })
                  }
                }

                // Usage info (OpenAI includes at end when stream_options.include_usage is set)
                if (parsed.usage) {
                  const pricing = config.models[model] ?? Object.values(config.models)[0]
                  const cost = pricing
                    ? (parsed.usage.prompt_tokens ?? 0) * pricing.input +
                      (parsed.usage.completion_tokens ?? 0) * pricing.output
                    : 0
                  for (const cb of session.callbacks) {
                    cb({
                      type: 'cost', content: '', timestamp: new Date().toISOString(),
                      tokens: { input: parsed.usage.prompt_tokens ?? 0, output: parsed.usage.completion_tokens ?? 0 },
                      cost,
                    })
                  }
                }
              } catch { /* skip */ }
            }
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

    async send(): Promise<void> {},
    async kill(sessionId: string): Promise<void> {
      const session = sessions.get(sessionId)
      if (session) { session.abortController.abort(); sessions.delete(sessionId) }
    },
    onOutput(sessionId: string, cb: (event: OutputEvent) => void): void {
      const session = sessions.get(sessionId)
      if (session) session.callbacks.push(cb)
    },
    estimateCost(model: string, tokens: { input: number; output: number }): number {
      const pricing = config.models[model] ?? Object.values(config.models)[0]
      if (!pricing) return 0
      return tokens.input * pricing.input + tokens.output * pricing.output
    },
    buildRequestBody,
  }
}
