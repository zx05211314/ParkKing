import type { AddressRecommendationRankMode } from './addressRecommendations'

interface DisplaySegmentLike {
  id: string
  allowedNow: 'PARK' | 'TEMP_STOP' | 'NO_STOP'
  parkingSpaceCount?: number
}

interface SegmentRouteEta {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}

export interface NearbySnapshot {
  total: number
  parkCount: number
  stopCount: number
  noStopCount: number
  markedSpaceCount: number
  etaReadyCount: number
}

interface BuildNearbySnapshotOptions {
  searchLocation: [number, number] | null
  displaySegments: DisplaySegmentLike[]
  recommendationRankMode: AddressRecommendationRankMode
  routeEtaBySegmentId: Record<string, SegmentRouteEta>
}

export const buildNearbySnapshot = ({
  searchLocation,
  displaySegments,
  recommendationRankMode,
  routeEtaBySegmentId,
}: BuildNearbySnapshotOptions): NearbySnapshot | null => {
  if (!searchLocation || displaySegments.length === 0) {
    return null
  }

  let parkCount = 0
  let stopCount = 0
  let noStopCount = 0
  let markedSpaceCount = 0
  let etaReadyCount = 0

  displaySegments.forEach((segment) => {
    if (segment.allowedNow === 'PARK') {
      parkCount += 1
    } else if (segment.allowedNow === 'TEMP_STOP') {
      stopCount += 1
    } else {
      noStopCount += 1
    }

    if ((segment.parkingSpaceCount ?? 0) > 0) {
      markedSpaceCount += 1
    }

    const eta = routeEtaBySegmentId[segment.id]
    const routeDuration =
      recommendationRankMode === 'WALK'
        ? eta?.walkingDurationSeconds ?? null
        : recommendationRankMode === 'DRIVE'
          ? eta?.drivingDurationSeconds ?? null
          : eta?.walkingDurationSeconds ?? eta?.drivingDurationSeconds ?? null
    if (routeDuration !== null && routeDuration !== undefined) {
      etaReadyCount += 1
    }
  })

  return {
    total: displaySegments.length,
    parkCount,
    stopCount,
    noStopCount,
    markedSpaceCount,
    etaReadyCount,
  }
}
