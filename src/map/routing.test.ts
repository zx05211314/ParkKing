import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildRoutePathUrl,
  buildRoutingUrl,
  getRoutingRuntimeAvailability,
  isRoutingAvailabilityMessage,
  resolveRoutingConfig,
  ROUTING_MATRIX_DEGRADED_MESSAGE,
  searchRoutePath,
  searchRouteMatrix,
} from './routing'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveRoutingConfig', () => {
  it('uses the default proxy endpoint', () => {
    expect(resolveRoutingConfig({})).toEqual({
      primary: {
        endpoint: '/api/route',
      },
      fallback: null,
    })
  })

  it('uses configured values when present', () => {
    expect(
      resolveRoutingConfig({
        VITE_ROUTING_URL: 'https://route.example.com/api/route',
        VITE_ROUTING_FALLBACK_URL: 'https://route-backup.example.com/api/route',
      }),
    ).toEqual({
      primary: {
        endpoint: 'https://route.example.com/api/route',
      },
      fallback: {
        endpoint: 'https://route-backup.example.com/api/route',
      },
    })
  })

  it('defaults to the local proxy on localhost when no endpoint is configured', () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'localhost',
        origin: 'http://localhost:5173',
      },
    })

    expect(resolveRoutingConfig({})).toEqual({
      primary: {
        endpoint: '/api/route',
      },
      fallback: null,
    })
  })
})

describe('isRoutingAvailabilityMessage', () => {
  it('identifies deployment-availability routing notes', () => {
    expect(
      isRoutingAvailabilityMessage(
        'Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available.',
      ),
    ).toBe(true)
    expect(
      isRoutingAvailabilityMessage(
        'Live map routing is not configured for this deployment. External Walk/Drive links still work.',
      ),
    ).toBe(true)
    expect(isRoutingAvailabilityMessage('Routing request failed with 500.')).toBe(false)
  })
})

describe('getRoutingRuntimeAvailability', () => {
  it('treats explicit routing endpoints as available', () => {
    expect(
      getRoutingRuntimeAvailability({
        primary: {
          endpoint: 'https://route.example.com/api/route',
        },
        fallback: null,
      }),
    ).toEqual({
      etaAvailable: true,
      etaMessage: null,
      pathAvailable: true,
      pathMessage: null,
    })
  })

  it('treats the implicit production proxy as unavailable in the browser', () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'parkking.example.com',
        origin: 'https://parkking.example.com',
      },
    })

    expect(
      getRoutingRuntimeAvailability({
        primary: {
          endpoint: '/api/route',
        },
        fallback: null,
      }),
    ).toEqual({
      etaAvailable: false,
      etaMessage:
        'Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available.',
      pathAvailable: false,
      pathMessage:
        'Live map routing is not configured for this deployment. External Walk/Drive links still work.',
    })
  })
})

describe('buildRoutingUrl', () => {
  it('serializes origin, destinations, and profile into the proxy url', () => {
    const url = new URL(
      buildRoutingUrl(
        [121.5645, 25.0338],
        [
          [121.565, 25.034],
          [121.566, 25.035],
        ],
        'walking',
        {
          endpoint: '/api/route',
        },
      ),
    )

    expect(url.pathname).toBe('/api/route')
    expect(url.searchParams.get('origin')).toBe('121.5645,25.0338')
    expect(url.searchParams.get('destinations')).toBe(
      '121.565,25.034;121.566,25.035',
    )
    expect(url.searchParams.get('profile')).toBe('walking')
  })
})

describe('buildRoutePathUrl', () => {
  it('serializes origin, destination, profile, and mode into the proxy url', () => {
    const url = new URL(
      buildRoutePathUrl(
        [121.5645, 25.0338],
        [121.565, 25.034],
        'driving',
        {
          endpoint: '/api/route',
        },
      ),
    )

    expect(url.pathname).toBe('/api/route')
    expect(url.searchParams.get('origin')).toBe('121.5645,25.0338')
    expect(url.searchParams.get('destination')).toBe('121.565,25.034')
    expect(url.searchParams.get('profile')).toBe('driving')
    expect(url.searchParams.get('mode')).toBe('path')
  })
})

describe('searchRouteMatrix', () => {
  it('returns route entries from the proxy response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            destination: [121.565, 25.034],
            distanceMeters: 420,
            durationSeconds: 320,
            estimated: false,
          },
        ],
      }),
    })

    await expect(
      searchRouteMatrix(
        [121.5645, 25.0338],
        [[121.565, 25.034]],
        'walking',
        {
          config: {
            primary: {
              endpoint: 'https://route.example.com/api/route',
            },
            fallback: null,
          },
          fetchImpl,
        },
      ),
    ).resolves.toEqual([
      {
        destination: [121.565, 25.034],
        distanceMeters: 420,
        durationSeconds: 320,
        estimated: false,
      },
    ])
  })

  it('falls back to the secondary endpoint when the primary fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          routes: [
            {
              destination: [121.565, 25.034],
              distanceMeters: 510,
              durationSeconds: 180,
              estimated: false,
            },
          ],
        }),
      })

    await expect(
      searchRouteMatrix(
        [121.5645, 25.0338],
        [[121.565, 25.034]],
        'driving',
        {
          config: {
            primary: {
              endpoint: 'https://route.example.com/api/route',
            },
            fallback: {
              endpoint: 'https://route-backup.example.com/api/route',
            },
          },
          fetchImpl,
        },
      ),
    ).resolves.toEqual([
      {
        destination: [121.565, 25.034],
        distanceMeters: 510,
        durationSeconds: 180,
        estimated: false,
      },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[1][0]).toContain('route-backup.example.com')
  })

  it('returns a clear deployment message when the implicit proxy is missing', async () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'parkking.example.com',
        origin: 'https://parkking.example.com',
      },
    })

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => null,
    })

    await expect(
      searchRouteMatrix(
        [121.5645, 25.0338],
        [[121.565, 25.034]],
        'walking',
        {
          config: {
            primary: {
              endpoint: '/api/route',
            },
            fallback: null,
          },
          fetchImpl,
        },
      ),
    ).rejects.toThrow(
      'Live ETA routing is not configured for this deployment. Nearby ranking will stay on distance fallback until /api/route or VITE_ROUTING_URL is available.',
    )
  })

  it('checks local route proxy readiness before ETA routing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          service: 'routing-proxy',
          status: 'ok',
          issues: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          routes: [
            {
              destination: [121.565, 25.034],
              distanceMeters: 420,
              durationSeconds: 320,
              estimated: false,
            },
          ],
        }),
      })

    await expect(
      searchRouteMatrix(
        [121.5645, 25.0338],
        [[121.565, 25.034]],
        'walking',
        {
          config: {
            primary: {
              endpoint: '/api/route',
            },
            fallback: null,
          },
          fetchImpl,
        },
      ),
    ).resolves.toEqual([
      {
        destination: [121.565, 25.034],
        distanceMeters: 420,
        durationSeconds: 320,
        estimated: false,
      },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost/api/route/ready')
    expect(fetchImpl.mock.calls[1][0]).toContain('/api/route?')
  })

  it('surfaces degraded local route proxy readiness before ETA routing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        service: 'routing-proxy',
        status: 'degraded',
        issues: ['primary endpoint is not a valid http(s) URL'],
      }),
    })

    await expect(
      searchRouteMatrix(
        [121.5645, 25.0338],
        [[121.565, 25.034]],
        'walking',
        {
          config: {
            primary: {
              endpoint: '/api/route',
            },
            fallback: null,
          },
          fetchImpl,
        },
      ),
    ).rejects.toThrow(
      `${ROUTING_MATRIX_DEGRADED_MESSAGE}: primary endpoint is not a valid http(s) URL`,
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('searchRoutePath', () => {
  it('returns a route path from the proxy response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        route: {
          destination: [121.565, 25.034],
          distanceMeters: 620,
          durationSeconds: 380,
          estimated: false,
          geometry: [
            [121.5645, 25.0338],
            [121.565, 25.034],
          ],
        },
      }),
    })

    await expect(
      searchRoutePath(
        [121.5645, 25.0338],
        [121.565, 25.034],
        'walking',
        {
          config: {
            primary: {
              endpoint: 'https://route.example.com/api/route',
            },
            fallback: null,
          },
          fetchImpl,
        },
      ),
    ).resolves.toEqual({
      destination: [121.565, 25.034],
      distanceMeters: 620,
      durationSeconds: 380,
      estimated: false,
      geometry: [
        [121.5645, 25.0338],
        [121.565, 25.034],
      ],
    })
  })

  it('returns a clear deployment message when the implicit path proxy is missing', async () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'parkking.example.com',
        origin: 'https://parkking.example.com',
      },
    })

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => null,
    })

    await expect(
      searchRoutePath(
        [121.5645, 25.0338],
        [121.565, 25.034],
        'walking',
        {
          config: {
            primary: {
              endpoint: '/api/route',
            },
            fallback: null,
          },
          fetchImpl,
        },
      ),
    ).rejects.toThrow(
      'Live map routing is not configured for this deployment. External Walk/Drive links still work.',
    )
  })
})
