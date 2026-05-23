import { DEFAULT_SIGN_OVERRIDE_MATCH_TOLERANCE_METERS } from '../data/constants'
import {
  applySignOverrides,
  buildInferredSegmentsFromFeature,
  buildSegmentsFromFeature,
  type DatasetMeta,
} from '../data/segmentBuilder'
import { countParkingSpacesNearSegments } from '../data/parkingSpaces'
import { makeZonesFromPOIs } from '../domain/zones/makeZones'
import type { Zone } from '../domain/zones/zoneTypes'
import type { ParkingSpaceCollection } from '../data/parkingSpaces'
import type { Segment } from './types'
import type { DatasetArtifacts } from './datasetLoadArtifacts'

export interface DatasetLoadResult {
  segments: Segment[]
  parkingSpaces: ParkingSpaceCollection
  zones: Zone[]
  parkingSpaceCount: number
  intersectionCount: number
  crosswalkCount: number
  overrideCount: number
  inferredCount: number
  datasetMeta: DatasetMeta
}

type DatasetArtifactsWithMeta = DatasetArtifacts & {
  meta: DatasetMeta
}

export const buildDatasetLoadResult = ({
  redYellow,
  busStops,
  hydrants,
  parkingSpaces,
  intersections,
  crosswalks,
  signOverrides,
  inferredCandidates,
  meta,
}: DatasetArtifactsWithMeta): DatasetLoadResult => {
  const builtSegments = redYellow.features.flatMap((feature, index) =>
    buildSegmentsFromFeature(feature, index, meta),
  )
  const inferredSegments = inferredCandidates.features.flatMap((feature, index) =>
    buildInferredSegmentsFromFeature(feature, index, meta),
  )

  const matchTolerance =
    meta.signOverrideMatchToleranceMeters ??
    DEFAULT_SIGN_OVERRIDE_MATCH_TOLERANCE_METERS
  const segmentsWithOverrides = applySignOverrides(
    [...builtSegments, ...inferredSegments],
    signOverrides,
    {
      matchToleranceMeters: matchTolerance,
    },
  )
  const segments = countParkingSpacesNearSegments(
    segmentsWithOverrides,
    parkingSpaces,
  )

  return {
    segments,
    parkingSpaces,
    zones: makeZonesFromPOIs(busStops, hydrants, intersections, crosswalks),
    parkingSpaceCount: parkingSpaces.features.length,
    intersectionCount: intersections.features.length,
    crosswalkCount: crosswalks.features.length,
    overrideCount: signOverrides.features.length,
    inferredCount: inferredSegments.length,
    datasetMeta: meta,
  }
}
