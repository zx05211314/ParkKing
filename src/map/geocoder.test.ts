import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildGeocoderUrl,
  GEOCODER_SERVICE_DEGRADED_MESSAGE,
  normalizeGeocoderResults,
  resolveGeocoderConfig,
  searchAddresses,
} from './geocoder'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveGeocoderConfig', () => {
  it('uses the default Nominatim endpoint', () => {
    expect(resolveGeocoderConfig({})).toEqual({
      primary: {
        endpoint: 'https://nominatim.openstreetmap.org/search',
        countryCodes: [],
      },
      fallback: null,
      limit: 5,
    })
  })

  it('uses configured values when present', () => {
    expect(
      resolveGeocoderConfig({
        VITE_GEOCODER_URL: 'https://geocode.example.com/search',
        VITE_GEOCODER_FALLBACK_URL: 'https://geocode-backup.example.com/search',
        VITE_GEOCODER_LIMIT: '7',
        VITE_GEOCODER_COUNTRY_CODES: 'tw,jp',
      }),
    ).toEqual({
      primary: {
        endpoint: 'https://geocode.example.com/search',
        countryCodes: ['tw', 'jp'],
      },
      fallback: {
        endpoint: 'https://geocode-backup.example.com/search',
        countryCodes: ['tw', 'jp'],
      },
      limit: 7,
    })
  })

  it('defaults to the local proxy on localhost when no endpoint is configured', () => {
    vi.stubGlobal('window', {
      location: {
        hostname: 'localhost',
      },
    })

    expect(resolveGeocoderConfig({})).toEqual({
      primary: {
        endpoint: '/api/geocode',
        countryCodes: [],
      },
      fallback: null,
      limit: 5,
    })
  })
})

describe('buildGeocoderUrl', () => {
  it('includes the Nominatim query parameters', () => {
    const url = new URL(
      buildGeocoderUrl(
        'taipei 101',
        {
          endpoint: 'https://geocode.example.com/search',
          countryCodes: ['tw'],
        },
        3,
      ),
    )

    expect(url.origin + url.pathname).toBe('https://geocode.example.com/search')
    expect(url.searchParams.get('q')).toBe('taipei 101')
    expect(url.searchParams.get('format')).toBe('jsonv2')
    expect(url.searchParams.get('addressdetails')).toBe('1')
    expect(url.searchParams.get('limit')).toBe('3')
    expect(url.searchParams.get('countrycodes')).toBe('tw')
  })

  it('adds a viewbox bias when bounds are provided', () => {
    const url = new URL(
      buildGeocoderUrl(
        'taipei city hall',
        {
          endpoint: 'https://geocode.example.com/search',
          countryCodes: [],
        },
        5,
        {
          biasBounds: [
            [121.55, 25.03],
            [121.57, 25.05],
          ],
          bounded: true,
        },
      ),
    )

    expect(url.searchParams.get('viewbox')).toBe('121.55,25.05,121.57,25.03')
    expect(url.searchParams.get('bounded')).toBe('1')
  })

  it('supports relative proxy endpoints', () => {
    const url = new URL(
      buildGeocoderUrl(
        'taipei city hall',
        {
          endpoint: '/api/geocode',
          countryCodes: [],
        },
        5,
      ),
    )

    expect(url.pathname).toBe('/api/geocode')
    expect(url.searchParams.get('q')).toBe('taipei city hall')
  })
})

describe('normalizeGeocoderResults', () => {
  it('normalizes Nominatim payloads into app results', () => {
    expect(
      normalizeGeocoderResults([
        {
          place_id: 123,
          display_name: 'Taipei 101, Xinyi District, Taipei',
          lon: '121.5645',
          lat: '25.0339',
          boundingbox: ['25.0330', '25.0348', '121.5638', '121.5653'],
        },
      ]),
    ).toEqual([
      {
        id: '123',
        label: 'Taipei 101, Xinyi District, Taipei',
        center: [121.5645, 25.0339],
        bounds: [
          [121.5638, 25.033],
          [121.5653, 25.0348],
        ],
      },
    ])
  })
})

describe('searchAddresses', () => {
  it('calls fetch and returns normalized results', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 5,
          display_name: 'Taipei Main Station',
          lon: '121.5170',
          lat: '25.0478',
        },
      ],
    })

    await expect(
      searchAddresses('taipei main station', {
        config: {
          primary: {
            endpoint: 'https://geocode.example.com/search',
            countryCodes: [],
          },
          fallback: null,
          limit: 4,
        },
        fetchImpl,
      }),
    ).resolves.toEqual([
      {
        id: '5',
        label: 'Taipei Main Station',
        center: [121.517, 25.0478],
        bounds: null,
      },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries without district bounds when the bounded search returns no matches', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            place_id: 9,
            display_name: 'Taipei City Hall',
            lon: '121.5637',
            lat: '25.0375',
          },
        ],
      })

    await expect(
      searchAddresses('city hall', {
        config: {
          primary: {
            endpoint: 'https://geocode.example.com/search',
            countryCodes: ['tw'],
          },
          fallback: null,
          limit: 5,
        },
        biasBounds: [
          [121.55, 25.03],
          [121.57, 25.05],
        ],
        fetchImpl,
      }),
    ).resolves.toEqual([
      {
        id: '9',
        label: 'Taipei City Hall',
        center: [121.5637, 25.0375],
        bounds: null,
      },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][0]).toContain('bounded=1')
    expect(fetchImpl.mock.calls[0][0]).toContain('viewbox=')
    expect(fetchImpl.mock.calls[1][0]).not.toContain('bounded=1')
  })

  it('falls back to the secondary provider when the primary provider fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            place_id: 11,
            display_name: 'Taipei 101',
            lon: '121.5645',
            lat: '25.0339',
          },
        ],
      })

    await expect(
      searchAddresses('taipei 101', {
        config: {
          primary: {
            endpoint: 'https://geocode.example.com/search',
            countryCodes: [],
          },
          fallback: {
            endpoint: 'https://geocode-backup.example.com/search',
            countryCodes: [],
          },
          limit: 5,
        },
        fetchImpl,
      }),
    ).resolves.toEqual([
      {
        id: '11',
        label: 'Taipei 101',
        center: [121.5645, 25.0339],
        bounds: null,
      },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[1][0]).toContain('geocode-backup.example.com')
  })

  it('returns an empty result set when at least one provider answered successfully', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('primary offline'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

    await expect(
      searchAddresses('missing place', {
        config: {
          primary: {
            endpoint: 'https://geocode.example.com/search',
            countryCodes: [],
          },
          fallback: {
            endpoint: 'https://geocode-backup.example.com/search',
            countryCodes: [],
          },
          limit: 5,
        },
        fetchImpl,
      }),
    ).resolves.toEqual([])
  })

  it('checks local proxy readiness before address search', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          service: 'geocode-proxy',
          status: 'ok',
          issues: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            place_id: 13,
            display_name: 'Taipei City Hall',
            lon: '121.5637',
            lat: '25.0375',
          },
        ],
      })

    await expect(
      searchAddresses('city hall', {
        config: {
          primary: {
            endpoint: '/api/geocode',
            countryCodes: [],
          },
          fallback: null,
          limit: 5,
        },
        fetchImpl,
      }),
    ).resolves.toEqual([
      {
        id: '13',
        label: 'Taipei City Hall',
        center: [121.5637, 25.0375],
        bounds: null,
      },
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][0]).toBe('http://localhost/api/geocode/ready')
    expect(fetchImpl.mock.calls[1][0]).toContain('/api/geocode?')
  })

  it('surfaces degraded local proxy readiness as a search error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        service: 'geocode-proxy',
        status: 'degraded',
        issues: ['primary endpoint is not a valid http(s) URL'],
      }),
    })

    await expect(
      searchAddresses('city hall', {
        config: {
          primary: {
            endpoint: '/api/geocode',
            countryCodes: [],
          },
          fallback: null,
          limit: 5,
        },
        fetchImpl,
      }),
    ).rejects.toThrow(
      `${GEOCODER_SERVICE_DEGRADED_MESSAGE}: primary endpoint is not a valid http(s) URL`,
    )

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
