import { describe, expect, it, vi } from 'vitest'
import { requestGeocodeResults } from './geocodeProxyTransport'

describe('requestGeocodeResults', () => {
  it('returns an empty cached-eligible result after successful no-match attempts', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    await expect(
      requestGeocodeResults(
        [
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
        ],
        {
          query: 'taipei 101',
          viewbox: '121.55,25.05,121.57,25.03',
          bounded: true,
        },
        {
          primary: { endpoint: 'https://primary.example.com/search', countryCodes: [] },
          fallback: null,
          limit: 5,
          cacheTtlMs: 60000,
          cacheFile: 'cache.json',
          userAgent: 'ParkKing test',
          path: '/api/geocode',
          port: 8787,
        },
        fetchImpl,
      ),
    ).resolves.toEqual({
      results: [],
      sawSuccessfulResponse: true,
    })
  })
})
