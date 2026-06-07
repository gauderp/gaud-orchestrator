import { execFileSync } from 'child_process'

let rtkAvailable: boolean | null = null

export function isRtkAvailable(): boolean {
  if (rtkAvailable !== null) return rtkAvailable
  try {
    execFileSync('rtk', ['--version'], { encoding: 'utf-8', timeout: 5000 })
    rtkAvailable = true
    console.log('RTK detected — token savings enabled for CLI providers')
  } catch {
    rtkAvailable = false
  }
  return rtkAvailable
}

export function getRtkGain(): { saved: number; total: number } | null {
  if (!isRtkAvailable()) return null
  try {
    const output = execFileSync('rtk', ['gain', '--json'], { encoding: 'utf-8', timeout: 5000 })
    return JSON.parse(output)
  } catch {
    return null
  }
}

/** Reset cached detection (useful for testing) */
export function resetRtkCache(): void {
  rtkAvailable = null
}
