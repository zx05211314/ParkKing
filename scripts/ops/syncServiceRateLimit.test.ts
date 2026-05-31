import { describe, expect, it } from 'vitest'
import { createSyncServiceWriteRateLimiter } from './syncServiceRateLimit'

describe('syncServiceRateLimit', () => {
  it('limits writes per client, route, and scope within the configured window', () => {
    let now = 1_000
    const limiter = createSyncServiceWriteRateLimiter({
      windowMs: 1_000,
      maxRequests: 2,
      nowMs: () => now,
    })

    expect(
      limiter.check({
        clientId: 'client-a',
        route: '/api/sync/issues',
        scope: 'alpha',
      }),
    ).toMatchObject({ allowed: true, remaining: 1 })
    expect(
      limiter.check({
        clientId: 'client-a',
        route: '/api/sync/issues',
        scope: 'alpha',
      }),
    ).toMatchObject({ allowed: true, remaining: 0 })
    expect(
      limiter.check({
        clientId: 'client-a',
        route: '/api/sync/issues',
        scope: 'alpha',
      }),
    ).toMatchObject({ allowed: false, retryAfterSeconds: 1 })

    expect(
      limiter.check({
        clientId: 'client-a',
        route: '/api/sync/issues',
        scope: 'beta',
      }),
    ).toMatchObject({ allowed: true, remaining: 1 })

    now = 2_001
    expect(
      limiter.check({
        clientId: 'client-a',
        route: '/api/sync/issues',
        scope: 'alpha',
      }),
    ).toMatchObject({ allowed: true, remaining: 1 })
  })
})
