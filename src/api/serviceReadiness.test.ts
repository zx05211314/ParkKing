import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildServiceReadinessUrl,
  checkServiceReadiness,
  isParkKingServiceEndpoint,
  type ServiceReadinessError,
} from './serviceReadiness'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('serviceReadiness', () => {
  it('detects ParkKing service endpoints by pathname', () => {
    expect(isParkKingServiceEndpoint('/api/geocode', '/api/geocode')).toBe(true)
    expect(
      isParkKingServiceEndpoint(
        'https://api.example.test/api/route',
        '/api/route',
      ),
    ).toBe(false)
    expect(
      isParkKingServiceEndpoint(
        'https://nominatim.openstreetmap.org/search',
        '/api/geocode',
      ),
    ).toBe(false)
  })

  it('allows absolute same-origin service endpoints', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://parkking.example.test',
      },
    })

    expect(
      isParkKingServiceEndpoint(
        'https://parkking.example.test/api/route',
        '/api/route',
      ),
    ).toBe(true)
  })

  it('builds readiness URLs without preserving query params', () => {
    expect(buildServiceReadinessUrl('/api/geocode?q=taipei')).toBe(
      'http://localhost/api/geocode/ready',
    )
  })

  it('returns null for external direct-provider endpoints', async () => {
    const fetchImpl = vi.fn()
    await expect(
      checkServiceReadiness({
        endpoint: 'https://nominatim.openstreetmap.org/search',
        expectedPath: '/api/geocode',
        expectedService: 'geocode-proxy',
        unavailableMessage: 'unavailable',
        degradedMessage: 'degraded',
        fetchImpl,
      }),
    ).resolves.toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns normalized readiness for ok services', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          service: 'routing-proxy',
          status: 'ok',
          issues: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    await expect(
      checkServiceReadiness({
        endpoint: '/api/route',
        expectedPath: '/api/route',
        expectedService: 'routing-proxy',
        unavailableMessage: 'routing unavailable',
        degradedMessage: 'routing degraded',
        fetchImpl,
      }),
    ).resolves.toMatchObject({
      service: 'routing-proxy',
      status: 'ok',
      issues: [],
    })
  })

  it('throws typed degraded errors with issues', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          service: 'geocode-proxy',
          status: 'degraded',
          issues: ['primary endpoint is invalid'],
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    await expect(
      checkServiceReadiness({
        endpoint: '/api/geocode',
        expectedPath: '/api/geocode',
        expectedService: 'geocode-proxy',
        unavailableMessage: 'geocode unavailable',
        degradedMessage: 'geocode degraded',
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      name: 'ServiceReadinessError',
      message: 'geocode degraded: primary endpoint is invalid',
      service: 'geocode-proxy',
      statusCode: 503,
      issues: ['primary endpoint is invalid'],
    } satisfies Partial<ServiceReadinessError>)
  })
})
