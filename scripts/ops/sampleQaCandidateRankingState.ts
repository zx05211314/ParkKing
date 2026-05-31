import { applyRankingPolicy } from '../../src/domain/ranking/policy'
import { evaluateSegmentWithZones } from '../../src/domain/rules/evaluateSegment'
import { makeZonesFromPOIs, ZONE_PARAMS_VERSION } from '../../src/domain/zones/makeZones'
import { getZoneIndex } from '../../src/domain/zones/zoneIndex'
import { distanceMeters, getPathMidpoint } from '../../src/map/geo'
import { DEFAULT_QA_HHMM } from './sampleQaCandidateTypes'
import { toQaAnchorLocation } from './sampleQaCandidateDataset'
import type {
  RankedQaCandidateSegment,
  SampleQaCandidateRankingParams,
} from './sampleQaCandidateWorkflowTypes'

export const rankQaCandidateSegments = (
  params: SampleQaCandidateRankingParams,
): RankedQaCandidateSegment[] => {
  const zones = makeZonesFromPOIs(
    params.busStops,
    params.hydrants,
    params.intersections,
    params.crosswalks,
  )
  const zoneIndex = getZoneIndex(
    zones,
    params.meta?.datasetHash ?? 'qa-sampler',
    ZONE_PARAMS_VERSION,
  )
  const hhmm = params.hhmm ?? DEFAULT_QA_HHMM
  const evaluated = params.segments.flatMap((segment) =>
    evaluateSegmentWithZones(segment, hhmm, zoneIndex),
  )

  const anchor = toQaAnchorLocation(params.meta)
  const withDistance = evaluated.map((segment) => ({
    ...segment,
    distanceMeters: distanceMeters(anchor, getPathMidpoint(segment.path)),
  }))

  return applyRankingPolicy(withDistance, {
    includeInferred: true,
    radiusMeters: params.radiusMeters,
    riskMode: params.riskMode,
  })
}
