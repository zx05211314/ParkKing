import { describe, expect, it } from 'vitest'
import type { FeatureCollection, LineString } from 'geojson'
import { buildBenchmarkSegments } from './benchEvaluate'
import type { ParkingSpaceCollection } from '../../src/data/parkingSpaces'

describe('buildBenchmarkSegments', () => {
  it('propagates parking-space matches into benchmark segments', () => {
    const redYellow: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [121.56, 25.03],
              [121.561, 25.03],
            ],
          },
          properties: {
            id: 'seg-a',
            patype: '02',
          },
        },
      ],
    }

    const parkingSpaces: ParkingSpaceCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [121.5602, 25.03001],
          },
          properties: {},
        },
      ],
    }

    const segments = buildBenchmarkSegments({
      redYellow,
      parkingSpaces,
      signOverrides: { type: 'FeatureCollection', features: [] },
      inferredCandidates: { type: 'FeatureCollection', features: [] },
      meta: { signOverrideMatchToleranceMeters: 15 },
    })

    expect(segments).toEqual([
      expect.objectContaining({
        id: 'seg-a',
        curbMarking: 'YELLOW',
        parkingSpaceCount: 1,
      }),
    ])
  })
})
