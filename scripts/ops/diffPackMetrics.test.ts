import { describe, expect, it } from 'vitest'
import { buildDistrictMetaDiff, hasMetaChanges } from './diffPackMetrics'

describe('diffPackMetrics', () => {
  it('builds count, bbox, center, and provenance deltas from mixed meta shapes', () => {
    const prevMeta = {
      counts: {
        segments: 100,
        overridesApplied: 5,
        signOverrides: 2,
        signOverrideMatchedSegmentCount: 2,
        signOverrideSpatialMatchCount: 0,
        signOverrideUnmatchedNamedCount: 0,
      },
      curbMarkingKnownRate: 0.9,
      restrictionTriggeredRate: 0.2,
      boundaryBBox: { minX: 0, minY: 0, maxX: 4, maxY: 2 },
      boundaryCenter: [2, 1],
      provenanceFetchedAt: '2026-03-20T00:00:00.000Z',
    }
    const nextMeta = {
      segmentsCount: 110,
      overridesAppliedCount: 7,
      signOverridesCount: 3,
      signOverrideMatchedSegmentCount: 2,
      signOverrideSpatialMatchCount: 1,
      signOverrideUnmatchedNamedCount: 2,
      curbMarkingKnownRate: 0.85,
      restrictionTriggeredRate: 0.19,
      boundaryBBox: { minX: 1, minY: 1, maxX: 5, maxY: 3 },
      boundaryCenter: [3, 2],
      provenanceFetchedAt: '2026-03-21T00:00:00.000Z',
    }

    const meta = buildDistrictMetaDiff(prevMeta, nextMeta)

    expect(meta.segmentsCount).toMatchObject({ prev: 100, next: 110, delta: 10 })
    expect(meta.overridesAppliedCount).toMatchObject({
      prev: 5,
      next: 7,
      delta: 2,
    })
    expect(meta.signOverridesCount).toMatchObject({ prev: 2, next: 3, delta: 1 })
    expect(meta.signOverrideMatchedSegmentCount).toMatchObject({
      prev: 2,
      next: 2,
      delta: 0,
    })
    expect(meta.signOverrideSpatialMatchCount).toMatchObject({
      prev: 0,
      next: 1,
      delta: 1,
    })
    expect(meta.signOverrideUnmatchedNamedCount).toMatchObject({
      prev: 0,
      next: 2,
      delta: 2,
    })
    expect(meta.boundaryBBox.delta).toEqual({ minX: 1, minY: 1, maxX: 1, maxY: 1 })
    expect(meta.boundaryCenter.delta).toEqual([1, 1])
    expect(meta.boundaryCenter.distance).toBeCloseTo(Math.sqrt(2))
    expect(meta.provenanceFetchedAt.changed).toBe(true)
  })

  it('detects unchanged meta when deltas are zero and provenance is stable', () => {
    const prevMeta = {
      segmentsCount: 5,
      overridesAppliedCount: 1,
      signOverridesCount: 1,
      signOverrideMatchedSegmentCount: 1,
      signOverrideSpatialMatchCount: 0,
      signOverrideUnmatchedNamedCount: 0,
      curbMarkingKnownRate: 0.5,
      restrictionTriggeredRate: 0.25,
      boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      boundaryCenter: [0.5, 0.5],
      provenanceFetchedAt: 'same',
    }
    const nextMeta = {
      segmentsCount: 5,
      overridesAppliedCount: 1,
      signOverridesCount: 1,
      signOverrideMatchedSegmentCount: 1,
      signOverrideSpatialMatchCount: 0,
      signOverrideUnmatchedNamedCount: 0,
      curbMarkingKnownRate: 0.5,
      restrictionTriggeredRate: 0.25,
      boundaryBBox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
      boundaryCenter: [0.5, 0.5],
      provenanceFetchedAt: 'same',
    }

    const meta = buildDistrictMetaDiff(prevMeta, nextMeta)

    expect(hasMetaChanges(meta)).toBe(false)
  })
})
