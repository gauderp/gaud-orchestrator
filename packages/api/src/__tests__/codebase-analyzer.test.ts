import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { analyzeCodebase } from '../services/codebase-analyzer.js'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const TMP = join(tmpdir(), 'codebase-test-' + Date.now())

describe('Codebase Analyzer', () => {
  beforeAll(() => {
    mkdirSync(join(TMP, 'src', 'routes'), { recursive: true })
    mkdirSync(join(TMP, 'src', 'services'), { recursive: true })
    writeFileSync(join(TMP, 'src', 'routes', 'users.ts'), `
      import { UserService } from '../services/user.js'
      export async function userRoutes(app) {
        app.get('/api/users', async (req, reply) => {})
        app.post('/api/users', async (req, reply) => {})
      }
    `)
    writeFileSync(join(TMP, 'src', 'services', 'user.ts'), `
      export class UserService {
        findAll() {}
        create(data) {}
      }
    `)
    writeFileSync(join(TMP, 'package.json'), '{"name": "test-project", "version": "1.0.0"}')
  })

  afterAll(() => rmSync(TMP, { recursive: true, force: true }))

  it('returns file tree summary', async () => {
    const result = await analyzeCodebase(TMP)
    expect(result.fileCount).toBeGreaterThan(0)
    expect(result.tree).toContain('routes')
    expect(result.tree).toContain('services')
  })

  it('detects API routes', async () => {
    const result = await analyzeCodebase(TMP)
    expect(result.routes).toContain('/api/users')
  })

  it('detects exports', async () => {
    const result = await analyzeCodebase(TMP)
    expect(result.exports).toContain('UserService')
    expect(result.exports).toContain('userRoutes')
  })

  it('detects imports/dependencies between files', async () => {
    const result = await analyzeCodebase(TMP)
    expect(result.dependencies.length).toBeGreaterThan(0)
    expect(result.dependencies[0]!.to).toContain('../services/user')
  })

  it('produces a markdown summary', async () => {
    const result = await analyzeCodebase(TMP)
    expect(result.markdown).toContain('# Codebase Analysis')
    expect(result.markdown).toContain('/api/users')
    expect(result.markdown.length).toBeLessThan(10000)
  })

  it('respects maxDepth parameter', async () => {
    const result = await analyzeCodebase(TMP, 0)
    // At depth 0 only root files are scanned
    expect(result.fileCount).toBeLessThanOrEqual(1) // just package.json isn't a code extension
  })
})
