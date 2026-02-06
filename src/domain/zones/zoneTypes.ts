import type { Feature, MultiPolygon, Polygon } from 'geojson'

export const ZoneType = {
  INTERSECTION_BUFFER: 'INTERSECTION_BUFFER',
  BUS_STOP_BUFFER: 'BUS_STOP_BUFFER',
  HYDRANT_BUFFER: 'HYDRANT_BUFFER',
  CROSSWALK_BUFFER: 'CROSSWALK_BUFFER',
} as const

export type ZoneType = (typeof ZoneType)[keyof typeof ZoneType]

export interface Zone {
  id: string
  type: ZoneType
  name: string
  center: [number, number]
  radiusMeters: number
  polygon: Feature<Polygon | MultiPolygon>
}
