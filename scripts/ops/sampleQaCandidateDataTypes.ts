import type { FeatureCollection } from 'geojson'
import type { DatasetMeta } from '../../src/data/segmentBuilder'
import type { ParkingSpaceCollection } from '../../src/data/parkingSpaces'
import type {
  QaLineCollection,
  QaPointCollection,
} from './sampleQaCandidateDataset'

export interface QaCandidateDatasetBundle {
  baseDir: string
  redYellow: QaLineCollection
  busStops: QaPointCollection
  hydrants: QaPointCollection
  intersections: QaPointCollection
  crosswalks: FeatureCollection
  signOverrides: FeatureCollection
  inferredCandidates: QaLineCollection
  parkingSpaces: ParkingSpaceCollection
  meta: DatasetMeta | null
}
