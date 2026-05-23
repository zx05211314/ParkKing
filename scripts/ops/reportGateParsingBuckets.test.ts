import { describe, expect, it } from 'vitest'
import { toParsingFallbackBucket } from './reportGateParsingBuckets'

describe('toParsingFallbackBucket', () => {
  it('sorts evidence and marks buckets as used', () => {
    expect(toParsingFallbackBucket(new Set(['b', 'a']))).toEqual({
      used: true,
      evidence: ['a', 'b'],
    })
  })
})
