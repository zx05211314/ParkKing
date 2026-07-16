import type { RiskMode } from '../../src/domain/ranking/policy'
import {
  DEFAULT_CONFIG_ROOT,
  DEFAULT_DATASET_ROOTS,
  DEFAULT_QA_HHMM,
  DEFAULT_RADIUS_METERS,
  DEFAULT_TOP_N,
  type QaCandidateStrategy,
} from './sampleQaCandidateTypes'

export interface SampleQaCandidateParams {
  districtId?: string | null
  all?: boolean
  topN?: number
  count?: number
  outPath?: string | null
  manifestOutPath?: string | null
  reviewDocOutPath?: string | null
  configRoot?: string
  riskMode?: RiskMode
  radiusMeters?: number
  shuffle?: boolean
  seed?: number
  strategy?: QaCandidateStrategy
  hhmm?: string
  datasetRoots?: string[]
  requiredSegmentIds?: string[]
}

export interface ResolvedSampleQaCandidateParams {
  all: boolean
  districtId: string | null
  topN: number
  outPath: string | null
  manifestOutPath: string | null
  reviewDocOutPath: string | null
  configRoot: string
  riskMode: RiskMode
  radiusMeters: number
  shuffle: boolean
  seed: number
  strategy: QaCandidateStrategy
  hhmm: string
  datasetRoots: string[]
  requiredSegmentIds: string[]
}

export const resolveSampleQaCandidateParams = (
  params: SampleQaCandidateParams,
): ResolvedSampleQaCandidateParams => ({
  all: params.all === true,
  districtId: params.districtId ?? null,
  topN: params.topN ?? params.count ?? DEFAULT_TOP_N,
  outPath: params.outPath ?? null,
  manifestOutPath: params.manifestOutPath ?? null,
  reviewDocOutPath: params.reviewDocOutPath ?? null,
  configRoot: params.configRoot ?? DEFAULT_CONFIG_ROOT,
  riskMode: params.riskMode ?? 'NEUTRAL',
  radiusMeters: params.radiusMeters ?? DEFAULT_RADIUS_METERS,
  shuffle: params.shuffle === true,
  seed: params.seed ?? 1,
  strategy: params.strategy ?? 'ranked',
  hhmm: params.hhmm ?? DEFAULT_QA_HHMM,
  datasetRoots: params.datasetRoots ?? DEFAULT_DATASET_ROOTS,
  requiredSegmentIds: params.requiredSegmentIds ?? [],
})

export const resolveSampleQaCandidateDistrictIds = async ({
  all,
  districtId,
  datasetRoots,
  discoverDistrictIds,
}: {
  all: boolean
  districtId: string | null
  datasetRoots: string[]
  discoverDistrictIds: (datasetRoots: string[]) => Promise<string[]>
}) => {
  const districtIds = all
    ? await discoverDistrictIds(datasetRoots)
    : districtId
      ? [districtId]
      : []

  if (districtIds.length === 0) {
    throw new Error('No districts found to sample')
  }

  return [...districtIds].sort((a, b) => a.localeCompare(b))
}
