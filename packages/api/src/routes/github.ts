import type { FastifyInstance } from 'fastify'
import { GitHubService } from '../services/github.js'
import { toCamelCase } from '../utils/case.js'
import { broadcast } from '../ws/broadcast.js'
import { requireRole } from '../middleware/auth.js'

export async function githubRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const editorPlus = requireRole('editor')
  const github = new GitHubService(db)

  // Check GitHub auth status
  app.get('/api/github/auth', async (_req, reply) => {
    return reply.send(github.checkAuth())
  })

  // List repos from a GitHub org/user
  app.get<{ Params: { owner: string } }>('/api/github/repos/:owner', async (req, reply) => {
    try {
      const repos = github.listRemoteRepos(req.params.owner)
      return reply.send(repos)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // List registered (local) repositories
  app.get('/api/repositories', async (_req, reply) => {
    return reply.send(github.listRepos())
  })

  // Add a repo (clone from GitHub)
  app.post('/api/repositories', { preHandler: [editorPlus] }, async (req, reply) => {
    const { githubUrl, defaultBranch } = req.body as { githubUrl: string; defaultBranch?: string }
    if (!githubUrl) return reply.status(400).send({ error: 'githubUrl required' })
    try {
      const repo = await github.addRepo(githubUrl, defaultBranch)
      broadcast('repository:added', repo)
      return reply.status(201).send(repo)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Sync a repo (pull latest)
  app.post<{ Params: { id: string } }>('/api/repositories/:id/sync', { preHandler: [editorPlus] }, async (req, reply) => {
    try {
      await github.syncRepo(req.params.id)
      const repo = toCamelCase(db.prepare('SELECT * FROM repositories WHERE id = ?').get(req.params.id) as any)
      broadcast('repository:synced', repo)
      return reply.send(repo)
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Remove a repo
  app.delete<{ Params: { id: string } }>('/api/repositories/:id', { preHandler: [editorPlus] }, async (req, reply) => {
    github.removeRepo(req.params.id)
    return reply.status(204).send()
  })

  // Cleanup orphan worktrees in a repo
  app.post<{ Params: { id: string } }>('/api/repositories/:id/cleanup-worktrees', async (req, reply) => {
    const repo = db.prepare('SELECT * FROM repositories WHERE id = ?').get(req.params.id) as any
    if (!repo?.local_path) return reply.status(404).send({ error: 'Repository not found' })
    const cleaned = github.cleanupWorktrees(repo.local_path)
    return reply.send({ cleaned })
  })
}
