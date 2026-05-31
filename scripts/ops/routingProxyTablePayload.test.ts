import { describe, expect, it } from 'vitest'
import { normalizeOsrmTablePayload } from './routingProxyTablePayload'

describe('normalizeOsrmTablePayload', () => {
  it('preserves no-table payloads as null matrix entries', () => {
    expect(
      normalizeOsrmTablePayload(
        { code: 'NoTable' },
        [
          [121.5, 25.03],
          [121.6, 25.04],
        ],
      ),
    ).toEqual([
      {
        destination: [121.5, 25.03],
        distanceMeters: null,
        durationSeconds: null,
        estimated: false,
      },
      {
        destination: [121.6, 25.04],
        distanceMeters: null,
        durationSeconds: null,
        estimated: false,
      },
    ])
  })
})
