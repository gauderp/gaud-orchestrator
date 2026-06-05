export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

export interface SimilarityResult {
  id: string
  similarity: number
  [key: string]: unknown
}

export function topKSimilar(
  query: number[],
  entries: Array<{ id: string; embedding: number[]; [key: string]: unknown }>,
  k: number,
  minSimilarity = 0.0,
): SimilarityResult[] {
  return entries
    .map((entry) => ({
      ...entry,
      similarity: cosineSimilarity(query, entry.embedding),
    }))
    .filter((e) => e.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
}
