import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createGeocodeProxyService,
  resolveGeocodeProxyConfig,
} from './geocodeProxy'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveGeocodeProxyConfig', () => {
  it('uses defaults when env vars are absent', () => {
    const config = resolveGeocodeProxyConfig({}, 'C:/tmp/parkking')

    expect(config).toEqual({
      primary: {
        endpoint: 'https://nominatim.openstreetmap.org/search',
        countryCodes: [],
      },
      fallback: null,
      limit: 5,
      cacheTtlMs: 21600000,
      requestTimeoutMs: 5000,
      cacheFile: 'C:\\tmp\\parkking\\.tmp\\geocoder-cache.json',
      userAgent: 'ParkKing geocoder proxy/1.0',
      path: '/api/geocode',
      port: 8787,
    })
  })
})

describe('createGeocodeProxyService', () => {
  it('caches successful results on disk and avoids a second upstream request', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-geocode-cache-'))
    const cacheFile = join(tempRoot, 'cache.json')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 1,
          display_name: 'Taipei Main Station',
          lat: '25.0478',
          lon: '121.5170',
        },
      ],
    })

    const service = createGeocodeProxyService({
      primary: {
        endpoint: 'https://geocode.example.com/search',
        countryCodes: ['tw'],
      },
      fallback: null,
      limit: 5,
      cacheTtlMs: 60000,
      requestTimeoutMs: 5000,
      cacheFile,
      userAgent: 'ParkKing test',
      path: '/api/geocode',
      port: 8787,
    }, {
      fetchImpl,
      now: () => 1000,
    })

    await expect(
      service.search({
        query: 'taipei main station',
        viewbox: '121.55,25.05,121.57,25.03',
        bounded: true,
      }),
    ).resolves.toHaveLength(1)

    await expect(
      service.search({
        query: 'taipei main station',
        viewbox: '121.55,25.05,121.57,25.03',
        bounded: true,
      }),
    ).resolves.toHaveLength(1)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await expect(readFile(cacheFile, 'utf8')).resolves.toContain('Taipei Main Station')
  })

  it('retries without bounds when the bounded upstream search returns no matches', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-geocode-retry-'))
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ place_id: 2, display_name: 'Taipei 101' }],
      })

    const service = createGeocodeProxyService({
      primary: {
        endpoint: 'https://geocode.example.com/search',
        countryCodes: [],
      },
      fallback: null,
      limit: 5,
      cacheTtlMs: 60000,
      requestTimeoutMs: 5000,
      cacheFile: join(tempRoot, 'cache.json'),
      userAgent: 'ParkKing test',
      path: '/api/geocode',
      port: 8787,
    }, {
      fetchImpl,
    })

    await expect(
      service.search({
        query: 'taipei 101',
        viewbox: '121.55,25.05,121.57,25.03',
        bounded: true,
      }),
    ).resolves.toEqual([{ place_id: 2, display_name: 'Taipei 101' }])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][0]).toContain('viewbox=')
    expect(fetchImpl.mock.calls[0][0]).toContain('bounded=1')
    expect(fetchImpl.mock.calls[1][0]).not.toContain('bounded=1')
  })

  it('falls back to the secondary provider when the primary provider fails', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-geocode-fallback-'))
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ place_id: 3, display_name: 'Taipei City Hall' }],
      })

    const service = createGeocodeProxyService({
      primary: {
        endpoint: 'https://geocode.example.com/search',
        countryCodes: [],
      },
      fallback: {
        endpoint: 'https://geocode-backup.example.com/search',
        countryCodes: [],
      },
      limit: 5,
      cacheTtlMs: 60000,
      requestTimeoutMs: 5000,
      cacheFile: join(tempRoot, 'cache.json'),
      userAgent: 'ParkKing test',
      path: '/api/geocode',
      port: 8787,
    }, {
      fetchImpl,
    })

    await expect(
      service.search({
        query: 'city hall',
      }),
    ).resolves.toEqual([{ place_id: 3, display_name: 'Taipei City Hall' }])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[1][0]).toContain('geocode-backup.example.com')
  })
})
