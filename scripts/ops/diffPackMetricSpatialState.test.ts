import { describe, expect, it } from 'vitest'
import { buildDiffPackSpatialDiffs } from './diffPackMetricSpatialState'

describe('diffPackMetricSpatialState', () => {
  it('builds rate, boundary, center, and provenance diffs', () => {
    const spatial = buildDiffPackSpatialDiffs(
      {
        curbMarkingKnownRate: 0.9,
        restrictionTriggeredRate: 0.2,
        boundaryBBox: { minX: 0, minY: 0, maxX: 4, maxY: 2 },
        boundaryCenter: [2, 1],
        provenanceFetchedAt: '2026-03-20T00:00:00.000Z',
      },
      {
        curbMarkingKnownRate: 0.85,
        restrictionTriggeredRate: 0.19,
        boundaryBBox: { minX: 1, minY: 1, maxX: 5, maxY: 3 },
        boundaryCenter: [3, 2],
        provenanceFetchedAt: '2026-03-21T00:00:00.000Z',
      },
    )

    expect(spatial.curbMarkingKnownRate.prev).toBe(0.9)
    expect(spatial.curbMarkingKnownRate.next).toBe(0.85)
    expect(spatial.curbMarkingKnownRate.delta).toBeCloseTo(-0.05)
    expect(spatial.boundaryBBox.delta).toEqual({ minX: 1, minY: 1, maxX: 1, maxY: 1 })
    expect(spatial.boundaryCenter.distance).toBeCloseTo(Math.sqrt(2))
    expect(spatial.provenanceFetchedAt.changed).toBe(true)
  })
})
