import type { RiskMode } from '../../src/domain/ranking/policy'
import type { FeatureCollection } from 'geojson'
import type {
  QaCandidateInputCounts,
  QaCandidatePacket,
  QaCandidateRow,
} from './sampleQaCandidateTypes'
import type { QaCandidateStrategy } from './sampleQaCandidateTypes'
import { loadQaCandidateDataset } from './sampleQaCandidateDataLoad'
import { hydrateQaRowsWithStoredOverrides } from './sampleQaCandidateReviewHydration'
import { selectQaCandidateRows } from './sampleQaCandidateSelection'
import { buildRankedQaCandidateSegments } from './sampleQaCandidateWorkflow'

const countFeatures = (collection: FeatureCollection) => collection.features.length

const countQaCandidateInputs = (
  dataset: Awaited<ReturnType<typeof loadQaCandidateDataset>>,
): QaCandidateInputCounts => ({
  redYellow: countFeatures(dataset.redYellow),
  busStops: countFeatures(dataset.busStops),
  hydrants: countFeatures(dataset.hydrants),
  intersections: countFeatures(dataset.intersections),
  crosswalks: countFeatures(dataset.crosswalks),
  signOverrides: countFeatures(dataset.signOverrides),
  inferredCandidates: countFeatures(dataset.inferredCandidates),
  parkingSpaces: countFeatures(dataset.parkingSpaces),
})

export const buildQaCandidates = async (params: {
  districtId: string
  topN: number
  riskMode: RiskMode
  radiusMeters: number
  shuffle?: boolean
  seed?: number
  strategy?: QaCandidateStrategy
  hhmm?: string
  datasetRoots?: string[]
  requiredSegmentIds?: string[]
  anchorLocation?: [number, number] | null
}): Promise<QaCandidateRow[]> => {
  const packet = await buildQaCandidatePacket(params)
  return packet.rows
}

export const buildQaCandidatePacket = async (params: {
  districtId: string
  topN: number
  riskMode: RiskMode
  radiusMeters: number
  shuffle?: boolean
  seed?: number
  strategy?: QaCandidateStrategy
  hhmm?: string
  datasetRoots?: string[]
  requiredSegmentIds?: string[]
  anchorLocation?: [number, number] | null
}): Promise<QaCandidatePacket> => {
  const dataset = await loadQaCandidateDataset({
    districtId: params.districtId,
    datasetRoots: params.datasetRoots,
  })

  const ranked = buildRankedQaCandidateSegments({
    redYellow: dataset.redYellow,
    busStops: dataset.busStops,
    hydrants: dataset.hydrants,
    intersections: dataset.intersections,
    crosswalks: dataset.crosswalks,
    signOverrides: dataset.signOverrides,
    inferredCandidates: dataset.inferredCandidates,
    parkingSpaces: dataset.parkingSpaces,
    meta: dataset.meta,
    radiusMeters: params.radiusMeters,
    riskMode: params.riskMode,
    hhmm: params.hhmm,
    anchorLocation: params.anchorLocation,
  })
  const rows = selectQaCandidateRows({
    districtId: params.districtId,
    segments: ranked,
    topN: params.topN,
    shuffle: params.shuffle,
    seed: params.seed,
    strategy: params.strategy,
    requiredSegmentIds: params.requiredSegmentIds,
  })
  const hydratedRows = await hydrateQaRowsWithStoredOverrides(rows, params.districtId)
  return {
    rows: hydratedRows,
    context: {
      datasetBaseDir: dataset.baseDir,
      datasetMeta: dataset.meta,
      inputCounts: countQaCandidateInputs(dataset),
    },
  }
}
