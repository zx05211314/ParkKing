import { describe, expect, it } from 'vitest'
import { hasValidCoordinates } from './reportGateGeometryCoordinates'

describe('reportGateGeometryCoordinates', () => {
  it('accepts finite coordinates and rejects malformed geometry collections', () => {
    expect(
      hasValidCoordinates({
        type: 'LineString',
        coordinates: [
          [121.5, 25.03],
          [121.6, 25.04],
        ],
      }),
    ).toBe(true)
    expect(
      hasValidCoordinates({
        type: 'GeometryCollection',
        geometries: [],
      }),
    ).toBe(false)
    expect(
      hasValidCoordinates({
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'Point',
            coordinates: [121.5, Number.NaN],
          },
        ],
      }),
    ).toBe(false)
  })
})
