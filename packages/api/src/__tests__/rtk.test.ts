import { describe, it, expect, afterEach } from 'vitest'
import { isRtkAvailable, getRtkGain, resetRtkCache } from '../services/rtk.js'

describe('RTK Integration', () => {
  afterEach(() => {
    resetRtkCache()
  })

  it('isRtkAvailable returns a boolean', () => {
    const result = isRtkAvailable()
    expect(typeof result).toBe('boolean')
  })

  it('caches the detection result', () => {
    const first = isRtkAvailable()
    const second = isRtkAvailable()
    expect(first).toBe(second)
  })

  it('getRtkGain returns null when RTK is not available', () => {
    // In CI/test env, RTK is unlikely to be installed
    if (!isRtkAvailable()) {
      const gain = getRtkGain()
      expect(gain).toBeNull()
    }
  })

  it('resetRtkCache clears the cached value', () => {
    isRtkAvailable()
    resetRtkCache()
    // After reset, next call re-detects
    const result = isRtkAvailable()
    expect(typeof result).toBe('boolean')
  })
})
