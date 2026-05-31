import { describe, expect, it } from 'vitest'
import {
  extractLines,
  extractRepresentativePoint,
  midpointForLine,
} from './ingestCandidateGeometry'

describe('ingestCandidateGeometry', () => {
  it('extracts lines from line and geometry collections', () => {
    expect(
      extractLines({
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'LineString',
            coordinates: [
              [121.5, 25.0],
              [121.6, 25.1],
            ],
          },
          {
            type: 'MultiLineString',
            coordinates: [
              [
                [121.7, 25.2],
                [121.8, 25.3],
              ],
            ],
          },
          {
            type: 'Point',
            coordinates: [121.9, 25.4],
          },
        ],
      }),
    ).toEqual([
      [
        [121.5, 25.0],
        [121.6, 25.1],
      ],
      [
        [121.7, 25.2],
        [121.8, 25.3],
      ],
    ])
  })

  it('derives representative lines from polygon road surfaces', () => {
    const lines = extractLines({
      type: 'Polygon',
      coordinates: [[
        [121.5, 25.0],
        [121.5003, 25.0001],
        [121.5012, 25.0004],
        [121.5011, 25.0007],
        [121.4999, 25.0003],
        [121.5, 25.0],
      ]],
    })

    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveLength(2)
    expect(lines[0]?.[0]).not.toEqual(lines[0]?.[1])
  })

  it('returns line midpoints safely', () => {
    expect(midpointForLine([])).toBeNull()
    expect(
      midpointForLine([
        [121.5, 25.0],
        [121.6, 25.1],
        [121.7, 25.2],
      ]),
    ).toEqual([121.6, 25.1])
  })

  it('finds representative points across geometry types', () => {
    expect(
      extractRepresentativePoint({
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [121.5, 25.0],
              [121.6, 25.0],
              [121.6, 25.1],
              [121.5, 25.0],
            ],
          ],
        ],
      }),
    ).toEqual([121.5, 25.0])

    expect(
      extractRepresentativePoint({
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [121.7, 25.2] },
          {
            type: 'LineString',
            coordinates: [
              [121.8, 25.3],
              [121.9, 25.4],
            ],
          },
        ],
      }),
    ).toEqual([121.7, 25.2])
  })
})
