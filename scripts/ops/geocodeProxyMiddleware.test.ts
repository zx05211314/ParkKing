import { describe, expect, it, vi } from 'vitest'
import { createGeocodeProxyMiddleware } from './geocodeProxyMiddleware'
import type {
  GeocodeProxyConfig,
  GeocodeProxyService,
} from './geocodeProxyTypes'

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
  overrides: Partial<GeocodeProxyConfig> = {},
): GeocodeProxyConfig => ({
  primary: {
    endpoint: 'https://nominatim.openstreetmap.org/search',
    countryCodes: ['tw'],
  },
  fallback: null,
  limit: 5,
  cacheTtlMs: 60_000,
  requestTimeoutMs: 5_000,
  cacheFile: '.tmp/geocode-cache.json',
  userAgent: 'parkking-test',
  path: '/api/geocode',
  port: 8787,
  ...overrides,
})

describe('createGeocodeProxyMiddleware', () => {
  it('returns 400 when q is missing', async () => {
    const service: GeocodeProxyService = {
      search: vi.fn(),
    }
    const middleware = createGeocodeProxyMiddleware(service)
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/geocode?viewbox=121.55,25.05,121.57,25.03',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(400)
    expect(res.body()).toBe('{"error":"Missing q query parameter."}')
    expect(service.search).not.toHaveBeenCalled()
  })

  it('passes normalized limit and bounded viewbox search params to the service', async () => {
    const service: GeocodeProxyService = {
      search: vi.fn().mockResolvedValue([{ place_id: 1 }]),
    }
    const middleware = createGeocodeProxyMiddleware(service)
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/geocode?q=taipei%20101&viewbox=121.55,25.05,121.57,25.03&bounded=1&limit=3',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(service.search).toHaveBeenCalledWith({
      query: 'taipei 101',
      viewbox: '121.55,25.05,121.57,25.03',
      bounded: true,
      limit: 3,
    })
    expect(res.response.statusCode).toBe(200)
  })

  it('serves health without requiring a geocode query', async () => {
    const service: GeocodeProxyService = {
      search: vi.fn(),
    }
    const middleware = createGeocodeProxyMiddleware(
      service,
      '/api/geocode',
      createConfig(),
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/geocode/health',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    expect(res.response.statusCode).toBe(200)
    expect(JSON.parse(res.body())).toMatchObject({
      service: 'geocode-proxy',
      status: 'ok',
      searchPath: '/api/geocode',
      readinessPath: '/api/geocode/ready',
    })
    expect(service.search).not.toHaveBeenCalled()
  })

  it('marks readiness degraded when provider config is invalid', async () => {
    const service: GeocodeProxyService = {
      search: vi.fn(),
    }
    const middleware = createGeocodeProxyMiddleware(
      service,
      '/api/geocode',
      createConfig({
        primary: {
          endpoint: 'not-a-url',
          countryCodes: ['tw'],
        },
      }),
    )
    const res = createMockResponse()

    await expect(
      middleware(
        {
          method: 'GET',
          url: '/api/geocode/ready',
        } as never,
        res.response as never,
      ),
    ).resolves.toBe(true)

    const payload = JSON.parse(res.body())
    expect(res.response.statusCode).toBe(503)
    expect(payload.status).toBe('degraded')
    expect(payload.issues).toContain('primary endpoint is not a valid http(s) URL')
    expect(service.search).not.toHaveBeenCalled()
  })
})
