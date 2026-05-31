import * as path from 'node:path'
import type {
  FeatureCollection,
  LineString,
  MultiLineString,
} from 'geojson'
import { readGeoJson } from './publishGateFiles'
import { collectSegmentIds } from './publishGateSegmentIds'

export const buildSegmentIdSet = async (datasetDir: string) => {
  const ids = new Set<string>()
  const redYellowPath = path.resolve(datasetDir, 'red_yellow.geojson')
  const inferredPath = path.resolve(datasetDir, 'candidates_inferred.geojson')

  const redYellow = await readGeoJson(redYellowPath)
  collectSegmentIds(
    redYellow as FeatureCollection<LineString | MultiLineString>,
    'seg',
  ).forEach((id) => ids.add(id))

  const inferred = await readGeoJson(inferredPath)
  const inferredIds = new Set<string>()
  inferred.features.forEach((feature, index) => {
    const props = feature.properties as Record<string, unknown> | null
    const raw = props?.id ?? props?.ID
    const idBase = raw !== undefined && raw !== null ? String(raw) : `inferred-${index + 1}`
    const geometry = feature.geometry
    if (!geometry) {
      return
    }
    if (geometry.type === 'MultiLineString') {
      geometry.coordinates.forEach((line, lineIndex) => {
        if (line.length === 0) {
          return
        }
        inferredIds.add(`${idBase}-p${lineIndex + 1}`)
      })
      return
    }
    inferredIds.add(String(idBase))
  })
  inferredIds.forEach((id) => ids.add(id))

  return ids
}
