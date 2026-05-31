import { distance, point } from '@turf/turf'
import type { FeatureCollection } from 'geojson'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { ResolvedConfig } from './readConfig'
import { extractRepresentativePoint } from './ingestCandidateGeometry'

export const loadZonePoints = async (config: Pick<ResolvedConfig, 'outputs'>) => {
  const files = [
    path.resolve(config.outputs.generatedDir, 'bus_stops.geojson'),
    path.resolve(config.outputs.generatedDir, 'hydrants.geojson'),
    path.resolve(config.outputs.generatedDir, 'intersections.geojson'),
    path.resolve(config.outputs.generatedDir, 'crosswalks.geojson'),
  ]

  const points: [number, number][] = []

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const collection = JSON.parse(raw) as FeatureCollection
      collection.features.forEach((feature) => {
        if (!feature.geometry) {
          return
        }
        const pointCoord = extractRepresentativePoint(feature.geometry)
        if (pointCoord) {
          points.push(pointCoord)
        }
      })
    } catch {
      // ignore missing optional files
    }
  }

  return points
}

export const countNearbyZonePoints = (
  center: [number, number] | null,
  zonePoints: [number, number][],
  radiusMeters: number,
) => {
  if (!center) {
    return 0
  }
  return zonePoints.reduce((count, coord) => {
    const d = distance(point(center), point(coord), { units: 'meters' })
    return d <= radiusMeters ? count + 1 : count
  }, 0)
}
