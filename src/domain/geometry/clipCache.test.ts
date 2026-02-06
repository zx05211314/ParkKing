import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  clearClipCache,
  getClipCacheStats,
  getClippedLines,
  resetClipCacheStats,
  setClipCacheMaxEntries,
} from './clipCache'

const line: [number, number][] = [
  [121.56, 25.03],
  [121.561, 25.031],
]

describe('clipCache LRU', () => {
  const originalMax = getClipCacheStats().maxEntries

  beforeEach(() => {
    clearClipCache()
    resetClipCacheStats()
    setClipCacheMaxEntries(2)
  })

  afterEach(() => {
    clearClipCache()
    resetClipCacheStats()
    setClipCacheMaxEntries(originalMax)
  })

  it('evicts oldest entries when max exceeded', () => {
    getClippedLines('hash', 'seg-1', 'v1', line, [])
    getClippedLines('hash', 'seg-2', 'v1', line, [])
    expect(getClipCacheStats().size).toBe(2)

    getClippedLines('hash', 'seg-3', 'v1', line, [])
    expect(getClipCacheStats().size).toBe(2)

    resetClipCacheStats()
    getClippedLines('hash', 'seg-1', 'v1', line, [])
    expect(getClipCacheStats().misses).toBe(1)
  })
})
