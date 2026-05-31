import {
  applySignOverrides,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
} from '../../src/data/segmentBuilder'
import { DEFAULT_SIGN_OVERRIDE_MATCH_TOLERANCE_METERS } from '../../src/data/constants'
import { countParkingSpacesNearSegments } from '../../src/data/parkingSpaces'
import type { Segment } from '../../src/ui/types'
import type { SampleQaCandidateSegmentParams } from './sampleQaCandidateWorkflowTypes'

export const buildQaCandidateSegments = (
  params: SampleQaCandidateSegmentParams,
): Segment[] => {
  const baseSegments = params.redYellow.features.flatMap((feature, index) =>
    buildSegmentsFromFeature(feature, index, params.meta),
  )
  const inferredSegments = params.inferredCandidates.features.flatMap(
    (feature, index) => buildInferredSegmentsFromFeature(feature, index, params.meta),
  )

  const matchTolerance =
    params.meta?.signOverrideMatchToleranceMeters ??
    DEFAULT_SIGN_OVERRIDE_MATCH_TOLERANCE_METERS

  const segmentsWithOverrides = applySignOverrides(
    [...baseSegments, ...inferredSegments],
    params.signOverrides,
    {
      matchToleranceMeters: matchTolerance,
    },
  )
  const segments = countParkingSpacesNearSegments(
    segmentsWithOverrides,
    params.parkingSpaces,
  )

  return segments
}
