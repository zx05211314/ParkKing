import {
  distanceMeters,
  getPathMidpoint,
  pointToPathDistanceMeters,
} from '../../map/geoMath'
import type { AllowedAction, EvaluatedSegment, Segment } from '../../ui/types'
import { evaluateSegmentWithZones } from '../rules/evaluateSegment'
import type { ZoneIndex } from '../zones/zoneIndex'
import { isInferredSegment } from '../ranking/policy'
import { computeRankScore, type RiskMode } from '../ranking/rank'

export type ParkingAnswerKind = AllowedAction | 'NO_DATA'
export type ParkingAnswerScope = 'NEAREST_MAPPED_CURB'
export type ParkingAnswerEvidenceKind =
  | 'MARKED_SPACE'
  | 'CURB_RULE'
  | 'INFERRED'
  | 'NO_DATA'

export interface ParkingAnswerOptions {
  searchRadiusMeters?: number
  includeInferred?: boolean
  riskMode?: RiskMode
  maxAlternatives?: number
  reviewedSignOverridesCount?: number | null
  appliedSignOverridesCount?: number | null
}

export interface ParkingAnswerCandidate extends EvaluatedSegment {
  distanceMeters: number
  rankScore: number
}

export interface ParkingAnswerEvidence {
  kind: ParkingAnswerEvidenceKind
  label: string
  parkingSpaceCount: number
  caveats: string[]
}

export interface ParkingAnswer {
  kind: ParkingAnswerKind
  label: string
  scope: ParkingAnswerScope
  location: [number, number]
  searchRadiusMeters: number
  includeInferred: boolean
  primary: ParkingAnswerCandidate | null
  alternatives: ParkingAnswerCandidate[]
  evidence: ParkingAnswerEvidence
  caveats: string[]
}

const DEFAULT_SEARCH_RADIUS_METERS = 60
const DEFAULT_MAX_ALTERNATIVES = 5
const DEFAULT_PREFILTER_LIMIT = 80

export const getDistanceToSegmentMeters = (
  location: [number, number],
  segment: Pick<EvaluatedSegment, 'path'>,
) => {
  if (segment.path.length >= 2) {
    return pointToPathDistanceMeters(location, segment.path)
  }

  if (segment.path.length === 1) {
    return distanceMeters(location, segment.path[0])
  }

  return Number.POSITIVE_INFINITY
}

const getAnswerLabel = (
  kind: ParkingAnswerKind,
  searchRadiusMeters: number,
) => {
  switch (kind) {
    case 'PARK':
      return 'Parking is allowed at the nearest mapped curb for this time.'
    case 'TEMP_STOP':
      return 'Parking is not allowed now; temporary stopping may be possible.'
    case 'NO_STOP':
      return 'Do not stop or park at the nearest mapped curb.'
    case 'NO_DATA':
      return `No mapped curb segment found within ${Math.round(searchRadiusMeters)}m.`
  }
}

const getPrimaryEvidence = (
  primary: ParkingAnswerCandidate | null,
): ParkingAnswerEvidence => {
  if (!primary) {
    return {
      kind: 'NO_DATA',
      label: 'No mapped curb or parking-space evidence matched this pinned point.',
      parkingSpaceCount: 0,
      caveats: [],
    }
  }

  const parkingSpaceCount = primary.parkingSpaceCount ?? 0
  if (isInferredSegment(primary)) {
    return {
      kind: 'INFERRED',
      label: 'Inferred curb candidate only; verify signs on-site.',
      parkingSpaceCount,
      caveats: [
        'This answer is based on an inferred curb candidate, not an official mapped curb segment.',
      ],
    }
  }

  if (parkingSpaceCount > 0) {
    const caveats =
      primary.allowedNow === 'PARK'
        ? []
        : [
            'Mapped official parking spaces are near this curb, but the active curb rule still blocks parking now.',
          ]
    return {
      kind: 'MARKED_SPACE',
      label: `${parkingSpaceCount} mapped official marked parking space${
        parkingSpaceCount === 1 ? '' : 's'
      } near this curb.`,
      parkingSpaceCount,
      caveats,
    }
  }

  return {
    kind: 'CURB_RULE',
    label: 'Curb rule answer; no official marked-space evidence is mapped on this curb.',
    parkingSpaceCount: 0,
    caveats: [
      'No official marked parking-space evidence is mapped on the selected curb.',
    ],
  }
}

const hasReasonCode = (
  primary: ParkingAnswerCandidate,
  reasonCode: string,
) => primary.reasonCodes.includes(reasonCode as never)

const getPrimaryRiskCaveats = (
  primary: ParkingAnswerCandidate | null,
) => {
  if (!primary) {
    return []
  }

  const caveats: string[] = []
  if (hasReasonCode(primary, 'DATA_FRESHNESS_STALE')) {
    caveats.push(
      'Source curb data may be stale; verify current curb paint and signs on-site.',
    )
  } else if (hasReasonCode(primary, 'DATA_FRESHNESS_UNKNOWN')) {
    caveats.push(
      'Source data freshness is unknown; verify current curb paint and signs on-site.',
    )
  }
  if (primary.finalConfidence === 'LOW') {
    caveats.push(
      'This answer has low confidence; verify the curb and posted signs before relying on it.',
    )
  }
  if (hasReasonCode(primary, 'COVERAGE_LOW')) {
    caveats.push('Coverage confidence is low near this pinned location.')
  } else if (hasReasonCode(primary, 'COVERAGE_MED')) {
    caveats.push('Coverage confidence is medium near this pinned location.')
  }
  if (hasReasonCode(primary, 'OVERRIDE_LOW_CONFIDENCE')) {
    caveats.push('A sign override exists, but its confidence is not high.')
  }
  return caveats
}

const getAnswerCaveats = (
  primary: ParkingAnswerCandidate | null,
  evidence: ParkingAnswerEvidence,
  options: ParkingAnswerOptions,
) =>
  Array.from(
    new Set([
      ...getDatasetRiskCaveats(options),
      ...getPrimaryRiskCaveats(primary),
      ...evidence.caveats,
    ]),
  )

const getDatasetRiskCaveats = ({
  reviewedSignOverridesCount,
  appliedSignOverridesCount,
}: ParkingAnswerOptions) => {
  if (reviewedSignOverridesCount === 0) {
    return [
      'This dataset has no reviewed sign overrides; verify posted signs on-site.',
    ]
  }
  if (appliedSignOverridesCount === 0) {
    return [
      'Reviewed sign overrides exist, but none matched current curb segments; verify posted signs on-site.',
    ]
  }
  return []
}

const byExactLocationPriority = (
  left: ParkingAnswerCandidate,
  right: ParkingAnswerCandidate,
) => {
  if (left.distanceMeters !== right.distanceMeters) {
    return left.distanceMeters - right.distanceMeters
  }
  if (right.rankScore !== left.rankScore) {
    return right.rankScore - left.rankScore
  }
  return left.id.localeCompare(right.id, undefined, { numeric: true })
}

const byRecommendationPriority = (
  left: ParkingAnswerCandidate,
  right: ParkingAnswerCandidate,
) => {
  if (right.rankScore !== left.rankScore) {
    return right.rankScore - left.rankScore
  }
  if (left.distanceMeters !== right.distanceMeters) {
    return left.distanceMeters - right.distanceMeters
  }
  return left.id.localeCompare(right.id, undefined, { numeric: true })
}

export const buildParkingAnswer = (
  evaluatedSegments: EvaluatedSegment[],
  location: [number, number],
  options: ParkingAnswerOptions = {},
): ParkingAnswer => {
  const searchRadiusMeters =
    options.searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS
  const includeInferred = options.includeInferred ?? false
  const riskMode = options.riskMode ?? 'NEUTRAL'
  const maxAlternatives = options.maxAlternatives ?? DEFAULT_MAX_ALTERNATIVES

  const candidates = evaluatedSegments
    .filter((segment) => includeInferred || !isInferredSegment(segment))
    .map<ParkingAnswerCandidate>((segment) => {
      const distance = getDistanceToSegmentMeters(location, segment)
      return {
        ...segment,
        distanceMeters: distance,
        rankScore: computeRankScore(segment, distance, riskMode),
      }
    })
    .filter((segment) => segment.distanceMeters <= searchRadiusMeters)
    .sort(byExactLocationPriority)

  const primary = candidates[0] ?? null
  const evidence = getPrimaryEvidence(primary)
  const caveats = getAnswerCaveats(primary, evidence, options)
  const alternatives = candidates
    .filter((candidate) => candidate.id !== primary?.id)
    .sort(byRecommendationPriority)
    .slice(0, Math.max(0, maxAlternatives))

  const kind = primary?.allowedNow ?? 'NO_DATA'

  return {
    kind,
    label: getAnswerLabel(kind, searchRadiusMeters),
    scope: 'NEAREST_MAPPED_CURB',
    location,
    searchRadiusMeters,
    includeInferred,
    primary,
    alternatives,
    evidence,
    caveats,
  }
}

export const buildParkingAnswerFromSegments = (
  segments: Segment[],
  location: [number, number],
  options: ParkingAnswerOptions & {
    nowHHMM: string
    zoneIndex: ZoneIndex | null
    prefilterLimit?: number
  },
): ParkingAnswer => {
  const includeInferred = options.includeInferred ?? false
  const searchRadiusMeters =
    options.searchRadiusMeters ?? DEFAULT_SEARCH_RADIUS_METERS
  const prefilterLimit = Math.max(
    1,
    options.prefilterLimit ?? DEFAULT_PREFILTER_LIMIT,
  )

  const nearestSegments = segments
    .filter((segment) => includeInferred || !isInferredSegment(segment))
    .map((segment) => ({
      segment,
      distanceMeters: getDistanceToSegmentMeters(location, segment),
    }))
    .filter((entry) => entry.distanceMeters <= searchRadiusMeters)
    .sort((left, right) =>
      left.distanceMeters === right.distanceMeters
        ? left.segment.id.localeCompare(right.segment.id, undefined, { numeric: true })
        : left.distanceMeters - right.distanceMeters,
    )
    .slice(0, prefilterLimit)

  const evaluatedCandidates = nearestSegments.flatMap(({ segment }) =>
    evaluateSegmentWithZones(segment, options.nowHHMM, options.zoneIndex),
  )

  return buildParkingAnswer(evaluatedCandidates, location, options)
}

export const getParkingAnswerFocusPoint = (
  candidate: Pick<ParkingAnswerCandidate, 'path'> | null,
) => (candidate ? getPathMidpoint(candidate.path) : null)
