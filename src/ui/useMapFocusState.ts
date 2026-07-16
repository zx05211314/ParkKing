import { useMemo } from 'react'
import type { GeocodeResult } from '../map/geocoder'
import type { MapBounds } from '../map/bounds'
import { boundsFromPath } from '../map/bounds'
import type { RoutePathEntry, RouteProfile } from '../map/routing'

interface FocusableSegment {
  id: string
  path: [number, number][]
}

interface SearchAnchor {
  key: string
  result: GeocodeResult
}

interface RecommendationTargetLike {
  destination: [number, number] | null
  segment: {
    path: [number, number][]
  }
}

interface FocusBounds {
  key: string
  bounds: MapBounds
}

interface FocusCenter {
  key: string
  center: [number, number]
}

export const buildPinnedLocationFocus = (params: {
  searchLocation: [number, number] | null
}): FocusCenter | null => {
  if (!params.searchLocation) {
    return null
  }
  const [longitude, latitude] = params.searchLocation
  return {
    key: `pinned:${longitude.toFixed(6)},${latitude.toFixed(6)}`,
    center: params.searchLocation,
  }
}

interface UseMapFocusStateOptions {
  selectedSegment: FocusableSegment | null
  selectedRoutePath: RoutePathEntry | null
  selectedRouteProfile: RouteProfile
  selectedCenter: [number, number] | null
  searchAnchor: SearchAnchor | null
  searchLocation: [number, number] | null
  addressRecommendationTargets: RecommendationTargetLike[]
  recommendedSegmentIds: string[]
}

interface UseMapFocusStateResult {
  activeFocusBounds: FocusBounds | null
  activeFocusCenter: FocusCenter | null
}

export const useMapFocusState = ({
  selectedSegment,
  selectedRoutePath,
  selectedRouteProfile,
  selectedCenter,
  searchAnchor,
  searchLocation,
  addressRecommendationTargets,
  recommendedSegmentIds,
}: UseMapFocusStateOptions): UseMapFocusStateResult => {
  const selectedBounds = useMemo(() => {
    if (!selectedSegment) {
      return null
    }
    return boundsFromPath(selectedSegment.path)
  }, [selectedSegment])

  const selectedRouteBounds = useMemo(() => {
    if (!selectedSegment) {
      return null
    }
    const coordinates: [number, number][] = [...selectedSegment.path]
    if (selectedRoutePath?.geometry) {
      coordinates.push(...selectedRoutePath.geometry)
    }
    if (selectedCenter) {
      coordinates.push(selectedCenter)
    }
    return boundsFromPath(coordinates)
  }, [selectedCenter, selectedRoutePath, selectedSegment])

  const selectedRouteFocusBounds = useMemo(() => {
    if (!selectedSegment || !selectedRouteBounds) {
      return null
    }
    const routeGeometryKey = selectedRoutePath?.geometry
      ? `${selectedRoutePath.geometry.length}:${selectedRoutePath.geometry[selectedRoutePath.geometry.length - 1]?.join(',')}`
      : 'pending'
    return {
      key: `route:${selectedSegment.id}:${selectedRouteProfile}:${routeGeometryKey}`,
      bounds: selectedRouteBounds,
    }
  }, [selectedRouteBounds, selectedRoutePath, selectedRouteProfile, selectedSegment])

  const selectedFocusBounds = useMemo(() => {
    if (!selectedSegment || !selectedBounds) {
      return null
    }
    return {
      key: `segment:${selectedSegment.id}`,
      bounds: selectedBounds,
    }
  }, [selectedBounds, selectedSegment])

  const selectedFocusCenter = useMemo(() => {
    if (!selectedSegment || selectedBounds || !selectedCenter) {
      return null
    }
    return {
      key: `segment:${selectedSegment.id}`,
      center: selectedCenter,
    }
  }, [selectedBounds, selectedCenter, selectedSegment])

  const searchFocusBounds = useMemo(() => {
    if (!searchAnchor?.result.bounds) {
      return null
    }
    return {
      key: searchAnchor.key,
      bounds: searchAnchor.result.bounds,
    }
  }, [searchAnchor])

  const searchFocusCenter = useMemo(() => {
    if (!searchAnchor || searchAnchor.result.bounds) {
      return null
    }
    return {
      key: searchAnchor.key,
      center: searchAnchor.result.center,
    }
  }, [searchAnchor])

  const pinnedLocationFocusCenter = useMemo(
    () => buildPinnedLocationFocus({ searchLocation }),
    [searchLocation],
  )

  const addressRecommendationFocusBounds = useMemo(() => {
    if (!searchAnchor) {
      return null
    }

    const focusCoordinates: [number, number][] = searchLocation ? [searchLocation] : []
    addressRecommendationTargets.forEach((recommendation) => {
      if (recommendation.destination) {
        focusCoordinates.push(recommendation.destination)
        return
      }
      focusCoordinates.push(...recommendation.segment.path)
    })
    const bounds = boundsFromPath(focusCoordinates)
    if (!bounds || focusCoordinates.length === 0) {
      return null
    }

    return {
      key: `${searchAnchor.key}:recommendations:${recommendedSegmentIds.join(',')}`,
      bounds,
    }
  }, [addressRecommendationTargets, recommendedSegmentIds, searchAnchor, searchLocation])

  const activeFocusBounds =
    selectedRouteFocusBounds ??
    selectedFocusBounds ??
    addressRecommendationFocusBounds ??
    searchFocusBounds

  const activeFocusCenter =
    selectedFocusCenter ??
    (selectedRouteFocusBounds ||
    selectedFocusBounds ||
    addressRecommendationFocusBounds ||
    searchFocusBounds
      ? null
      : searchFocusCenter ?? pinnedLocationFocusCenter)

  return {
    activeFocusBounds,
    activeFocusCenter,
  }
}
