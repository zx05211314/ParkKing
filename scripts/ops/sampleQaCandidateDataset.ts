import type {
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
} from 'geojson'
import { loadGeoJson } from '../../src/data/loaders/loadGeoJson.node'
import { toQaAnchorLocation } from './sampleQaCandidateAnchor'
import { discoverDistrictIds } from './sampleQaCandidateDistrictDiscovery'
import { resolveDistrictDatasetDir } from './sampleQaCandidateDatasetFiles'

export const loadOptionalGeoJson = async <T>(
  fileName: string,
  baseDir: string,
  fallback: T,
) => {
  try {
    return await loadGeoJson<T>(fileName, { baseDir })
  } catch {
    return fallback
  }
}

export type QaLineCollection = FeatureCollection<LineString | MultiLineString>
export type QaPointCollection = FeatureCollection<Point>

export { discoverDistrictIds, resolveDistrictDatasetDir, toQaAnchorLocation }
