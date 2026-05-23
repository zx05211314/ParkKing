import { useEffect } from 'react'
import {
  getRoutingRuntimeAvailability,
  searchRouteMatrix,
} from '../map/routing'
import type { SegmentLike, SegmentRouteEta } from './routePlanningTypes'

interface UseSelectedTargetRouteEtaEffectOptions {
  selectedSegment: SegmentLike | null
  navigationOrigin: [number, number] | null
  selectedCenter: [number, number] | null
  selectedRouteEtaRequestIdRef: { current: number }
  setSelectedTargetRouteEta: (value: SegmentRouteEta | null) => void
}

export const useSelectedTargetRouteEtaEffect = ({
  selectedSegment,
  navigationOrigin,
  selectedCenter,
  selectedRouteEtaRequestIdRef,
  setSelectedTargetRouteEta,
}: UseSelectedTargetRouteEtaEffectOptions) => {
  useEffect(() => {
    if (!selectedSegment || !navigationOrigin || !selectedCenter) {
      selectedRouteEtaRequestIdRef.current += 1
      setSelectedTargetRouteEta(null)
      return
    }

    const requestId = selectedRouteEtaRequestIdRef.current + 1
    selectedRouteEtaRequestIdRef.current = requestId
    setSelectedTargetRouteEta(null)

    if (!getRoutingRuntimeAvailability().etaAvailable) {
      return
    }

    void Promise.allSettled([
      searchRouteMatrix(navigationOrigin, [selectedCenter], 'walking'),
      searchRouteMatrix(navigationOrigin, [selectedCenter], 'driving'),
    ]).then((results) => {
      if (selectedRouteEtaRequestIdRef.current !== requestId) {
        return
      }

      const [walkingResult, drivingResult] = results
      const walkingRoute = walkingResult.status === 'fulfilled' ? walkingResult.value[0] : null
      const drivingRoute = drivingResult.status === 'fulfilled' ? drivingResult.value[0] : null

      if (!walkingRoute && !drivingRoute) {
        setSelectedTargetRouteEta(null)
        return
      }

      setSelectedTargetRouteEta({
        walkingDistanceMeters: walkingRoute?.distanceMeters ?? null,
        walkingDurationSeconds: walkingRoute?.durationSeconds ?? null,
        walkingEstimated: walkingRoute?.estimated ?? false,
        drivingDistanceMeters: drivingRoute?.distanceMeters ?? null,
        drivingDurationSeconds: drivingRoute?.durationSeconds ?? null,
        drivingEstimated: drivingRoute?.estimated ?? false,
      })
    })
  }, [
    navigationOrigin,
    selectedCenter,
    selectedRouteEtaRequestIdRef,
    selectedSegment,
    setSelectedTargetRouteEta,
  ])
}
