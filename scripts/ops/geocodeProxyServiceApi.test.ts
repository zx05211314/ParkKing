import { describe, expect, it, vi } from 'vitest'
import { createGeocodeProxyServiceApi } from './geocodeProxyServiceApi'
import type { GeocodeProxyRuntime } from './geocodeProxyRuntime'

describe('createGeocodeProxyServiceApi', () => {
  it('returns early for blank queries and caches successful results', async () => {
    const cache = { entries: {} }
    const persistCache = vi.fn()
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ place_id: 1, display_name: 'Taipei Main Station' }],
    })
    const runtime: GeocodeProxyRuntime = {
      fetchImpl,
      now: () => 1000,
      ensureCache: vi.fn().mockResolvedValue(cache),
      persistCache,
      pruneExpiredEntries: vi.fn(),
    }
    const service = createGeocodeProxyServiceApi({
      primary: {
        endpoint: 'https://geocode.example.com/search',
        countryCodes: [],
      },
      fallback: null,
      limit: 5,
      cacheTtlMs: 60000,
      cacheFile: 'cache.json',
      userAgent: 'ParkKing test',
      path: '/api/geocode',
      port: 8787,
    }, runtime)

    await expect(service.search({ query: '   ' })).resolves.toEqual([])
    await expect(service.search({ query: 'taipei main station' })).resolves.toEqual([
      { place_id: 1, display_name: 'Taipei Main Station' },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(persistCache).toHaveBeenCalledTimes(1)
  })
})
