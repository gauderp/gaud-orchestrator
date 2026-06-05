import { createHashEmbedder, createEmbeddingRegistry } from '../services/embeddings.js'

describe('HashEmbedder (fallback)', () => {
  it('generates deterministic embeddings', async () => {
    const embedder = createHashEmbedder()
    const a = await embedder.generate('hello world')
    const b = await embedder.generate('hello world')
    expect(a).toEqual(b)
  })

  it('generates different embeddings for different text', async () => {
    const embedder = createHashEmbedder()
    const a = await embedder.generate('hello')
    const b = await embedder.generate('goodbye')
    expect(a).not.toEqual(b)
  })

  it('returns vectors of correct dimension', async () => {
    const embedder = createHashEmbedder()
    const v = await embedder.generate('test')
    expect(v.length).toBe(128)
  })

  it('returns normalized vectors', async () => {
    const embedder = createHashEmbedder()
    const v = await embedder.generate('test text here')
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0))
    expect(norm).toBeCloseTo(1.0, 1)
  })
})

describe('EmbeddingRegistry', () => {
  it('registers and retrieves embedders', () => {
    const registry = createEmbeddingRegistry()
    const embedder = createHashEmbedder()
    registry.register('hash', embedder)
    expect(registry.get('hash')).toBe(embedder)
  })

  it('returns hash fallback for unknown provider', () => {
    const registry = createEmbeddingRegistry()
    const fallback = registry.get('nonexistent')
    expect(fallback).toBeDefined()
    expect(fallback?.dimensions).toBe(128)
  })
})
