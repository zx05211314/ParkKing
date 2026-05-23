import { describe, expect, it, vi } from 'vitest'
import { createRoutingProxyServiceApi } from './routingProxyServiceApi'
import type { RoutingCacheFile, RoutingProxyConfig } from './routingProxyTypes'
import type { RoutingProxyRuntime } from './routingProxyRuntime'

const config: RoutingProxyConfig = {
  primary: { endpoint: 'https://route.example.com' },
  fallback: null,
  cacheTtlMs: 60000,
  cacheFile: 'cache.json',
  userAgent: 'ParkKing test',
  path: '/api/route',
  port: 8788,
}

describe('routingProxyServiceApi', () => {
  it('returns an empty matrix result without touching cache or upstream when there are no destinations', async () => {
    const cache: RoutingCacheFile = { entries: {} }
    const runtime: RoutingProxyRuntime = {
      fetchImpl: vi.fn() as never,
      now: vi.fn().mockReturnValue(1000),
      providers: [config.primary],
      ensureCache: vi.fn().mockResolvedValue(cache),
      pruneExpiredEntries: vi.fn(),
      persistCache: vi.fn(),
    }
    const service = createRoutingProxyServiceApi(config, runtime)

    await expect(
      service.route({
        profile: 'walking',
        origin: [121.5645, 25.0338],
        destinations: [],
      }),
    ).resolves.toEqual([])

    expect(runtime.ensureCache).not.toHaveBeenCalled()
    expect(runtime.persistCache).not.toHaveBeenCalled()
  })
})
