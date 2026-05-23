import { describe, expect, it } from 'vitest'
import {
  getDiffPackCountField,
  getDiffPackSegmentsCount,
  parseDiffPackMetricBBox,
} from './diffPackMetricFields'

describe('diffPackMetricFields', () => {
  it('reads counts from both direct and nested metadata shapes', () => {
    expect(getDiffPackSegmentsCount({ segmentsCount: '12' })).toBe(12)
    expect(getDiffPackSegmentsCount({ counts: { segments: 7 } })).toBe(7)
    expect(getDiffPackCountField({ counts: { signOverrides: '3' } }, 'signOverrides')).toBe(3)
  })

  it('parses bbox objects only when all coordinates are numeric', () => {
    expect(
      parseDiffPackMetricBBox({ minX: 0, minY: 1, maxX: '2', maxY: 3 }),
    ).toEqual({
      minX: 0,
      minY: 1,
      maxX: 2,
      maxY: 3,
    })
    expect(parseDiffPackMetricBBox({ minX: 0, minY: 1, maxX: 2 })).toBeNull()
  })
})
