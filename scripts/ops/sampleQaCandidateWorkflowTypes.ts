import type { FeatureCollection } from 'geojson'
import type { DatasetMeta } from '../../src/data/segmentBuilder'
import type { ParkingSpaceCollection } from '../../src/data/parkingSpaces'
import type { RiskMode } from '../../src/domain/ranking/policy'
import type { EvaluatedSegment, Segment } from '../../src/ui/types'
import type { QaLineCollection, QaPointCollection } from './sampleQaCandidateDataset'

export interface SampleQaCandidateWorkflowParams {
  redYellow: QaLineCollection
  busStops: QaPointCollection
  hydrants: QaPointCollection
  intersections: QaPointCollection
  crosswalks: FeatureCollection
  signOverrides: FeatureCollection
  inferredCandidates: QaLineCollection
  parkingSpaces: ParkingSpaceCollection
  meta: DatasetMeta | null
  riskMode: RiskMode
  radiusMeters: number
  hhmm?: string
  anchorLocation?: [number, number] | null
}

export type SampleQaCandidateSegmentParams = Pick<
  SampleQaCandidateWorkflowParams,
  'redYellow' | 'signOverrides' | 'inferredCandidates' | 'parkingSpaces' | 'meta'
>

export interface SampleQaCandidateRankingParams
  extends Pick<
    SampleQaCandidateWorkflowParams,
    | 'busStops'
    | 'hydrants'
    | 'intersections'
    | 'crosswalks'
    | 'meta'
    | 'riskMode'
    | 'radiusMeters'
    | 'hhmm'
    | 'anchorLocation'
  > {
  segments: Segment[]
}

export type RankedQaCandidateSegment = EvaluatedSegment & {
  distanceMeters: number
  rankScore: number
}
