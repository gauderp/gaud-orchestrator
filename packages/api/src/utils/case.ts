// Converte snake_case keys para camelCase
export function toCamelCase<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camelKey] = value
  }
  return result as T
}

// Converte array de rows
export function toCamelCaseArray<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => toCamelCase<T>(row))
}
