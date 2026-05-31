import { useCallback, useMemo } from 'react'
import { getPreferredParkingSpaceAnchor } from '../data/parkingSpaces'
import {
  getSegmentArrivalTarget,
} from '../map/navigation'
import {
  buildBestAddressRecommendationRouteDisplayState,
  buildRouteTargetSegments,
  buildSelectedRoutePlanningDisplayState,
} from './routePlanningDerivedState'
import type {
  UseRoutePlanningStateOptions,
  UseRoutePlanningStateResult,
} from './routePlanningTypes'
import { useRouteEtaMatrixEffect } from './useRouteEtaMatrixEffect'
import { useSelectedRoutePathEffect } from './useSelectedRoutePathEffect'
import { useSelectedTargetRouteEtaEffect } from './useSelectedTargetRouteEtaEffect'

export const useRoutePlanningState = ({
  parkingSpaces,
  navigationOrigin,
  selectedSegment,
  selectedParkingSpaceMatch,
  selectedParkingSpaceOptions,
  recommendationSortableSegments,
  addressRecommendationCandidates,
  maxListRouteTargets,
  bestAddressRecommendation,
  bestAddressRecommendationTarget,
  routeEtaBySegmentId,
  selectedTargetRouteEta,
  selectedRouteProfile,
  routeRequestIdRef,
  selectedRouteRequestIdRef,
  selectedRouteEtaRequestIdRef,
  setRouteEtaBySegmentId,
  setRouteEtaStatus,
  setRouteEtaError,
  setSelectedTargetRouteEta,
  setSelectedRoutePath,
  setSelectedRouteStatus,
  setSelectedRouteError,
}: UseRoutePlanningStateOptions): UseRoutePlanningStateResult => {
  const resolveSegmentArrivalTarget = useCallback(
    (
      path: [number, number][],
      origin: [number, number] | null,
      preferredParkingSpaceOverride: [number, number] | null = null,
    ) => {
      const preferredParkingSpace =
        preferredParkingSpaceOverride ??
        getPreferredParkingSpaceAnchor(path, parkingSpaces, origin)
      return getSegmentArrivalTarget(path, origin, preferredParkingSpace)
    },
    [parkingSpaces],
  )

  const resolveSegmentDestination = useCallback(
    (
      path: [number, number][],
      origin: [number, number] | null,
      preferredParkingSpaceOverride: [number, number] | null = null,
    ) => {
      return (
        resolveSegmentArrivalTarget(path, origin, preferredParkingSpaceOverride)?.destination ??
        null
      )
    },
    [resolveSegmentArrivalTarget],
  )

  const routeTargetSegments = useMemo(() => {
    return buildRouteTargetSegments({
      addressRecommendationCandidates,
      maxListRouteTargets,
      recommendationSortableSegments,
      selectedSegment,
    })
  }, [addressRecommendationCandidates, maxListRouteTargets, recommendationSortableSegments, selectedSegment])

  const routeTargetKey = useMemo(
    () => routeTargetSegments.map((segment) => segment.id).join(','),
    [routeTargetSegments],
  )

  const selectedRouteDisplayState = useMemo(
    () =>
      buildSelectedRoutePlanningDisplayState({
        navigationOrigin,
        resolveSegmentArrivalTarget,
        selectedParkingSpaceMatch,
        selectedParkingSpaceOptions,
        selectedSegment,
        selectedTargetRouteEta,
      }),
    [
      navigationOrigin,
      resolveSegmentArrivalTarget,
      selectedParkingSpaceMatch,
      selectedParkingSpaceOptions,
      selectedSegment,
      selectedTargetRouteEta,
    ],
  )

  const bestAddressRecommendationRouteState = useMemo(
    () =>
      buildBestAddressRecommendationRouteDisplayState({
        bestAddressRecommendation,
        bestAddressRecommendationTarget,
        navigationOrigin,
        routeEtaBySegmentId,
      }),
    [
      bestAddressRecommendation,
      bestAddressRecommendationTarget,
      navigationOrigin,
      routeEtaBySegmentId,
    ],
  )

  useRouteEtaMatrixEffect({
    navigationOrigin,
    routeTargetSegments,
    routeTargetKey,
    resolveSegmentDestination,
    routeRequestIdRef,
    setRouteEtaBySegmentId,
    setRouteEtaStatus,
    setRouteEtaError,
  })

  useSelectedTargetRouteEtaEffect({
    selectedSegment,
    navigationOrigin,
    selectedCenter: selectedRouteDisplayState.selectedCenter,
    selectedRouteEtaRequestIdRef,
    setSelectedTargetRouteEta,
  })

  useSelectedRoutePathEffect({
    selectedSegment,
    navigationOrigin,
    selectedCenter: selectedRouteDisplayState.selectedCenter,
    selectedRouteProfile,
    selectedRouteRequestIdRef,
    setSelectedRoutePath,
    setSelectedRouteStatus,
    setSelectedRouteError,
  })

  return {
    ...selectedRouteDisplayState,
    ...bestAddressRecommendationRouteState,
  }
}
