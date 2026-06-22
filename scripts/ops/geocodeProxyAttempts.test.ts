import { describe, expect, it } from 'vitest'
import { buildGeocodeAttempts } from './geocodeProxyAttempts'

describe('geocodeProxyAttempts', () => {
  it('expands bounded viewbox queries into bounded and open retries across providers', () => {
    expect(
      buildGeocodeAttempts(
        {
          primary: { endpoint: 'https://primary.example.com/search', countryCodes: [] },
          fallback: { endpoint: 'https://fallback.example.com/search', countryCodes: [] },
          limit: 5,
          cacheTtlMs: 60000,
          requestTimeoutMs: 5000,
          cacheFile: 'cache.json',
          userAgent: 'ParkKing test',
          path: '/api/geocode',
          port: 8787,
        },
        {
          query: 'taipei 101',
          viewbox: '121.55,25.05,121.57,25.03',
          bounded: true,
        },
      ),
    ).toEqual([
      {
        provider: { endpoint: 'https://primary.example.com/search', countryCodes: [] },
        viewbox: '121.55,25.05,121.57,25.03',
        bounded: true,
      },
      {
        provider: { endpoint: 'https://primary.example.com/search', countryCodes: [] },
        viewbox: null,
        bounded: false,
      },
      {
        provider: { endpoint: 'https://fallback.example.com/search', countryCodes: [] },
        viewbox: '121.55,25.05,121.57,25.03',
        bounded: true,
      },
      {
        provider: { endpoint: 'https://fallback.example.com/search', countryCodes: [] },
        viewbox: null,
        bounded: false,
      },
    ])
  })
})
