import { describe, expect, it } from 'vitest'
import {
  buildMatrixCacheKey,
  buildPathCacheKey,
} from './routingProxyCacheKeys'

const config = {
  primary: { endpoint: 'https://primary.example.com' },
  fallback: { endpoint: 'https://fallback.example.com' },
  cacheTtlMs: 60_000,
  cacheFile: 'cache.json',
  userAgent: 'ParkKing test',
  path: '/api/route',
  port: 3000,
}

describe('routingProxyCacheKeys', () => {
  it('builds stable matrix and path cache keys', () => {
    expect(
      buildMatrixCacheKey(
        {
          profile: 'walking',
          origin: [121.56451234, 25.03381234],
          destinations: [[121.56501234, 25.03401234]],
        },
        config,
      ),
    ).toContain('"mode":"matrix"')

    expect(
      buildPathCacheKey(
        {
          profile: 'walking',
          origin: [121.56451234, 25.03381234],
          destination: [121.56501234, 25.03401234],
        },
        config,
      ),
    ).toContain('"mode":"path"')
  })
})
