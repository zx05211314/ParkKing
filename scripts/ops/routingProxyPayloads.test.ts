import { describe, expect, it } from 'vitest'
import {
  extractRoutingUpstreamMessage,
  normalizeOsrmRoutePayload,
  normalizeOsrmTablePayload,
} from './routingProxyPayloads'

describe('extractRoutingUpstreamMessage', () => {
  it('prefers upstream payload messages when present', () => {
    expect(extractRoutingUpstreamMessage(502, { message: 'upstream unavailable' })).toBe(
      'upstream unavailable',
    )
  })
})

describe('normalizeOsrmTablePayload', () => {
  it('marks fallback-speed cells as estimated', () => {
    expect(
      normalizeOsrmTablePayload(
        {
          code: 'Ok',
          durations: [[120, 240]],
          distances: [[100, 200]],
          fallback_speed_cells: [[0, 1]],
        },
        [
          [121.5, 25.03],
          [121.6, 25.04],
        ],
      ),
    ).toEqual([
      {
        destination: [121.5, 25.03],
        distanceMeters: 100,
        durationSeconds: 120,
        estimated: false,
      },
      {
        destination: [121.6, 25.04],
        distanceMeters: 200,
        durationSeconds: 240,
        estimated: true,
      },
    ])
  })
})

describe('normalizeOsrmRoutePayload', () => {
  it('preserves no-route payloads as empty route entries', () => {
    expect(
      normalizeOsrmRoutePayload(
        { code: 'NoRoute' },
        [121.565, 25.034],
      ),
    ).toEqual({
      destination: [121.565, 25.034],
      distanceMeters: null,
      durationSeconds: null,
      estimated: false,
      geometry: null,
    })
  })
})
