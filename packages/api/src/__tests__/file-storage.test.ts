import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { LocalFileStorage } from '../services/file-storage.js'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const TMP = join(tmpdir(), 'file-storage-test-' + Date.now())

describe('LocalFileStorage', () => {
  let storage: LocalFileStorage

  beforeAll(() => {
    mkdirSync(TMP, { recursive: true })
    storage = new LocalFileStorage(TMP)
  })

  afterAll(() => {
    rmSync(TMP, { recursive: true, force: true })
  })

  it('saves a file and returns relative path', async () => {
    const data = Buffer.from('hello world')
    const path = await storage.save('card-1', 'test.txt', data)
    expect(path).toContain('card-1')
    expect(path).toContain('test.txt')
  })

  it('retrieves a saved file', async () => {
    const data = await storage.get('card-1', 'test.txt')
    expect(data.toString()).toBe('hello world')
  })

  it('lists files for a card', async () => {
    await storage.save('card-1', 'second.md', Buffer.from('# Hello'))
    const files = await storage.list('card-1')
    expect(files).toContain('test.txt')
    expect(files).toContain('second.md')
  })

  it('returns absolute path', () => {
    const abs = storage.getAbsolutePath('card-1', 'test.txt')
    expect(abs).toContain(TMP)
    expect(abs).toContain('card-1')
  })

  it('deletes a file', async () => {
    await storage.delete('card-1', 'test.txt')
    const files = await storage.list('card-1')
    expect(files).not.toContain('test.txt')
  })

  it('returns empty list for nonexistent card', async () => {
    const files = await storage.list('nonexistent')
    expect(files).toEqual([])
  })
})
