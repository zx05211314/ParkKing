import { loadGeoJson } from '../../src/data/loaders/loadGeoJson.node'
import type {
  QaLineCollection,
  QaPointCollection,
} from './sampleQaCandidateDataset'

export const loadQaCandidateRequiredLayers = async (baseDir: string) => {
  const [redYellow, busStops, hydrants, intersections] = await Promise.all([
    loadGeoJson<QaLineCollection>('red_yellow.geojson', { baseDir }),
    loadGeoJson<QaPointCollection>('bus_stops.geojson', { baseDir }),
    loadGeoJson<QaPointCollection>('hydrants.geojson', { baseDir }),
    loadGeoJson<QaPointCollection>('intersections.geojson', { baseDir }),
  ])

  return {
    redYellow,
    busStops,
    hydrants,
    intersections,
  }
}
