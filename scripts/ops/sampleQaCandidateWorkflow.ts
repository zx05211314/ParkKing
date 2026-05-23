import { rankQaCandidateSegments } from './sampleQaCandidateRankingState'
import { buildQaCandidateSegments } from './sampleQaCandidateSegmentState'
import type { SampleQaCandidateWorkflowParams } from './sampleQaCandidateWorkflowTypes'

export const buildRankedQaCandidateSegments = (
  params: SampleQaCandidateWorkflowParams,
) => {
  const segments = buildQaCandidateSegments(params)
  return rankQaCandidateSegments({
    segments,
    busStops: params.busStops,
    hydrants: params.hydrants,
    intersections: params.intersections,
    crosswalks: params.crosswalks,
    meta: params.meta,
    riskMode: params.riskMode,
    radiusMeters: params.radiusMeters,
    hhmm: params.hhmm,
  })
}
