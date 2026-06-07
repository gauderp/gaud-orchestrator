import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { HierarchyService } from '../services/hierarchy.js'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('HierarchyService', () => {
  let db: Database.Database
  let service: HierarchyService

  beforeAll(() => {
    db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '001_initial.sql'), 'utf-8'))
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '002_fix_comment_author_type.sql'), 'utf-8'))
    db.exec(readFileSync(join(__dirname, '..', 'db', 'migrations', '003_agent_hierarchy.sql'), 'utf-8'))

    // Seed hierarchy: Lead → Fiscal, Lead → Coder, Coder → Tester
    db.prepare("INSERT INTO providers (id, name, type) VALUES ('p1', 'Claude', 'claude-cli')").run()
    db.prepare("INSERT INTO agents (id, name, role, provider_id, requires_parent_approval) VALUES ('lead', 'Lead Architect', 'Technical lead', 'p1', 0)").run()
    db.prepare("INSERT INTO agents (id, name, role, provider_id, parent_agent_id, requires_parent_approval) VALUES ('fiscal', 'Fiscal Agent', 'Tax specialist', 'p1', 'lead', 1)").run()
    db.prepare("INSERT INTO agents (id, name, role, provider_id, parent_agent_id, requires_parent_approval) VALUES ('coder', 'Coder', 'Implementation', 'p1', 'lead', 1)").run()
    db.prepare("INSERT INTO agents (id, name, role, provider_id, parent_agent_id) VALUES ('tester', 'Tester', 'Testing', 'p1', 'coder')").run()

    service = new HierarchyService(db)
  })

  afterAll(() => db.close())

  it('getParent returns parent agent', () => {
    const parent = service.getParent('coder')
    expect(parent?.id).toBe('lead')
  })

  it('getParent returns null for root agent', () => {
    expect(service.getParent('lead')).toBeNull()
  })

  it('getChildren returns direct children', () => {
    const children = service.getChildren('lead')
    expect(children.map((c: any) => c.id).sort()).toEqual(['coder', 'fiscal'])
  })

  it('getChain returns full ancestry', () => {
    const chain = service.getChain('tester')
    expect(chain.map((a: any) => a.id)).toEqual(['coder', 'lead'])
  })

  it('getChain returns empty for root', () => {
    expect(service.getChain('lead')).toEqual([])
  })

  it('requiresApproval checks agent flag', () => {
    expect(service.requiresApproval('coder')).toBe(true)
    expect(service.requiresApproval('tester')).toBe(false)
    expect(service.requiresApproval('lead')).toBe(false)
  })

  it('createReview creates pending review', () => {
    const review = service.createReview({
      reviewerAgentId: 'lead',
      revieweeAgentId: 'coder',
    })
    expect((review as any).status).toBe('pending')
    expect((review as any).reviewerAgentId).toBe('lead')
  })

  it('resolveReview updates status', () => {
    const reviews = service.getPendingReviews('lead')
    expect(reviews.length).toBe(1)

    service.resolveReview((reviews[0] as any).id, 'approved', 'LGTM')

    const resolved = db.prepare('SELECT * FROM agent_reviews WHERE id = ?').get((reviews[0] as any).id) as any
    expect(resolved.status).toBe('approved')
    expect(resolved.comment).toBe('LGTM')
    expect(resolved.resolved_at).not.toBeNull()
  })

  it('getTree returns full hierarchy tree', () => {
    const tree = service.getTree()
    expect(tree.length).toBe(1) // 1 root
    expect(tree[0]!.agent.id).toBe('lead')
    expect(tree[0]!.children.length).toBe(2) // fiscal + coder
    const coderNode = tree[0]!.children.find((c: any) => c.agent.id === 'coder')
    expect(coderNode?.children.length).toBe(1) // tester
  })

  it('findBestChild picks child by role match', () => {
    const best = service.findBestChild('lead', 'tax calculation for NFS-e')
    // fiscal has 'Tax specialist' role — should match
    expect((best as any)?.id).toBe('fiscal')
  })

  it('getReviewsForAgent returns reviews for reviewee', () => {
    const reviews = service.getReviewsForAgent('coder')
    expect(reviews.length).toBe(1)
    expect((reviews[0] as any).status).toBe('approved')
  })
})
