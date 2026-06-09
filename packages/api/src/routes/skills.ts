import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { toCamelCase, toCamelCaseArray } from '../utils/case.js'
import { requireRole } from '../middleware/auth.js'
import { SkillImporter } from '../services/SkillImporter.js'

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  const db = (app as any).db ?? (await import('../db/connection.js')).getDb()
  const adminOnly = requireRole('admin')

  app.get('/api/skills', async (_req, reply) => {
    const skills = db.prepare('SELECT * FROM skills ORDER BY name').all()
    return reply.send(toCamelCaseArray(skills as any[]))
  })

  app.get<{ Params: { id: string } }>('/api/skills/:id', async (req, reply) => {
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id)
    if (!skill) return reply.status(404).send({ error: 'Skill not found' })
    return reply.send(toCamelCase(skill as any))
  })

  app.post('/api/skills', { preHandler: [adminOnly] }, async (req, reply) => {
    const { name, description, content } = req.body as { name: string; description?: string; content: string }
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      'INSERT INTO skills (id, name, description, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, description ?? null, content, now, now)
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id)
    return reply.status(201).send(toCamelCase(skill as any))
  })

  app.put<{ Params: { id: string } }>('/api/skills/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    const { name, description, content } = req.body as { name: string; description?: string; content: string }
    const now = new Date().toISOString()
    const result = db.prepare(
      'UPDATE skills SET name = ?, description = ?, content = ?, updated_at = ? WHERE id = ?'
    ).run(name, description ?? null, content, now, req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Skill not found' })
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id)
    return reply.send(toCamelCase(skill as any))
  })

  app.delete<{ Params: { id: string } }>('/api/skills/:id', { preHandler: [adminOnly] }, async (req, reply) => {
    const result = db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return reply.status(404).send({ error: 'Skill not found' })
    return reply.status(204).send()
  })

  // Import skills from GitHub URL
  app.post('/api/skills/import', { preHandler: [adminOnly] }, async (req, reply) => {
    const { url } = req.body as { url: string }
    if (!url?.trim()) return reply.status(400).send({ error: 'URL is required' })

    const githubToken = process.env['GITHUB_TOKEN']
      ?? (db.prepare("SELECT value FROM setup_state WHERE key = 'github_token'").get() as any)?.value
      ?? undefined

    const importer = new SkillImporter(githubToken)

    try {
      const imported = await importer.importFromUrl(url.trim())
      const created = []

      for (const skill of imported) {
        const existing = db.prepare('SELECT id FROM skills WHERE name = ?').get(skill.name) as any
        if (existing) {
          db.prepare(`
            UPDATE skills SET description = ?, content = ?, source = 'github', source_url = ?, source_ref = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(skill.description, skill.content, skill.sourceUrl, skill.sourceRef, existing.id)
          created.push({ id: existing.id, name: skill.name, action: 'updated' })
        } else {
          const id = randomUUID()
          const now = new Date().toISOString()
          db.prepare(`
            INSERT INTO skills (id, name, description, content, source, source_url, source_ref, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'github', ?, ?, ?, ?)
          `).run(id, skill.name, skill.description, skill.content, skill.sourceUrl, skill.sourceRef, now, now)
          created.push({ id, name: skill.name, action: 'created' })
        }
      }

      return reply.send({ imported: created })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })

  // Preview import (fetch and parse without saving)
  app.post('/api/skills/import/preview', { preHandler: [adminOnly] }, async (req, reply) => {
    const { url } = req.body as { url: string }
    if (!url?.trim()) return reply.status(400).send({ error: 'URL is required' })

    const githubToken = process.env['GITHUB_TOKEN']
      ?? (db.prepare("SELECT value FROM setup_state WHERE key = 'github_token'").get() as any)?.value
      ?? undefined

    const importer = new SkillImporter(githubToken)

    try {
      const skills = await importer.importFromUrl(url.trim())
      return reply.send({
        skills: skills.map(s => ({
          name: s.name,
          description: s.description,
          contentPreview: s.content.slice(0, 200) + (s.content.length > 200 ? '...' : ''),
          exists: !!db.prepare('SELECT 1 FROM skills WHERE name = ?').get(s.name),
        })),
      })
    } catch (err: any) {
      return reply.status(400).send({ error: err.message })
    }
  })
}
