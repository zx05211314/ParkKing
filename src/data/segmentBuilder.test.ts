import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Feature, LineString } from 'geojson'
import {
  applySignOverrides,
  applySignOverridesWithStats,
  buildSegmentsFromFeature,
} from './segmentBuilder'
import type { Segment } from '../ui/types'

const makeFeature = (
  properties: Record<string, unknown>,
): Feature<LineString> => ({
  type: 'Feature',
  properties,
  geometry: {
    type: 'LineString',
    coordinates: [
      [121.56, 25.03],
      [121.561, 25.031],
    ],
  },
})

describe('segmentBuilder', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps Taipei patype codes to curb markings and derives freshness from edit dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-22T00:00:00Z'))

    const red = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-red', patype: '01', edittime: '2026-03-20T00:00:00Z' }),
      0,
      null,
    )[0]
    const yellow = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-yellow', patype: '02', padate: '2026-03-10T00:00:00Z' }),
      1,
      null,
    )[0]

    expect(red?.curbMarking).toBe('RED')
    expect(red?.dataFreshnessDays).toBe(2)
    expect(yellow?.curbMarking).toBe('YELLOW')
    expect(yellow?.dataFreshnessDays).toBe(12)
  })

  it('infers curb markings from Chinese color text without patype codes', () => {
    const traditionalRed = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-red', color: '\u7d05\u7dda' }),
      0,
      null,
    )[0]
    const traditionalYellow = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-yellow', marking: '\u9ec3\u7dda' }),
      1,
      null,
    )[0]
    const simplifiedYellowFallback = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-yellow-simplified', description: '\u9ec4\u7ebf' }),
      2,
      null,
    )[0]

    expect(traditionalRed?.curbMarking).toBe('RED')
    expect(traditionalYellow?.curbMarking).toBe('YELLOW')
    expect(simplifiedYellowFallback?.curbMarking).toBe('YELLOW')
  })

  it('retains override status from applied sign-override features', () => {
    const segments = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-1', color: 'yellow' }),
      0,
      null,
    )
    const overrides = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [121.5605, 25.0305],
          },
          properties: {
            segmentId: 'seg-1',
            status: 'LEGAL',
            note: 'Official marked spaces on-site',
            confidence: 'HIGH',
          },
        },
      ],
    }

    const applied = applySignOverrides(segments, overrides, {
      matchToleranceMeters: 15,
    })

    expect(applied[0]?.signOverride).toEqual(
      expect.objectContaining({
        status: 'LEGAL',
        note: 'Official marked spaces on-site',
      }),
    )
  })

  it('does not spatially rematch user overrides when the segment id is missing', () => {
    const segments = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-1', color: 'yellow' }),
      0,
      null,
    )
    const overrides = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [121.5605, 25.0305],
          },
          properties: {
            segmentId: 'seg-missing',
            override_source: 'USER',
            status: 'LEGAL',
            note: 'Typo in reported segment id',
            confidence: 'HIGH',
          },
        },
      ],
    }

    const applied = applySignOverrides(segments, overrides, {
      matchToleranceMeters: 15,
    })

    expect(applied[0]?.signOverride).toBeUndefined()
  })

  it('still spatially matches dataset overrides without a segment id', () => {
    const segments = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-1', color: 'yellow' }),
      0,
      null,
    )
    const overrides = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [121.5605, 25.0305],
          },
          properties: {
            status: 'LEGAL',
            note: 'Fallback spatial override',
            confidence: 'HIGH',
          },
        },
      ],
    }

    const applied = applySignOverrides(segments, overrides, {
      matchToleranceMeters: 15,
    })

    expect(applied[0]?.signOverride).toEqual(
      expect.objectContaining({
        status: 'LEGAL',
        note: 'Fallback spatial override',
        source: 'spatial',
      }),
    )
  })

  it('applies exact-id overrides to inferred segments without spatially matching them', () => {
    const inferred: Segment = {
      id: 'candidate-1-L',
      name: 'Inferred candidate',
      curbMarking: 'YELLOW',
      confidence: 'LOW',
      sourceType: 'INFERRED',
      source: 'INFERRED_CENTERLINE_OFFSET',
      path: [
        [121.56, 25.03],
        [121.561, 25.031],
      ],
    }
    const overrides = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [121.5605, 25.0305],
          },
          properties: {
            segmentId: 'candidate-1-L',
            override_source: 'USER',
            status: 'LEGAL',
            note: 'Reviewer confirmed inferred candidate',
            confidence: 'HIGH',
          },
        },
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [121.5605, 25.0305],
          },
          properties: {
            status: 'ILLEGAL',
            note: 'Spatial-only dataset override',
            confidence: 'HIGH',
          },
        },
      ],
    }

    const applied = applySignOverrides([inferred], overrides, {
      matchToleranceMeters: 15,
    })

    expect(applied[0]?.signOverride).toEqual(
      expect.objectContaining({
        status: 'LEGAL',
        note: 'Reviewer confirmed inferred candidate',
        source: 'segmentId',
      }),
    )
  })

  it('reports matched and unmatched override stats', () => {
    const segments = buildSegmentsFromFeature(
      makeFeature({ id: 'seg-1', color: 'yellow' }),
      0,
      null,
    )
    const overrides = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [121.5605, 25.0305],
          },
          properties: {
            segmentId: 'seg-1',
            status: 'LEGAL',
            note: 'Exact id match',
            confidence: 'HIGH',
          },
        },
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [121.5605, 25.0305],
          },
          properties: {
            segmentId: 'seg-missing',
            override_source: 'USER',
            status: 'UNCLEAR',
            note: 'Missing segment id',
            confidence: 'HIGH',
          },
        },
      ],
    }

    const result = applySignOverridesWithStats(segments, overrides, {
      matchToleranceMeters: 15,
    })

    expect(result.stats).toEqual({
      matchedBySegmentIdCount: 1,
      matchedBySpatialCount: 0,
      unmatchedNamedOverrideCount: 1,
    })
  })
})
