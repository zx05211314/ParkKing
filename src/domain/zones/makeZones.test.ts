import { describe, expect, it } from 'vitest'
import type { FeatureCollection, Point } from 'geojson'
import {
  BUS_STOP_BUFFER_METERS,
  CROSSWALK_BUFFER_METERS,
  HYDRANT_BUFFER_METERS,
  INTERSECTION_NO_STOP_M,
  makeZonesFromPOIs,
} from './makeZones'

const fc = (coords: [number, number][]): FeatureCollection<Point> => ({
  type: 'FeatureCollection',
  features: coords.map((coord, index) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coord },
    properties: { name: `POI ${index + 1}` },
  })),
})

describe('makeZonesFromPOIs', () => {
  it('uses expected buffer sizes for bus stops and hydrants', () => {
    const busStops = fc([[121.56, 25.03]])
    const hydrants = fc([[121.561, 25.031]])
    const intersections = fc([[121.562, 25.032]])
    const crosswalks: FeatureCollection<Point> = fc([[121.563, 25.033]])

    const zones = makeZonesFromPOIs(busStops, hydrants, intersections, crosswalks)

    const busZone = zones.find((zone) => zone.type === 'BUS_STOP_BUFFER')
    const hydrantZone = zones.find((zone) => zone.type === 'HYDRANT_BUFFER')
    const intersectionZone = zones.find(
      (zone) => zone.type === 'INTERSECTION_BUFFER',
    )
    const crosswalkZone = zones.find((zone) => zone.type === 'CROSSWALK_BUFFER')

    expect(busZone?.radiusMeters).toBe(BUS_STOP_BUFFER_METERS)
    expect(hydrantZone?.radiusMeters).toBe(HYDRANT_BUFFER_METERS)
    expect(intersectionZone?.radiusMeters).toBe(INTERSECTION_NO_STOP_M)
    expect(crosswalkZone?.radiusMeters).toBe(CROSSWALK_BUFFER_METERS)
  })
})
