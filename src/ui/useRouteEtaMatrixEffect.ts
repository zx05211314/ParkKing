import { useEffect } from 'react'
import {
  getRoutingRuntimeAvailability,
  searchRouteMatrix,
} from '../map/routing'
import type {
  RouteOverlayStatus,
  SegmentLike,
  SegmentRouteEta,
} from './routePlanningTypes'

interface UseRouteEtaMatrixEffectOptions {
  navigationOrigin: [number, number] | null
  routeTargetSegments: SegmentLike[]
  routeTargetKey: string
  resolveSegmentDestination: (
    path: [number, number][],
    origin: [number, number] | null,
    preferredParkingSpaceOverride?: [number, number] | null,
  ) => [number, number] | null
  routeRequestIdRef: { current: number }
  setRouteEtaBySegmentId: (value: Record<string, SegmentRouteEta>) => void
  setRouteEtaStatus: (value: RouteOverlayStatus) => void
  setRouteEtaError: (value: string | null) => void
}

export const useRouteEtaMatrixEffect = ({
  navigationOrigin,
  routeTargetSegments,
  routeTargetKey,
  resolveSegmentDestination,
  routeRequestIdRef,
  setRouteEtaBySegmentId,
  setRouteEtaStatus,
  setRouteEtaError,
}: UseRouteEtaMatrixEffectOptions) => {
  useEffect(() => {
    if (!navigationOrigin || routeTargetSegments.length === 0) {
      routeRequestIdRef.current += 1
      setRouteEtaBySegmentId({})
      setRouteEtaStatus('idle')
      setRouteEtaError(null)
      return
    }

    const targets = routeTargetSegments.flatMap((segment) => {
      const destination = resolveSegmentDestination(segment.path, navigationOrigin)
      if (!destination) {
        return []
      }
      return [{ segmentId: segment.id, destination }]
    })

    if (targets.length === 0) {
      routeRequestIdRef.current += 1
      setRouteEtaBySegmentId({})
      setRouteEtaStatus('idle')
      setRouteEtaError(null)
      return
    }

    const requestId = routeRequestIdRef.current + 1
    routeRequestIdRef.current = requestId
    const routingAvailability = getRoutingRuntimeAvailability()
    if (!routingAvailability.etaAvailable) {
      setRouteEtaBySegmentId({})
      setRouteEtaStatus('ready')
      setRouteEtaError(routingAvailability.etaMessage)
      return
    }

    setRouteEtaStatus('loading')
    setRouteEtaError(null)

    const destinations = targets.map((target) => target.destination)

    void Promise.allSettled([
      searchRouteMatrix(navigationOrigin, destinations, 'walking'),
      searchRouteMatrix(navigationOrigin, destinations, 'driving'),
    ]).then((results) => {
      if (routeRequestIdRef.current !== requestId) {
        return
      }

      const [walkingResult, drivingResult] = results
      const nextRouteEtas: Record<string, SegmentRouteEta> = {}
      targets.forEach((target) => {
        nextRouteEtas[target.segmentId] = {
          walkingDistanceMeters: null,
          walkingDurationSeconds: null,
          walkingEstimated: false,
          drivingDistanceMeters: null,
          drivingDurationSeconds: null,
          drivingEstimated: false,
        }
      })

      if (walkingResult.status === 'fulfilled') {
        walkingResult.value.forEach((entry, index) => {
          const segmentId = targets[index]?.segmentId
          if (!segmentId || !nextRouteEtas[segmentId]) {
            return
          }
          nextRouteEtas[segmentId].walkingDistanceMeters = entry.distanceMeters
          nextRouteEtas[segmentId].walkingDurationSeconds = entry.durationSeconds
          nextRouteEtas[segmentId].walkingEstimated = entry.estimated
        })
      }

      if (drivingResult.status === 'fulfilled') {
        drivingResult.value.forEach((entry, index) => {
          const segmentId = targets[index]?.segmentId
          if (!segmentId || !nextRouteEtas[segmentId]) {
            return
          }
          nextRouteEtas[segmentId].drivingDistanceMeters = entry.distanceMeters
          nextRouteEtas[segmentId].drivingDurationSeconds = entry.durationSeconds
          nextRouteEtas[segmentId].drivingEstimated = entry.estimated
        })
      }

      setRouteEtaBySegmentId(nextRouteEtas)

      const errorMessages = Array.from(
        new Set(
          [walkingResult, drivingResult].flatMap((result) => {
            if (result.status !== 'rejected') {
              return []
            }
            return [
              result.reason instanceof Error
                ? result.reason.message
                : 'Routing ETA unavailable.',
            ]
          }),
        ),
      )

      if (walkingResult.status === 'rejected' && drivingResult.status === 'rejected') {
        setRouteEtaStatus('error')
        setRouteEtaError(errorMessages.join(' ') || 'Routing ETA unavailable.')
        return
      }

      setRouteEtaStatus('ready')
      setRouteEtaError(errorMessages.join(' ') || null)
    })
  }, [
    navigationOrigin,
    resolveSegmentDestination,
    routeRequestIdRef,
    routeTargetKey,
    routeTargetSegments,
    setRouteEtaBySegmentId,
    setRouteEtaError,
    setRouteEtaStatus,
  ])
}
