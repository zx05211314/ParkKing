import { describe, expect, it, vi } from 'vitest'
import { createRoutingProxyMiddleware } from './routingProxyMiddleware'
import type {
  RoutingProxyConfig,
  RoutingProxyService,
} from './routingProxyTypes'

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

const createConfig = (
  overrides: Partial<RoutingProxyConfig> = {},
): RoutingProxyConfig => ({
  primary: {
    endpoint: 'https://router.project-osrm.org',
  },
  fallback: null,
  cacheTtlMs: 60_000,
  cacheFile: '.tmp/routing-cache.json',
  userAgent: 'parkking-test',
  path: '/api/route',
  port: 8788,
  ...overrides,
})

describe('createRoutingProxyMiddleware', () => {
  it('returns a 400 response for matrix requests without destinations', async () => {
    const service: RoutingProxyService = {
      route: vi.fn(),
      routePath: vi.fn(),
    }
    const middleware = createRoutingProxyMiddleware(service)
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/route?profile=walking&origin=121.5645,25.0338',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(400)
    expect(res.body()).toBe('{"error":"Missing destinations."}')
    expect(service.route).not.toHaveBeenCalled()
  })

  it('routes path requests through routePath and writes the route payload', async () => {
    const service: RoutingProxyService = {
      route: vi.fn(),
      routePath: vi.fn().mockResolvedValue({
        destination: [121.565, 25.034],
        distanceMeters: 460,
        durationSeconds: 280,
        estimated: false,
        geometry: [
          [121.5645, 25.0338],
          [121.565, 25.034],
        ],
      }),
    }
    const middleware = createRoutingProxyMiddleware(service)
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/route?profile=walking&mode=path&origin=121.5645,25.0338&destination=121.565,25.034',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(service.routePath).toHaveBeenCalledWith({
      profile: 'walking',
      origin: [121.5645, 25.0338],
      destination: [121.565, 25.034],
    })
    expect(res.response.statusCode).toBe(200)
    expect(res.body()).toContain('"distanceMeters":460')
  })

  it('serves health without requiring routing params', async () => {
    const service: RoutingProxyService = {
      route: vi.fn(),
      routePath: vi.fn(),
    }
    const middleware = createRoutingProxyMiddleware(
      service,
      '/api/route',
      createConfig(),
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/route/health',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(200)
    expect(JSON.parse(res.body())).toMatchObject({
      service: 'routing-proxy',
      status: 'ok',
      routePath: '/api/route',
      readinessPath: '/api/route/ready',
    })
    expect(service.route).not.toHaveBeenCalled()
    expect(service.routePath).not.toHaveBeenCalled()
  })

  it('marks readiness degraded when provider config is invalid', async () => {
    const service: RoutingProxyService = {
      route: vi.fn(),
      routePath: vi.fn(),
    }
    const middleware = createRoutingProxyMiddleware(
      service,
      '/api/route',
      createConfig({
        primary: {
          endpoint: 'not-a-url',
        },
      }),
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/route/ready',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    const payload = JSON.parse(res.body())
    expect(res.response.statusCode).toBe(503)
    expect(payload.status).toBe('degraded')
    expect(payload.issues).toContain('primary endpoint is not a valid http(s) URL')
    expect(service.route).not.toHaveBeenCalled()
    expect(service.routePath).not.toHaveBeenCalled()
  })
})
