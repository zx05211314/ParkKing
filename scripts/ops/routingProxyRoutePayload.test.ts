import { describe, expect, it } from 'vitest'
import { normalizeOsrmRoutePayload } from './routingProxyRoutePayload'

describe('normalizeOsrmRoutePayload', () => {
  it('drops invalid route geometry instead of returning bad coordinates', () => {
    expect(
      normalizeOsrmRoutePayload(
        {
          code: 'Ok',
          routes: [
            {
              distance: 100,
              duration: 60,
              geometry: {
                coordinates: [[121.5, 25.03]],
              },
            },
          ],
        },
        [121.5, 25.03],
      ),
    ).toEqual({
      destination: [121.5, 25.03],
      distanceMeters: 100,
      durationSeconds: 60,
      estimated: false,
      geometry: null,
    })
  })
})
