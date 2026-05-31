import { featureCollection, lineString, point } from '@turf/turf'
import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import { buildQualityMetrics, countRiskTags } from './ingestDatasetQualityMetrics'

describe('ingestDatasetQualityMetrics', () => {
  it('counts risk tags across alternate property shapes', () => {
    const collection = featureCollection([
      point([121.5, 25.0], { riskTags: ['night', 'clearance'] }) as never,
      point([121.6, 25.1], { risk_tag: 'night;hydrant' }) as never,
      point([121.7, 25.2], { risk_tags: 'clearance' }) as never,
    ]) as FeatureCollection

    expect(countRiskTags(collection)).toEqual({
      night: 2,
      clearance: 2,
      hydrant: 1,
    })
  })

  it('builds quality metrics from segment geometry', () => {
    const redYellow = featureCollection([
      lineString(
        [
          [121.5, 25.0],
          [121.5005, 25.0005],
        ],
        { color: 'red' },
      ),
    ])

    expect(buildQualityMetrics(null, null, 5)).toEqual({
      segmentsCount: 0,
      curbMarkingKnownRate: 0,
      restrictionTriggeredRate: 0,
      signOverrideMatchedSegmentCount: 0,
      signOverrideSpatialMatchCount: 0,
      signOverrideUnmatchedNamedCount: 0,
    })

    const metrics = buildQualityMetrics(redYellow, null, 5)
    expect(metrics.segmentsCount).toBeGreaterThan(0)
    expect(metrics.curbMarkingKnownRate).toBe(1)
    expect(metrics.restrictionTriggeredRate).toBe(1)
    expect(metrics.signOverrideMatchedSegmentCount).toBe(0)
    expect(metrics.signOverrideSpatialMatchCount).toBe(0)
    expect(metrics.signOverrideUnmatchedNamedCount).toBe(0)
  })

  it('reports unmatched named sign overrides without spatially rematching them', () => {
    const redYellow = featureCollection([
      lineString(
        [
          [121.5, 25.0],
          [121.5005, 25.0005],
        ],
        { id: 'seg-1', color: 'yellow' },
      ),
    ])
    const overrides = featureCollection([
      point([121.5002, 25.0002], {
        segmentId: 'seg-1',
        status: 'LEGAL',
        note: 'Matched override',
        confidence: 'HIGH',
      }),
      point([121.5002, 25.0002], {
        segmentId: 'seg-missing',
        override_source: 'USER',
        status: 'UNCLEAR',
        note: 'Stale segment id',
        confidence: 'HIGH',
      }),
    ])

    const metrics = buildQualityMetrics(redYellow, overrides, 15)

    expect(metrics.signOverrideMatchedSegmentCount).toBe(1)
    expect(metrics.signOverrideSpatialMatchCount).toBe(0)
    expect(metrics.signOverrideUnmatchedNamedCount).toBe(1)
  })

  it('counts exact-id inferred override matches without adding inferred segments to official quality rates', () => {
    const redYellow = featureCollection([
      lineString(
        [
          [121.5, 25.0],
          [121.5005, 25.0005],
        ],
        { id: 'seg-1', color: 'yellow' },
      ),
    ])
    const inferred = featureCollection([
      lineString(
        [
          [121.6, 25.1],
          [121.6005, 25.1005],
        ],
        { id: 'candidate-1-L' },
      ),
    ])
    const overrides = featureCollection([
      point([121.6002, 25.1002], {
        segmentId: 'candidate-1-L',
        override_source: 'USER',
        status: 'LEGAL',
        note: 'Reviewed inferred candidate',
        confidence: 'HIGH',
      }),
    ])

    const metrics = buildQualityMetrics(redYellow, overrides, 15, inferred)

    expect(metrics.segmentsCount).toBe(1)
    expect(metrics.signOverrideMatchedSegmentCount).toBe(1)
    expect(metrics.signOverrideUnmatchedNamedCount).toBe(0)
  })
})
