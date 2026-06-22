import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createRoutingProxyRuntime } from './routingProxyRuntime'

describe('routingProxyRuntime', () => {
  it('reuses the same in-memory cache promise and resolves both providers', async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), 'parkking-route-runtime-'))
    const runtime = createRoutingProxyRuntime({
      primary: { endpoint: 'https://route.example.com' },
      fallback: { endpoint: 'https://route-backup.example.com' },
      cacheTtlMs: 60000,
      requestTimeoutMs: 8000,
      cacheFile: join(tempRoot, 'cache.json'),
      userAgent: 'ParkKing test',
      path: '/api/route',
      port: 8788,
    })

    const first = await runtime.ensureCache()
    const second = await runtime.ensureCache()

    expect(first).toBe(second)
    expect(runtime.providers).toEqual([
      { endpoint: 'https://route.example.com' },
      { endpoint: 'https://route-backup.example.com' },
    ])
  })
})
