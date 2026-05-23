import { describe, expect, it } from 'vitest'
import { buildReasonDistribution, median } from './generateBaselineStats'

describe('generateBaselineStats', () => {
  it('computes median for even and odd lists', () => {
    expect(median([])).toBe(0)
    expect(median([7, 1, 4])).toBe(4)
    expect(median([10, 2, 4, 8])).toBe(6)
  })

  it('builds reason distributions with top and other buckets', () => {
    expect(
      buildReasonDistribution(
        { B: 2, A: 5, C: 1, D: 1 },
        9,
        100,
        2,
      ),
    ).toEqual({
      top: { A: 5, B: 2 },
      other: 2,
      total: 9,
      coveragePct: 100,
    })
  })
})
