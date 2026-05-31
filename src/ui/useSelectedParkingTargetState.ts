import { useMemo } from 'react'
import {
  getParkingSpaceMatches,
  type ParkingSpaceCollection,
} from '../data/parkingSpaces'
import {
  buildSelectedParkingTargetDisplayState,
  getSelectedParkingSpaceKey,
  type RecommendationTargetLike,
  type SegmentLike,
} from './selectedParkingTargetState'

interface UseSelectedParkingTargetStateOptions {
  selectedSegment: SegmentLike | null
  selectedParkingSpaceKeyBySegment: Record<string, string>
  parkingSpaces: ParkingSpaceCollection
  navigationOrigin: [number, number] | null
  maxSelectedParkingSpaceOptions: number
  addressRecommendationTargets: RecommendationTargetLike[]
  selectedId: string | null
}

export const useSelectedParkingTargetState = ({
  selectedSegment,
  selectedParkingSpaceKeyBySegment,
  parkingSpaces,
  navigationOrigin,
  maxSelectedParkingSpaceOptions,
  addressRecommendationTargets,
  selectedId,
}: UseSelectedParkingTargetStateOptions) => {
  const selectedParkingSpaceKey = getSelectedParkingSpaceKey(
    selectedSegment,
    selectedParkingSpaceKeyBySegment,
  )

  const selectedParkingSpaceMatches = useMemo(() => {
    if (!selectedSegment) {
      return []
    }
    return getParkingSpaceMatches(selectedSegment.path, parkingSpaces, navigationOrigin)
  }, [navigationOrigin, parkingSpaces, selectedSegment])

  const displayState = useMemo(
    () =>
      buildSelectedParkingTargetDisplayState({
        selectedSegment,
        selectedParkingSpaceKey,
        selectedParkingSpaceMatches,
        navigationOrigin,
        maxSelectedParkingSpaceOptions,
        addressRecommendationTargets,
        selectedId,
      }),
    [
      addressRecommendationTargets,
      maxSelectedParkingSpaceOptions,
      navigationOrigin,
      selectedId,
      selectedParkingSpaceKey,
      selectedParkingSpaceMatches,
      selectedSegment,
    ],
  )

  return {
    selectedParkingSpaceMatches,
    ...displayState,
  }
}
