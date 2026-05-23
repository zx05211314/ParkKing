import { describe, expect, it } from 'vitest'
import {
  countParkingSpacesNearSegments,
  getParkingSpaceAnchor,
  getParkingSpaceLabel,
  getParkingSpaceMatches,
  getParkingSpaceMetadata,
  getPreferredParkingSpaceAnchor,
  type ParkingSpaceCollection,
} from './parkingSpaces'
import type { Segment } from '../ui/types'

const makeSegment = (
  id: string,
  path: [number, number][],
): Segment => ({
  id,
  name: id,
  curbMarking: 'WHITE_EDGE',
  confidence: 'HIGH',
  path,
})

describe('getParkingSpaceAnchor', () => {
  it('returns the representative point for polygon and line geometries', () => {
    const polygonAnchor = getParkingSpaceAnchor({
      type: 'Polygon',
      coordinates: [[
        [121.56, 25.03],
        [121.5602, 25.03],
        [121.5602, 25.0302],
        [121.56, 25.0302],
        [121.56, 25.03],
      ]],
    })
    const lineAnchor = getParkingSpaceAnchor({
      type: 'LineString',
      coordinates: [
        [121.56, 25.03],
        [121.5602, 25.0302],
      ],
    })

    expect(polygonAnchor).not.toBeNull()
    expect(lineAnchor).not.toBeNull()
    expect(polygonAnchor?.[0]).toBeCloseTo(121.56008, 8)
    expect(polygonAnchor?.[1]).toBeCloseTo(25.03008, 8)
    expect(lineAnchor?.[0]).toBeCloseTo(121.5601, 8)
    expect(lineAnchor?.[1]).toBeCloseTo(25.0301, 8)
  })
})

describe('countParkingSpacesNearSegments', () => {
  it('adds parking-space counts to nearby segments', () => {
    const segments = [
      makeSegment('near', [
        [121.56, 25.03],
        [121.561, 25.03],
      ]),
      makeSegment('far', [
        [121.57, 25.04],
        [121.571, 25.04],
      ]),
    ]
    const parkingSpaces: ParkingSpaceCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [121.5604, 25.03002],
          },
          properties: {},
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [121.5705, 25.04002],
          },
          properties: {},
        },
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [121.58, 25.05],
          },
          properties: {},
        },
      ],
    }

    expect(countParkingSpacesNearSegments(segments, parkingSpaces)).toEqual([
      expect.objectContaining({ id: 'near', parkingSpaceCount: 1 }),
      expect.objectContaining({ id: 'far', parkingSpaceCount: 1 }),
    ])
  })

  it('returns zero counts when there are no parking spaces', () => {
    expect(
      countParkingSpacesNearSegments(
        [makeSegment('empty', [[121.56, 25.03], [121.561, 25.03]])],
        { type: 'FeatureCollection', features: [] },
      ),
    ).toEqual([
      expect.objectContaining({ id: 'empty', parkingSpaceCount: 0 }),
    ])
  })
})

describe('getPreferredParkingSpaceAnchor', () => {
  it('returns sorted matched spaces with distance metadata', () => {
    const matches = getParkingSpaceMatches(
      [
        [121.56, 25.03],
        [121.561, 25.03],
      ],
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [121.5608, 25.03001],
            },
            properties: {},
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [121.5602, 25.03001],
            },
            properties: {},
          },
        ],
      },
      [121.5601, 25.0302],
    )

    expect(matches).toHaveLength(2)
    expect(matches[0]).toEqual(
      expect.objectContaining({
        anchor: [121.5602, 25.03001],
      }),
    )
    expect(matches[0].distanceToReferenceMeters).toBeLessThan(
      matches[1].distanceToReferenceMeters,
    )
    expect(matches[0].key).not.toBe(matches[1].key)
  })

  it('selects the nearest matched marked space from the origin', () => {
    const anchor = getPreferredParkingSpaceAnchor(
      [
        [121.56, 25.03],
        [121.561, 25.03],
      ],
      {
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
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [121.5608, 25.03001],
            },
            properties: {},
          },
        ],
      },
      [121.5601, 25.0302],
    )

    expect(anchor).toEqual([121.5602, 25.03001])
  })
})

describe('parking-space metadata helpers', () => {
  it('prefers dataset labels and extracts status and fee metadata', () => {
    const properties = {
      stall_name: 'A-17',
      status_text: 'Open',
      fee_note: 'Paid 20 TWD/hr',
      lane_type: 'Parallel',
    }

    expect(getParkingSpaceLabel(properties, 'Space 1')).toBe('A-17')
    expect(getParkingSpaceMetadata(properties)).toEqual([
      'Open',
      'Parallel',
      'Paid 20 TWD/hr',
    ])
  })

  it('falls back when no useful metadata fields exist', () => {
    expect(getParkingSpaceLabel({ misc: 'value' }, 'Space 1')).toBe('Space 1')
    expect(getParkingSpaceMetadata({ misc: 'value' })).toEqual([])
  })
})
