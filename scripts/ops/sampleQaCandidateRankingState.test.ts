import { describe, expect, it } from 'vitest'
import type { FeatureCollection, Polygon } from 'geojson'
import type { Segment } from '../../src/ui/types'
import { rankQaCandidateSegments } from './sampleQaCandidateRankingState'
import type { QaPointCollection } from './sampleQaCandidateDataset'

const emptyPoints = (): QaPointCollection => ({
  type: 'FeatureCollection',
  features: [],
})

const emptyCrosswalks = (): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: [],
})

describe('sampleQaCandidateRankingState', () => {
  it('adds anchor distance and filters segments outside the requested radius', () => {
    const segments: Segment[] = [
      {
        id: 'near',
        name: 'Near',
        curbMarking: 'YELLOW',
        confidence: 'HIGH',
        sourceReliability: 'HIGH',
        dataFreshnessDays: 0,
        sourceType: 'CURB',
        source: 'CURB_MARKED',
        path: [
          [121.5001, 25.0501],
          [121.5002, 25.0502],
        ],
      },
      {
        id: 'far',
        name: 'Far',
        curbMarking: 'RED',
        confidence: 'HIGH',
        sourceReliability: 'HIGH',
        dataFreshnessDays: 0,
        sourceType: 'CURB',
        source: 'CURB_MARKED',
        path: [
          [121.51, 25.06],
          [121.5102, 25.0602],
        ],
      },
    ]

    const ranked = rankQaCandidateSegments({
      segments,
      busStops: emptyPoints(),
      hydrants: emptyPoints(),
      intersections: emptyPoints(),
      crosswalks: emptyCrosswalks(),
      meta: {
        datasetHash: 'demo-hash',
        boundaryCenter: [121.5001, 25.0501],
      },
      riskMode: 'NEUTRAL',
      radiusMeters: 100,
    })

    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.id).toBe('near')
    expect(ranked[0]?.distanceMeters).toBeLessThan(100)
    expect(typeof ranked[0]?.rankScore).toBe('number')
  })

  it('uses custom HH:MM when evaluating candidate availability', () => {
    const segments: Segment[] = [
      {
        id: 'yellow-night',
        name: 'Yellow Night',
        curbMarking: 'YELLOW',
        confidence: 'HIGH',
        sourceReliability: 'HIGH',
        dataFreshnessDays: 0,
        sourceType: 'CURB',
        source: 'CURB_MARKED',
        path: [
          [121.5001, 25.0501],
          [121.5002, 25.0502],
        ],
      },
    ]

    const ranked = rankQaCandidateSegments({
      segments,
      busStops: emptyPoints(),
      hydrants: emptyPoints(),
      intersections: emptyPoints(),
      crosswalks: emptyCrosswalks(),
      meta: {
        datasetHash: 'demo-hash',
        boundaryCenter: [121.5001, 25.0501],
      },
      riskMode: 'NEUTRAL',
      radiusMeters: 100,
      hhmm: '21:00',
    })

    expect(ranked[0]?.allowedNow).toBe('PARK')
    expect(ranked[0]?.reasonCodes).toContain('RULE_YELLOW_NIGHT_PARK_POSSIBLE')
  })

  it('uses a custom anchor instead of the district boundary center', () => {
    const segments: Segment[] = [
      {
        id: 'shipai',
        name: 'Shipai',
        curbMarking: 'YELLOW',
        confidence: 'HIGH',
        sourceReliability: 'HIGH',
        dataFreshnessDays: 0,
        sourceType: 'CURB',
        source: 'CURB_MARKED',
        path: [[121.515, 25.114], [121.5152, 25.1142]],
      },
    ]

    const ranked = rankQaCandidateSegments({
      segments,
      busStops: emptyPoints(),
      hydrants: emptyPoints(),
      intersections: emptyPoints(),
      crosswalks: emptyCrosswalks(),
      meta: { boundaryCenter: [121.516, 25.153] },
      anchorLocation: [121.515, 25.114],
      riskMode: 'NEUTRAL',
      radiusMeters: 100,
    })

    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.id).toBe('shipai')
  })
})
