import { useEffect } from 'react'
import {
  getRoutingRuntimeAvailability,
  searchRoutePath,
  type RoutePathEntry,
  type RouteProfile,
} from '../map/routing'
import type { RouteOverlayStatus, SegmentLike } from './routePlanningTypes'

interface UseSelectedRoutePathEffectOptions {
  selectedSegment: SegmentLike | null
  navigationOrigin: [number, number] | null
  selectedCenter: [number, number] | null
  selectedRouteProfile: RouteProfile
  selectedRouteRequestIdRef: { current: number }
  setSelectedRoutePath: (value: RoutePathEntry | null) => void
  setSelectedRouteStatus: (value: RouteOverlayStatus) => void
  setSelectedRouteError: (value: string | null) => void
}

export const useSelectedRoutePathEffect = ({
  selectedSegment,
  navigationOrigin,
  selectedCenter,
  selectedRouteProfile,
  selectedRouteRequestIdRef,
  setSelectedRoutePath,
  setSelectedRouteStatus,
  setSelectedRouteError,
}: UseSelectedRoutePathEffectOptions) => {
  useEffect(() => {
    if (!selectedSegment || !navigationOrigin || !selectedCenter) {
      selectedRouteRequestIdRef.current += 1
      setSelectedRoutePath(null)
      setSelectedRouteStatus('idle')
      setSelectedRouteError(null)
      return
    }

    const requestId = selectedRouteRequestIdRef.current + 1
    selectedRouteRequestIdRef.current = requestId
    setSelectedRoutePath(null)
    const routingAvailability = getRoutingRuntimeAvailability()
    if (!routingAvailability.pathAvailable) {
      setSelectedRouteStatus('idle')
      setSelectedRouteError(routingAvailability.pathMessage)
      return
    }

    setSelectedRouteStatus('loading')
    setSelectedRouteError(null)

    void searchRoutePath(navigationOrigin, selectedCenter, selectedRouteProfile)
      .then((routePath) => {
        if (selectedRouteRequestIdRef.current !== requestId) {
          return
        }

        setSelectedRoutePath(routePath)
        setSelectedRouteStatus('ready')
        if (!routePath.geometry || routePath.geometry.length < 2) {
          setSelectedRouteError('No route geometry returned for the selected profile.')
        }
      })
      .catch((error) => {
        if (selectedRouteRequestIdRef.current !== requestId) {
          return
        }

        setSelectedRoutePath(null)
        setSelectedRouteStatus('error')
        setSelectedRouteError(
          error instanceof Error ? error.message : 'Route overlay unavailable.',
        )
      })
  }, [
    navigationOrigin,
    selectedCenter,
    selectedRouteProfile,
    selectedRouteRequestIdRef,
    selectedSegment,
    setSelectedRouteError,
    setSelectedRoutePath,
    setSelectedRouteStatus,
  ])
}
