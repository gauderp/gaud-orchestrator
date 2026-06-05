import type { AgentProvider } from './interface.js'
import type { SpawnOpts, OutputEvent, AgentSession } from '@gaud/shared'

const PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-pro': { input: 1.25 / 1_000_000, output: 10 / 1_000_000 },
  'gemini-2.5-flash': { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  'gemini-2.0-flash': { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 },
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

interface Session {
  id: string
  abortController: AbortController
  callbacks: Array<(event: OutputEvent) => void>
}

export function createGeminiProvider(config: { apiKey: string }): AgentProvider & { buildRequestBody: (prompt: string, model: string) => any } {
  const sessions = new Map<string, Session>()

  function buildRequestBody(prompt: string, _model: string) {
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }
  }

  return {
    id: 'gemini',
    name: 'Google Gemini',
    models: Object.keys(PRICING),

    async spawn(opts: SpawnOpts): Promise<AgentSession> {
      const id = `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const abortController = new AbortController()
      const session: Session = { id, abortController, callbacks: [] }
      sessions.set(id, session)

      const model = opts.model ?? 'gemini-2.5-flash'
      const body = buildRequestBody(opts.prompt, model)

      ;(async () => {
        try {
          // Gemini streaming via SSE
          const res = await fetch(
            `${BASE_URL}/models/${model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              signal: abortController.signal,
            },
          )

          if (!res.ok) {
            const err = await res.text()
            for (const cb of session.callbacks) {
              cb({ type: 'stderr', content: `Gemini Error: ${res.status} ${err}`, timestamp: new Date().toISOString() })
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
              try {
                const parsed = JSON.parse(line.slice(6))
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) {
                  for (const cb of session.callbacks) {
                    cb({ type: 'stdout', content: text, timestamp: new Date().toISOString() })
                  }
                }
                if (parsed.usageMetadata) {
                  inputTokens = parsed.usageMetadata.promptTokenCount ?? inputTokens
                  outputTokens = parsed.usageMetadata.candidatesTokenCount ?? outputTokens
                }
              } catch { /* skip */ }
            }
          }

          // Final cost
          const pricing = PRICING[model] ?? PRICING['gemini-2.5-flash']!
          const cost = inputTokens * pricing.input + outputTokens * pricing.output
          for (const cb of session.callbacks) {
            cb({
              type: 'cost', content: '', timestamp: new Date().toISOString(),
              tokens: { input: inputTokens, output: outputTokens }, cost,
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
      const pricing = PRICING[model] ?? PRICING['gemini-2.5-flash']!
      return tokens.input * pricing.input + tokens.output * pricing.output
    },
    buildRequestBody,
  }
}
