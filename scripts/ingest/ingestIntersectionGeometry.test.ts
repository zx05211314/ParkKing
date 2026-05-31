import { describe, expect, it } from 'vitest'
import {
  angularSpread,
  buildHistogram,
  endpointBearings,
  extractLines,
  normalizeBearing,
} from './ingestIntersectionGeometry'

describe('ingestIntersectionGeometry', () => {
  it('extracts lines from geometry variants', () => {
    expect(
      extractLines({
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
        ],
      }),
    ).toHaveLength(1)

    expect(
      extractLines({
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [1, 1],
            ],
          },
          {
            type: 'MultiLineString',
            coordinates: [
              [
                [1, 1],
                [2, 2],
              ],
            ],
          },
        ],
      }),
    ).toHaveLength(2)
  })

  it('normalizes bearings and computes spreads and histograms', () => {
    expect(normalizeBearing(-10)).toBe(350)
    expect(endpointBearings([
      [121.5, 25],
      [121.6, 25],
    ]).startBearing).toBeGreaterThanOrEqual(0)
    expect(angularSpread([0, 90, 180])).toBe(180)
    expect(buildHistogram([0, 14, 15, 359], 15)).toMatchObject({
      '0-14': 2,
      '15-29': 1,
      '345-359': 1,
    })
  })
})
