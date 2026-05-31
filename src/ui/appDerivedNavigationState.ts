import type { AppDerivedStateOptions } from './appDerivedStateTypes'

export interface AppDerivedNavigationStateResult {
  activeDistanceLabel: string
  activeDistanceLocation: [number, number] | null
  navigationOrigin: [number, number] | null
  navigationSourceLabel: string | null
  searchLocation: [number, number] | null
  searchLocationLabel: string | null
  selectedParkingShareKey: string | null
}

export const buildAppDerivedNavigationState = ({
  locationLabel,
  searchAnchor,
  selectedId,
  selectedParkingSpaceKeyBySegment,
  userLocation,
}: Pick<
  AppDerivedStateOptions,
  | 'locationLabel'
  | 'searchAnchor'
  | 'selectedId'
  | 'selectedParkingSpaceKeyBySegment'
  | 'userLocation'
>): AppDerivedNavigationStateResult => {
  const searchLocation = searchAnchor?.result.center ?? null
  const searchLocationLabel = searchAnchor?.result.label ?? null
  const navigationOrigin = searchLocation ?? userLocation
  const navigationSourceLabel = searchLocationLabel
    ? `Pinned location: ${searchLocationLabel}`
    : userLocation
      ? `${locationLabel} location`
      : null
  const activeDistanceLocation = searchLocation ?? userLocation
  const activeDistanceLabel = searchLocationLabel ?? locationLabel
  const selectedParkingShareKey = selectedId
    ? selectedParkingSpaceKeyBySegment[selectedId] ?? null
    : null

  return {
    activeDistanceLabel,
    activeDistanceLocation,
    navigationOrigin,
    navigationSourceLabel,
    searchLocation,
    searchLocationLabel,
    selectedParkingShareKey,
  }
}
