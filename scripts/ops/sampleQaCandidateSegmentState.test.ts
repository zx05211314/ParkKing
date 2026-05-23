import { describe, expect, it } from 'vitest'
import type { FeatureCollection } from 'geojson'
import type { ParkingSpaceCollection } from '../../src/data/parkingSpaces'
import { buildQaCandidateSegments } from './sampleQaCandidateSegmentState'
import type { QaLineCollection } from './sampleQaCandidateDataset'

describe('sampleQaCandidateSegmentState', () => {
  it('builds curb and inferred segments and applies matching sign overrides', () => {
    const redYellow: QaLineCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'seg-yellow', color: 'yellow' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.5004, 25.0504],
              [121.5009, 25.0507],
            ],
          },
        },
      ],
    }
    const inferredCandidates: QaLineCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'cand-1', riskTags: ['MAJOR_ROAD'] },
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.501, 25.051],
              [121.5012, 25.0512],
            ],
          },
        },
      ],
    }
    const signOverrides: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            segmentId: 'seg-yellow',
            note: 'Override fixture',
            confidence: 'HIGH',
            timeWindows: [
              {
                label: 'Any',
                startHHMM: '00:00',
                endHHMM: '23:59',
              },
            ],
          },
          geometry: {
            type: 'Point',
            coordinates: [121.50045, 25.05045],
          },
        },
      ],
    }
    const parkingSpaces: ParkingSpaceCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 'space-1' },
          geometry: {
            type: 'Point',
            coordinates: [121.50045, 25.05045],
          },
        },
      ],
    }

    const segments = buildQaCandidateSegments({
      redYellow,
      signOverrides,
      inferredCandidates,
      parkingSpaces,
      meta: {
        signOverrideMatchToleranceMeters: 20,
      },
    })

    expect(segments).toHaveLength(2)
    expect(segments.find((segment) => segment.id === 'seg-yellow')?.signOverride).toMatchObject({
      note: 'Override fixture',
      source: 'segmentId',
    })
    expect(
      segments.find((segment) => segment.id === 'seg-yellow')?.parkingSpaceCount,
    ).toBe(1)
    expect(
      segments.find((segment) => segment.id === 'cand-1')?.sourceType,
    ).toBe('INFERRED')
  })
})
