import { describe, expect, it, vi } from 'vitest'
import {
  handleRoutingMatrixRequest,
  handleRoutingPathRequest,
} from './routingProxyRequestHandlers'
import type { RoutingProxyService } from './routingProxyTypes'

const createMockResponse = () => {
  const headers = new Map<string, string>()
  let body = ''

  return {
    body: () => body,
    headers,
    response: {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        headers.set(name, value)
      },
      end: (value?: string) => {
        body = value ?? ''
      },
    },
  }
}

describe('routingProxyRequestHandlers', () => {
  it('writes matrix payloads and path errors', async () => {
    const okService: RoutingProxyService = {
      route: vi.fn().mockResolvedValue([{ destination: [1, 2], distanceMeters: 3, durationSeconds: 4, estimated: false }]),
      routePath: vi.fn(),
    }
    const okRes = createMockResponse()
    await handleRoutingMatrixRequest({
      service: okService,
      res: okRes.response as never,
      profile: 'walking',
      origin: [1, 2],
      destinations: [[3, 4]],
    })
    expect(okRes.response.statusCode).toBe(200)
    expect(okRes.body()).toContain('"routes"')

    const failService: RoutingProxyService = {
      route: vi.fn(),
      routePath: vi.fn().mockRejectedValue(new Error('upstream failed')),
    }
    const failRes = createMockResponse()
    await handleRoutingPathRequest({
      service: failService,
      res: failRes.response as never,
      profile: 'walking',
      origin: [1, 2],
      destination: [3, 4],
    })
    expect(failRes.response.statusCode).toBe(502)
    expect(failRes.body()).toContain('upstream failed')
  })
})
