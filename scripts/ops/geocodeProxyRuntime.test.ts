import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createGeocodeProxyRuntime } from './geocodeProxyRuntime'

describe('createGeocodeProxyRuntime', () => {
  it('loads and persists cache entries through the configured cache file', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-geocode-runtime-'))
    const cacheFile = join(tempRoot, 'cache.json')
    const runtime = createGeocodeProxyRuntime({
      primary: {
        endpoint: 'https://geocode.example.com/search',
        countryCodes: [],
      },
      fallback: null,
      limit: 5,
      cacheTtlMs: 60000,
      cacheFile,
      userAgent: 'ParkKing test',
      path: '/api/geocode',
      port: 8787,
    }, {
      now: () => 1000,
    })

    const cache = await runtime.ensureCache()
    cache.entries.demo = { cachedAtMs: 1000, payload: [{ place_id: 1 }] }
    await runtime.persistCache(cache)

    await expect(runtime.ensureCache()).resolves.toMatchObject({
      entries: {
        demo: {
          payload: [{ place_id: 1 }],
        },
      },
    })
  })
})
