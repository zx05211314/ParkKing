import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createRoutingProxyService,
  resolveRoutingProxyConfig,
} from './routingProxy'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveRoutingProxyConfig', () => {
  it('uses defaults when env vars are absent', () => {
    const config = resolveRoutingProxyConfig({}, 'C:/tmp/parkking')

    expect(config).toEqual({
      primary: {
        endpoint: 'https://router.project-osrm.org',
      },
      fallback: null,
      cacheTtlMs: 1800000,
      requestTimeoutMs: 8000,
      cacheFile: 'C:\\tmp\\parkking\\.tmp\\route-cache.json',
      userAgent: 'ParkKing routing proxy/1.0',
      path: '/api/route',
      port: 8788,
    })
  })
})

describe('createRoutingProxyService', () => {
  it('caches successful results on disk and avoids a second upstream request', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-route-cache-'))
    const cacheFile = join(tempRoot, 'cache.json')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        durations: [[300]],
        distances: [[420]],
      }),
    })

    const service = createRoutingProxyService(
      {
        primary: {
          endpoint: 'https://route.example.com',
        },
        fallback: null,
        cacheTtlMs: 60000,
        requestTimeoutMs: 8000,
        cacheFile,
        userAgent: 'ParkKing test',
        path: '/api/route',
        port: 8788,
      },
      {
        fetchImpl,
        now: () => 1000,
      },
    )

    const request = {
      profile: 'walking' as const,
      origin: [121.5645, 25.0338] as [number, number],
      destinations: [[121.565, 25.034]] as [number, number][],
    }

    await expect(service.route(request)).resolves.toEqual([
      {
        destination: [121.565, 25.034],
        distanceMeters: 420,
        durationSeconds: 300,
        estimated: false,
      },
    ])
    await expect(service.route(request)).resolves.toHaveLength(1)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await expect(readFile(cacheFile, 'utf8')).resolves.toContain('"distanceMeters": 420')
  })

  it('falls back to the secondary provider when the primary provider fails', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-route-fallback-'))
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'Ok',
          durations: [[180]],
          distances: [[510]],
        }),
      })

    const service = createRoutingProxyService(
      {
        primary: {
          endpoint: 'https://route.example.com',
        },
        fallback: {
          endpoint: 'https://route-backup.example.com',
        },
        cacheTtlMs: 60000,
        requestTimeoutMs: 8000,
        cacheFile: join(tempRoot, 'cache.json'),
        userAgent: 'ParkKing test',
        path: '/api/route',
        port: 8788,
      },
      {
        fetchImpl,
      },
    )

    await expect(
      service.route({
        profile: 'driving',
        origin: [121.5645, 25.0338],
        destinations: [[121.565, 25.034]],
      }),
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

  it('returns null route values when the upstream reports no table', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-route-notable-'))
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        code: 'NoTable',
        message: 'No route found',
      }),
    })

    const service = createRoutingProxyService(
      {
        primary: {
          endpoint: 'https://route.example.com',
        },
        fallback: null,
        cacheTtlMs: 60000,
        requestTimeoutMs: 8000,
        cacheFile: join(tempRoot, 'cache.json'),
        userAgent: 'ParkKing test',
        path: '/api/route',
        port: 8788,
      },
      {
        fetchImpl,
      },
    )

    await expect(
      service.route({
        profile: 'walking',
        origin: [121.5645, 25.0338],
        destinations: [[121.565, 25.034]],
      }),
    ).resolves.toEqual([
      {
        destination: [121.565, 25.034],
        distanceMeters: null,
        durationSeconds: null,
        estimated: false,
      },
    ])
  })

  it('returns a route geometry payload for selected-path requests', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-route-path-'))
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            duration: 280,
            distance: 460,
            geometry: {
              coordinates: [
                [121.5645, 25.0338],
                [121.565, 25.034],
              ],
            },
          },
        ],
      }),
    })

    const service = createRoutingProxyService(
      {
        primary: {
          endpoint: 'https://route.example.com',
        },
        fallback: null,
        cacheTtlMs: 60000,
        requestTimeoutMs: 8000,
        cacheFile: join(tempRoot, 'cache.json'),
        userAgent: 'ParkKing test',
        path: '/api/route',
        port: 8788,
      },
      {
        fetchImpl,
      },
    )

    await expect(
      service.routePath({
        profile: 'walking',
        origin: [121.5645, 25.0338],
        destination: [121.565, 25.034],
      }),
    ).resolves.toEqual({
      destination: [121.565, 25.034],
      distanceMeters: 460,
      durationSeconds: 280,
      estimated: false,
      geometry: [
        [121.5645, 25.0338],
        [121.565, 25.034],
      ],
    })
  })
})
