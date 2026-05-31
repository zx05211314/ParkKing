import { describe, expect, it } from 'vitest'
import {
  calcDiffPackBBoxDelta,
  calcDiffPackCenterDelta,
  hasMetaChanges,
} from './diffPackMetricDeltas'

describe('diffPackMetricDeltas', () => {
  it('builds bbox and center deltas with derived area and distance', () => {
    const bbox = calcDiffPackBBoxDelta(
      { minX: 0, minY: 0, maxX: 2, maxY: 1 },
      { minX: 1, minY: 1, maxX: 3, maxY: 2 },
    )
    const center = calcDiffPackCenterDelta([1, 1], [4, 5])

    expect(bbox.delta).toEqual({ minX: 1, minY: 1, maxX: 1, maxY: 1 })
    expect(bbox.area.delta).toBe(0)
    expect(center.delta).toEqual([3, 4])
    expect(center.distance).toBe(5)
  })

  it('detects unchanged meta when all deltas are zero and provenance is stable', () => {
    expect(
      hasMetaChanges({
        segmentsCount: { prev: 1, next: 1, delta: 0, deltaPct: 0 },
        overridesAppliedCount: { prev: 2, next: 2, delta: 0, deltaPct: 0 },
        signOverridesCount: { prev: 3, next: 3, delta: 0, deltaPct: 0 },
        signOverrideUnmatchedNamedCount: { prev: 0, next: 0, delta: 0, deltaPct: null },
        curbMarkingKnownRate: { prev: 0.5, next: 0.5, delta: 0, deltaPct: 0 },
        restrictionTriggeredRate: { prev: 0.25, next: 0.25, delta: 0, deltaPct: 0 },
        boundaryBBox: {
          prev: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
          next: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
          delta: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
          area: { prev: 1, next: 1, delta: 0, deltaPct: 0 },
        },
        boundaryCenter: {
          prev: [0.5, 0.5],
          next: [0.5, 0.5],
          delta: [0, 0],
          distance: 0,
        },
        provenanceFetchedAt: {
          prev: 'same',
          next: 'same',
          changed: false,
        },
      }),
    ).toBe(false)
  })
})
