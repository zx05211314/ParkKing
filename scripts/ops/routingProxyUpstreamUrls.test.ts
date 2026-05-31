import { describe, expect, it } from 'vitest'
import {
  buildMatrixUpstreamUrl,
  buildRouteUpstreamUrl,
} from './routingProxyUpstreamUrls'

describe('buildMatrixUpstreamUrl', () => {
  it('builds OSRM table urls with source and destination indexes', () => {
    const url = new URL(
      buildMatrixUpstreamUrl(
        { endpoint: 'https://router.example.com/' },
        {
          profile: 'walking',
          origin: [121.5645, 25.0338],
          destinations: [
            [121.565, 25.034],
            [121.566, 25.035],
          ],
        },
      ),
    )

    expect(url.pathname).toBe(
      '/table/v1/foot/121.5645,25.0338;121.565,25.034;121.566,25.035',
    )
    expect(url.searchParams.get('sources')).toBe('0')
    expect(url.searchParams.get('destinations')).toBe('1;2')
    expect(url.searchParams.get('annotations')).toBe('duration,distance')
  })
})

describe('buildRouteUpstreamUrl', () => {
  it('builds OSRM route urls with geojson geometry', () => {
    const url = new URL(
      buildRouteUpstreamUrl(
        { endpoint: 'https://router.example.com/' },
        {
          profile: 'driving',
          origin: [121.5645, 25.0338],
          destination: [121.565, 25.034],
        },
      ),
    )

    expect(url.pathname).toBe('/route/v1/car/121.5645,25.0338;121.565,25.034')
    expect(url.searchParams.get('overview')).toBe('full')
    expect(url.searchParams.get('geometries')).toBe('geojson')
    expect(url.searchParams.get('steps')).toBe('false')
  })
})
