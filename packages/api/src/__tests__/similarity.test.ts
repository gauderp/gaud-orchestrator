import { cosineSimilarity, topKSimilar } from '../services/similarity.js'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 0, 0, 1]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0)
  })

  it('handles real embeddings', () => {
    const a = [0.1, 0.3, 0.5, 0.7]
    const b = [0.2, 0.4, 0.5, 0.6]
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThan(0.9)
    expect(sim).toBeLessThanOrEqual(1.0)
  })
})

describe('topKSimilar', () => {
  it('returns top K results sorted by similarity', () => {
    const query = [1, 0, 0]
    const entries = [
      { id: 'a', embedding: [1, 0, 0] },
      { id: 'b', embedding: [0, 1, 0] },
      { id: 'c', embedding: [0.9, 0.1, 0] },
      { id: 'd', embedding: [-1, 0, 0] },
    ]
    const results = topKSimilar(query, entries, 2)
    expect(results).toHaveLength(2)
    expect(results[0].id).toBe('a')
    expect(results[1].id).toBe('c')
  })

  it('returns all if K > entries length', () => {
    const query = [1, 0]
    const entries = [{ id: 'a', embedding: [1, 0] }]
    const results = topKSimilar(query, entries, 5)
    expect(results).toHaveLength(1)
  })

  it('filters by minimum similarity threshold', () => {
    const query = [1, 0, 0]
    const entries = [
      { id: 'a', embedding: [1, 0, 0] },
      { id: 'b', embedding: [0, 1, 0] },
    ]
    const results = topKSimilar(query, entries, 10, 0.5)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('a')
  })
})
