import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, extname } from 'path'

interface CodebaseAnalysis {
  fileCount: number
  tree: string
  routes: string[]
  exports: string[]
  dependencies: Array<{ from: string; to: string }>
  markdown: string
}

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.java', '.py', '.sql', '.md'])
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.worktrees'])
const MAX_FILES = 500
const MAX_FILE_SIZE = 50_000

export async function analyzeCodebase(repoPath: string, maxDepth = 5): Promise<CodebaseAnalysis> {
  const files: string[] = []
  const routes: string[] = []
  const exports: string[] = []
  const dependencies: Array<{ from: string; to: string }> = []

  function walk(dir: string, depth: number) {
    if (depth > maxDepth || files.length > MAX_FILES) return
    try {
      for (const entry of readdirSync(dir)) {
        if (IGNORE_DIRS.has(entry) || entry.startsWith('.')) continue
        const fullPath = join(dir, entry)
        const stat = statSync(fullPath)
        if (stat.isDirectory()) {
          walk(fullPath, depth + 1)
        } else if (CODE_EXTENSIONS.has(extname(entry))) {
          files.push(relative(repoPath, fullPath))
        }
      }
    } catch { /* permission errors */ }
  }
  walk(repoPath, 0)

  for (const file of files) {
    const fullPath = join(repoPath, file)
    try {
      const stat = statSync(fullPath)
      if (stat.size > MAX_FILE_SIZE) continue
      const content = readFileSync(fullPath, 'utf-8')

      // Detect API routes
      const routeMatches = content.matchAll(/(?:app|router)\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/gi)
      for (const m of routeMatches) {
        routes.push(m[2]!)
      }

      // Detect exports
      const exportMatches = content.matchAll(/export\s+(?:async\s+)?(?:function|class|const|interface|type|enum)\s+(\w+)/g)
      for (const m of exportMatches) {
        exports.push(m[1]!)
      }

      // Detect imports (dependencies between files)
      const importMatches = content.matchAll(/import\s+.*from\s+['"`]([^'"`]+)/g)
      for (const m of importMatches) {
        if (m[1]!.startsWith('.')) {
          dependencies.push({ from: file, to: m[1]! })
        }
      }
    } catch { /* read errors */ }
  }

  const tree = buildCompactTree(files)

  const uniqueRoutes = [...new Set(routes)]
  const uniqueExports = [...new Set(exports)]

  const markdown = [
    '# Codebase Analysis',
    '',
    `**Files:** ${files.length}`,
    '',
    '## File Tree',
    '```',
    tree,
    '```',
    uniqueRoutes.length > 0 ? `\n## API Routes (${uniqueRoutes.length})\n${uniqueRoutes.map(r => `- ${r}`).join('\n')}` : '',
    uniqueExports.length > 0 ? `\n## Key Exports (${Math.min(uniqueExports.length, 50)})\n${uniqueExports.slice(0, 50).map(e => `- ${e}`).join('\n')}` : '',
    dependencies.length > 0 ? `\n## Dependencies (${Math.min(dependencies.length, 30)})\n${dependencies.slice(0, 30).map(d => `- ${d.from} → ${d.to}`).join('\n')}` : '',
  ].filter(Boolean).join('\n')

  return {
    fileCount: files.length,
    tree,
    routes: uniqueRoutes,
    exports: uniqueExports,
    dependencies,
    markdown,
  }
}

function buildCompactTree(files: string[]): string {
  const dirCounts = new Map<string, number>()
  for (const f of files) {
    const parts = f.split(/[/\\]/)
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.'
    dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1)
  }
  return [...dirCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dir, count]) => `${dir}/ (${count} files)`)
    .join('\n')
}
