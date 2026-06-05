import { readFile, writeFile, unlink, readdir, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export interface FileStorage {
  save(cardId: string, filename: string, data: Buffer): Promise<string>
  get(cardId: string, filename: string): Promise<Buffer>
  delete(cardId: string, filename: string): Promise<void>
  list(cardId: string): Promise<string[]>
  getAbsolutePath(cardId: string, filename: string): string
}

export class LocalFileStorage implements FileStorage {
  constructor(private baseDir: string) {}

  private cardDir(cardId: string): string {
    return join(this.baseDir, cardId)
  }

  async save(cardId: string, filename: string, data: Buffer): Promise<string> {
    const dir = this.cardDir(cardId)
    await mkdir(dir, { recursive: true })
    const filePath = join(dir, filename)
    await writeFile(filePath, data)
    return join(cardId, filename)
  }

  async get(cardId: string, filename: string): Promise<Buffer> {
    return readFile(join(this.cardDir(cardId), filename))
  }

  async delete(cardId: string, filename: string): Promise<void> {
    await unlink(join(this.cardDir(cardId), filename))
  }

  async list(cardId: string): Promise<string[]> {
    const dir = this.cardDir(cardId)
    if (!existsSync(dir)) return []
    return readdir(dir)
  }

  getAbsolutePath(cardId: string, filename: string): string {
    return join(this.baseDir, cardId, filename)
  }
}
