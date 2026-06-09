interface ParsedGithubUrl {
  owner: string
  repo: string
  branch: string
  path: string
  type: 'file' | 'tree' | 'repo'
}

interface ImportedSkill {
  name: string
  description: string
  content: string
  sourceUrl: string
  sourceRef: string
}

export class SkillImporter {
  constructor(private githubToken?: string) {}

  parseUrl(url: string): ParsedGithubUrl {
    const cleaned = url.replace(/^https?:\/\/(www\.)?github\.com\//, '')
    const parts = cleaned.split('/')

    const owner = parts[0] ?? ''
    const repo = parts[1] ?? ''

    if (parts.length <= 2) {
      return { owner, repo, branch: 'main', path: '', type: 'repo' }
    }

    const urlType = parts[2] ?? ''
    const branch = parts[3] ?? 'main'
    const path = parts.slice(4).join('/')

    return {
      owner, repo, branch,
      path,
      type: urlType === 'blob' ? 'file' : urlType === 'tree' ? 'tree' : 'repo',
    }
  }

  async fetchFile(owner: string, repo: string, path: string, branch: string): Promise<string> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3.raw' }
    if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`

    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      { headers }
    )
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} for ${path}`)
    return res.text()
  }

  async listDir(owner: string, repo: string, path: string, branch: string): Promise<Array<{ name: string; path: string; type: string }>> {
    const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' }
    if (this.githubToken) headers['Authorization'] = `token ${this.githubToken}`

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
    const res = await fetch(url, { headers })
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    return res.json() as Promise<Array<{ name: string; path: string; type: string }>>
  }

  parseSkillFile(content: string, sourceUrl: string, sourceRef: string): ImportedSkill {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
    if (!match) {
      return { name: 'unnamed-skill', description: '', content, sourceUrl, sourceRef }
    }

    const frontmatter = match[1]!
    const body = match[2]!.trim()

    const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? 'unnamed-skill'
    const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? ''

    return { name, description, content: body, sourceUrl, sourceRef }
  }

  async importFromUrl(url: string): Promise<ImportedSkill[]> {
    const parsed = this.parseUrl(url)
    const skills: ImportedSkill[] = []

    if (parsed.type === 'file') {
      const content = await this.fetchFile(parsed.owner, parsed.repo, parsed.path, parsed.branch)
      skills.push(this.parseSkillFile(content, url, parsed.branch))
    } else {
      const searchPath = parsed.path || ''
      const entries = await this.listDir(parsed.owner, parsed.repo, searchPath, parsed.branch)

      const skillFile = entries.find(e => e.name === 'SKILL.md')
      if (skillFile) {
        const content = await this.fetchFile(parsed.owner, parsed.repo, skillFile.path, parsed.branch)
        skills.push(this.parseSkillFile(content, url, parsed.branch))
      }

      const dirs = entries.filter(e => e.type === 'dir')
      for (const dir of dirs) {
        try {
          const subEntries = await this.listDir(parsed.owner, parsed.repo, dir.path, parsed.branch)
          const subSkill = subEntries.find(e => e.name === 'SKILL.md')
          if (subSkill) {
            const content = await this.fetchFile(parsed.owner, parsed.repo, subSkill.path, parsed.branch)
            skills.push(this.parseSkillFile(content, `${url}/${dir.name}`, parsed.branch))
          }
        } catch {
          // Skip directories that fail
        }
      }
    }

    if (skills.length === 0) {
      throw new Error('No SKILL.md files found at this URL')
    }

    return skills
  }
}
