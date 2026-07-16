import type { RiskMode } from '../../src/domain/ranking/policy'
import type { DatasetMeta } from '../../src/data/segmentBuilder'

export const DEFAULT_TOP_N = 50
export const DEFAULT_RADIUS_METERS = 600
export const DEFAULT_QA_HHMM = '13:00'
export const DEFAULT_CONFIG_ROOT = 'configs/prod'
export const DEFAULT_DATASET_ROOTS = ['public/data/generated', 'data/generated']
export const REQUIRED_DATASET_FILES = [
  'dataset_meta.json',
  'red_yellow.geojson',
  'bus_stops.geojson',
  'hydrants.geojson',
  'intersections.geojson',
]

export interface CliArgs {
  districtId: string | null
  all: boolean
  topN: number
  outPath: string | null
  manifestOutPath: string | null
  reviewDocOutPath: string | null
  configRoot: string
  riskMode: RiskMode
  radiusMeters: number
  datasetRoots: string[]
  shuffle: boolean
  seed: number
  strategy: QaCandidateStrategy
  hhmm: string
  requiredSegmentIds: string[]
}

export type QaCandidateStrategy = 'ranked' | 'review'

export interface DistrictResult {
  districtId: string
  outPath: string
  manifestPath: string
  reviewDocPath: string
  rowCount: number
}

export interface QaCandidateInputCounts {
  redYellow: number
  busStops: number
  hydrants: number
  intersections: number
  crosswalks: number
  signOverrides: number
  inferredCandidates: number
  parkingSpaces: number
}

export interface QaCandidateBuildContext {
  datasetBaseDir: string
  datasetMeta: DatasetMeta | null
  inputCounts: QaCandidateInputCounts
}

export interface QaCandidatePacket {
  rows: QaCandidateRow[]
  context: QaCandidateBuildContext
}

export interface QaCandidateRow {
  districtId: string
  segmentId: string
  lat: string
  lon: string
  score: string
  reviewBucket: string
  tier: string
  allowedNow: string
  curbMarking: string
  sourceType: string
  sourceReliability: string
  dataFreshnessDays: string
  finalConfidence: string
  coverageConfidence: string
  overrideConfidence: string
  parkingSpaceCount: string
  topReasons: string[]
  flags: string[]
  riskTags: string[]
  signOverrideStatus: string
  signOverrideSource: string
  signOverrideVerifiedAt: string
  signOverrideNote: string
  mapsUrl: string
  streetViewUrl: string
  reviewSource: string
  reviewStatus: string
  reviewNote: string
  createdAt: string
}
