import { describe, expect, it } from 'vitest'
import {
  parseCoordinate,
  parseCoordinates,
  parseRoutingProxyRequest,
} from './routingProxyRequestParsing'

describe('routingProxyRequestParsing', () => {
  it('parses individual and repeated coordinates', () => {
    expect(parseCoordinate('121.5645,25.0338')).toEqual([121.5645, 25.0338])
    expect(parseCoordinates('121.5,25.0;121.6,25.1')).toEqual([
      [121.5, 25.0],
      [121.6, 25.1],
    ])
  })

  it('normalizes routing query params into a request object', () => {
    expect(
      parseRoutingProxyRequest(
        new URL(
          'http://localhost/api/route?profile=walking&mode=path&origin=121.5645,25.0338&destination=121.565,25.034',
        ),
      ),
    ).toEqual({
      profile: 'walking',
      mode: 'path',
      origin: [121.5645, 25.0338],
      destination: [121.565, 25.034],
      destinations: [],
    })
  })
})
