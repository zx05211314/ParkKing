import { describe, expect, it } from 'vitest'
import {
  buildGeocodeCacheKey,
  buildGeocodeUpstreamUrl,
} from './geocodeProxyRequestKeys'

describe('geocodeProxyRequestKeys', () => {
  it('builds a stable cache key from normalized request state', () => {
    expect(
      buildGeocodeCacheKey(
        {
          query: ' Taipei 101 ',
          viewbox: '121.55,25.05,121.57,25.03',
          bounded: true,
        },
        {
          primary: {
            endpoint: 'https://primary.example.com/search',
            countryCodes: ['tw'],
          },
          fallback: {
            endpoint: 'https://fallback.example.com/search',
            countryCodes: [],
          },
          limit: 5,
          cacheTtlMs: 60000,
          cacheFile: 'cache.json',
          userAgent: 'ParkKing test',
          path: '/api/geocode',
          port: 8787,
        },
        3,
      ),
    ).toBe(
      JSON.stringify({
        q: 'taipei 101',
        viewbox: '121.55,25.05,121.57,25.03',
        bounded: true,
        limit: 3,
        primary: 'https://primary.example.com/search',
        fallback: 'https://fallback.example.com/search',
        countries: 'tw',
      }),
    )
  })

  it('builds an upstream url with country and bounded viewbox params', () => {
    const url = new URL(
      buildGeocodeUpstreamUrl(
        {
          endpoint: 'https://primary.example.com/search',
          countryCodes: ['tw', 'jp'],
        },
        {
          query: 'taipei 101',
          viewbox: '121.55,25.05,121.57,25.03',
          bounded: true,
        },
        4,
        {
          viewbox: '121.55,25.05,121.57,25.03',
          bounded: true,
        },
      ),
    )

    expect(url.searchParams.get('q')).toBe('taipei 101')
    expect(url.searchParams.get('limit')).toBe('4')
    expect(url.searchParams.get('countrycodes')).toBe('tw,jp')
    expect(url.searchParams.get('viewbox')).toBe('121.55,25.05,121.57,25.03')
    expect(url.searchParams.get('bounded')).toBe('1')
  })
})
