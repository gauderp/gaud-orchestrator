import { createHash } from 'crypto'

export interface EmbeddingProvider {
  id: string
  dimensions: number
  generate(text: string): Promise<number[]>
}

export interface EmbeddingRegistry {
  register(providerId: string, embedder: EmbeddingProvider): void
  get(providerId: string): EmbeddingProvider | undefined
  getOrFallback(providerId: string | null): EmbeddingProvider
}

export function createHashEmbedder(dimensions = 128): EmbeddingProvider {
  return {
    id: 'hash',
    dimensions,
    async generate(text: string): Promise<number[]> {
      const vector: number[] = []
      let seed = text
      while (vector.length < dimensions) {
        const hash = createHash('sha256').update(seed).digest()
        for (let i = 0; i < hash.length && vector.length < dimensions; i += 4) {
          const int32 = hash.readInt32LE(i)
          vector.push(int32 / 2147483647)
        }
        seed = hash.toString('hex')
      }
      const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0))
      return norm > 0 ? vector.map((x) => x / norm) : vector
    },
  }
}

export function createOpenAIEmbedder(apiKey: string, model = 'text-embedding-3-small'): EmbeddingProvider {
  const dimensions = model === 'text-embedding-3-small' ? 1536 : 3072
  return {
    id: 'openai',
    dimensions,
    async generate(text: string): Promise<number[]> {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: text }),
      })
      if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.statusText}`)
      const data = await res.json() as { data: Array<{ embedding: number[] }> }
      return data.data[0]!.embedding
    },
  }
}

export function createGeminiEmbedder(apiKey: string, model = 'text-embedding-004'): EmbeddingProvider {
  return {
    id: 'gemini',
    dimensions: 768,
    async generate(text: string): Promise<number[]> {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: { parts: [{ text }] } }),
        },
      )
      if (!res.ok) throw new Error(`Gemini embeddings failed: ${res.statusText}`)
      const data = await res.json() as { embedding: { values: number[] } }
      return data.embedding.values
    },
  }
}

export function createEmbeddingRegistry(): EmbeddingRegistry {
  const embedders = new Map<string, EmbeddingProvider>()
  const fallback = createHashEmbedder()

  return {
    register(providerId, embedder) {
      embedders.set(providerId, embedder)
    },
    get(providerId) {
      return embedders.get(providerId) ?? fallback
    },
    getOrFallback(providerId) {
      return embedders.get(providerId ?? '') ?? fallback
    },
  }
}
