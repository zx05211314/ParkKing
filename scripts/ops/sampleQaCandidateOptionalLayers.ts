import type { FeatureCollection } from 'geojson'
import type { DatasetMeta } from '../../src/data/segmentBuilder'
import { loadGeoJson } from '../../src/data/loaders/loadGeoJson.node'
import type { ParkingSpaceCollection } from '../../src/data/parkingSpaces'
import {
  loadOptionalGeoJson,
} from './sampleQaCandidateDataset'
import type { QaLineCollection } from './sampleQaCandidateDataset'

export const loadQaCandidateOptionalLayers = async (baseDir: string) => {
  const [crosswalks, signOverrides, inferredCandidates, parkingSpaces, meta] =
    await Promise.all([
      loadOptionalGeoJson<FeatureCollection>('crosswalks.geojson', baseDir, {
        type: 'FeatureCollection',
        features: [],
      }),
      loadOptionalGeoJson<FeatureCollection>('sign_overrides.geojson', baseDir, {
        type: 'FeatureCollection',
        features: [],
      }),
      loadOptionalGeoJson<QaLineCollection>('candidates_inferred.geojson', baseDir, {
        type: 'FeatureCollection',
        features: [],
      }),
      loadOptionalGeoJson<ParkingSpaceCollection>('parking_spaces.geojson', baseDir, {
        type: 'FeatureCollection',
        features: [],
      }),
      loadGeoJson<DatasetMeta>('dataset_meta.json', { baseDir }).catch(() => null),
    ])

  return {
    crosswalks,
    signOverrides,
    inferredCandidates,
    parkingSpaces,
    meta,
  }
}
