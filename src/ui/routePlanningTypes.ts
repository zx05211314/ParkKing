import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type {
  ParkingSpaceCollection,
  ParkingSpaceMatch,
} from '../data/parkingSpaces'
import type {
  NavigationLinks,
  SegmentArrivalTarget,
} from '../map/navigation'
import type { RoutePathEntry, RouteProfile } from '../map/routing'
import type { SegmentParkingSpaceOption } from './segmentSheetTypes'

export interface SegmentLike {
  id: string
  path: [number, number][]
}

export interface RecommendationTargetLike {
  destination: [number, number] | null
  description: string | null
  targetKind: 'SEGMENT' | 'PARKING_SPACE'
  walkDistanceMeters: number | null
}

export interface SegmentRouteEta {
  walkingDistanceMeters: number | null
  walkingDurationSeconds: number | null
  walkingEstimated: boolean
  drivingDistanceMeters: number | null
  drivingDurationSeconds: number | null
  drivingEstimated: boolean
}

export type RouteOverlayStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface UseRoutePlanningStateOptions {
  parkingSpaces: ParkingSpaceCollection
  navigationOrigin: [number, number] | null
  selectedSegment: SegmentLike | null
  selectedParkingSpaceMatch: ParkingSpaceMatch | null
  selectedParkingSpaceOptions: SegmentParkingSpaceOption[]
  recommendationSortableSegments: SegmentLike[]
  addressRecommendationCandidates: SegmentLike[]
  maxListRouteTargets: number
  bestAddressRecommendation: SegmentLike | null
  bestAddressRecommendationTarget: RecommendationTargetLike | null
  routeEtaBySegmentId: Record<string, SegmentRouteEta>
  selectedTargetRouteEta: SegmentRouteEta | null
  selectedRouteProfile: RouteProfile
  routeRequestIdRef: MutableRefObject<number>
  selectedRouteRequestIdRef: MutableRefObject<number>
  selectedRouteEtaRequestIdRef: MutableRefObject<number>
  setRouteEtaBySegmentId: Dispatch<SetStateAction<Record<string, SegmentRouteEta>>>
  setRouteEtaStatus: Dispatch<SetStateAction<RouteOverlayStatus>>
  setRouteEtaError: Dispatch<SetStateAction<string | null>>
  setSelectedTargetRouteEta: Dispatch<SetStateAction<SegmentRouteEta | null>>
  setSelectedRoutePath: Dispatch<SetStateAction<RoutePathEntry | null>>
  setSelectedRouteStatus: Dispatch<SetStateAction<RouteOverlayStatus>>
  setSelectedRouteError: Dispatch<SetStateAction<string | null>>
}

export interface UseRoutePlanningStateResult {
  selectedRouteEta: SegmentRouteEta | null
  selectedArrivalTarget: SegmentArrivalTarget | null
  selectedCenter: [number, number] | null
  selectedArrivalHint: string | null
  selectedArrivalLabel: string | null
  selectedArrivalKind: 'SEGMENT' | 'PARKING_SPACE'
  selectedNavigationLinks: NavigationLinks | null
  selectedWalkDistance: number | null
  bestAddressRecommendationCenter: [number, number] | null
  bestAddressRecommendationArrivalHint: string | null
  bestAddressRecommendationArrivalKind: 'SEGMENT' | 'PARKING_SPACE'
  bestAddressRecommendationWalkDistance: number | null
  bestAddressRecommendationNavigationLinks: NavigationLinks | null
  bestAddressRecommendationRouteEta: SegmentRouteEta | null
}
