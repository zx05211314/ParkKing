import {
  compareReportStatusPriority,
} from '../feedback/reports'
import { compareAllowedActionPriority } from './segmentActionFilter'
import type {
  AddressRecommendationCandidate,
  AddressRecommendationRankMode,
  AddressRecommendationRouteEta,
} from './addressRecommendationTypes'

const getParkingSpaceCount = <T extends AddressRecommendationCandidate>(candidate: T) => {
  return candidate.parkingSpaceCount ?? 0
}

const compareHardReportPenalty = <T extends AddressRecommendationCandidate>(left: T, right: T) => {
  const leftPenalty = left.reportStatus === 'ILLEGAL' ? 1 : 0
  const rightPenalty = right.reportStatus === 'ILLEGAL' ? 1 : 0
  return leftPenalty - rightPenalty
}

const compareSoftReportSignal = <T extends AddressRecommendationCandidate>(left: T, right: T) => {
  return compareReportStatusPriority(left.reportStatus, right.reportStatus)
}

export const compareParkingAwareFallback = <T extends AddressRecommendationCandidate>(
  left: T,
  right: T,
) => {
  const hardReportPenalty = compareHardReportPenalty(left, right)
  if (hardReportPenalty !== 0) {
    return hardReportPenalty
  }

  const softReportSignal = compareSoftReportSignal(left, right)
  if (softReportSignal !== 0) {
    return softReportSignal
  }

  const allowedActionSignal = compareAllowedActionPriority(left.allowedNow, right.allowedNow)
  if (allowedActionSignal !== 0) {
    return allowedActionSignal
  }

  const leftParkingSpaceCount = getParkingSpaceCount(left)
  const rightParkingSpaceCount = getParkingSpaceCount(right)
  if (leftParkingSpaceCount !== rightParkingSpaceCount) {
    return rightParkingSpaceCount - leftParkingSpaceCount
  }

  const leftRankScore = left.rankScore ?? Number.NEGATIVE_INFINITY
  const rightRankScore = right.rankScore ?? Number.NEGATIVE_INFINITY
  if (leftRankScore !== rightRankScore) {
    return rightRankScore - leftRankScore
  }

  const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY
  const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY
  if (leftDistance !== rightDistance) {
    return leftDistance - rightDistance
  }

  return left.id.localeCompare(right.id, undefined, { numeric: true })
}

const compareDistanceAwareFallback = <T extends AddressRecommendationCandidate>(
  left: T,
  right: T,
) => {
  const hardReportPenalty = compareHardReportPenalty(left, right)
  if (hardReportPenalty !== 0) {
    return hardReportPenalty
  }

  const softReportSignal = compareSoftReportSignal(left, right)
  if (softReportSignal !== 0) {
    return softReportSignal
  }

  const allowedActionSignal = compareAllowedActionPriority(left.allowedNow, right.allowedNow)
  if (allowedActionSignal !== 0) {
    return allowedActionSignal
  }

  const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY
  const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY
  if (leftDistance !== rightDistance) {
    return leftDistance - rightDistance
  }

  const leftParkingSpaceCount = getParkingSpaceCount(left)
  const rightParkingSpaceCount = getParkingSpaceCount(right)
  if (leftParkingSpaceCount !== rightParkingSpaceCount) {
    return rightParkingSpaceCount - leftParkingSpaceCount
  }

  const leftRankScore = left.rankScore ?? Number.NEGATIVE_INFINITY
  const rightRankScore = right.rankScore ?? Number.NEGATIVE_INFINITY
  if (leftRankScore !== rightRankScore) {
    return rightRankScore - leftRankScore
  }

  return left.id.localeCompare(right.id, undefined, { numeric: true })
}

export const compareAddressRecommendationCandidates = <
  T extends AddressRecommendationCandidate,
>(
  left: T,
  right: T,
  routeEtaBySegmentId: Record<string, AddressRecommendationRouteEta>,
  rankMode: AddressRecommendationRankMode,
) => {
  const hardReportPenalty = compareHardReportPenalty(left, right)
  if (hardReportPenalty !== 0) {
    return hardReportPenalty
  }

  const leftEta = routeEtaBySegmentId[left.id]
  const rightEta = routeEtaBySegmentId[right.id]
  const leftRouteDuration =
    rankMode === 'WALK'
      ? leftEta?.walkingDurationSeconds ?? null
      : rankMode === 'DRIVE'
        ? leftEta?.drivingDurationSeconds ?? null
        : null
  const rightRouteDuration =
    rankMode === 'WALK'
      ? rightEta?.walkingDurationSeconds ?? null
      : rankMode === 'DRIVE'
        ? rightEta?.drivingDurationSeconds ?? null
        : null
  const leftRouteEstimated =
    rankMode === 'WALK'
      ? leftEta?.walkingEstimated ?? false
      : rankMode === 'DRIVE'
        ? leftEta?.drivingEstimated ?? false
        : false
  const rightRouteEstimated =
    rankMode === 'WALK'
      ? rightEta?.walkingEstimated ?? false
      : rankMode === 'DRIVE'
        ? rightEta?.drivingEstimated ?? false
        : false
  const leftRouteDistance =
    rankMode === 'WALK'
      ? leftEta?.walkingDistanceMeters ?? null
      : rankMode === 'DRIVE'
        ? leftEta?.drivingDistanceMeters ?? null
        : null
  const rightRouteDistance =
    rankMode === 'WALK'
      ? rightEta?.walkingDistanceMeters ?? null
      : rankMode === 'DRIVE'
        ? rightEta?.drivingDistanceMeters ?? null
        : null

  if (leftRouteDuration !== null && rightRouteDuration !== null) {
    if (leftRouteDuration !== rightRouteDuration) {
      return leftRouteDuration - rightRouteDuration
    }
    if (leftRouteEstimated !== rightRouteEstimated) {
      return leftRouteEstimated ? 1 : -1
    }
    const normalizedLeftRouteDistance = leftRouteDistance ?? Number.POSITIVE_INFINITY
    const normalizedRightRouteDistance = rightRouteDistance ?? Number.POSITIVE_INFINITY
    if (normalizedLeftRouteDistance !== normalizedRightRouteDistance) {
      return normalizedLeftRouteDistance - normalizedRightRouteDistance
    }
  } else if (leftRouteDuration !== null || rightRouteDuration !== null) {
    return leftRouteDuration !== null ? -1 : 1
  }

  const softReportSignal = compareSoftReportSignal(left, right)
  if (softReportSignal !== 0) {
    return softReportSignal
  }

  const allowedActionSignal = compareAllowedActionPriority(left.allowedNow, right.allowedNow)
  if (allowedActionSignal !== 0) {
    return allowedActionSignal
  }

  if (rankMode === 'DISTANCE') {
    return compareDistanceAwareFallback(left, right)
  }

  return compareParkingAwareFallback(left, right)
}
