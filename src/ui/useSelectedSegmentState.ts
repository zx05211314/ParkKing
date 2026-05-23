import { useMemo } from 'react'
import type { RiskMode } from '../domain/ranking/policy'
import type { ParkingSpaceCollection } from '../data/parkingSpaces'
import type { SegmentReport } from '../feedback/reports'
import { useSelectedParkingTargetState } from './useSelectedParkingTargetState'
import { useSelectedSegmentDetailState } from './useSelectedSegmentDetailState'
import type { AddressRecommendationTarget } from './addressRecommendationTargets'
import type { RecommendationSortableSegment } from './segmentDisplayTypes'
import type { SegmentListItem } from './segmentListTypes'
import type { EvaluatedSegment } from './types'

type SelectedSegment = EvaluatedSegment & {
  distanceMeters?: number
  rankScore?: number
}

interface UseSelectedSegmentStateOptions {
  selectedId: string | null
  segmentsWithDistance: SegmentListItem[]
  evaluatedSegments: EvaluatedSegment[]
  reportsBySegment: Record<string, SegmentReport>
  activeDistanceLocation: [number, number] | null
  riskMode: RiskMode
  selectedParkingSpaceKeyBySegment: Record<string, string>
  parkingSpaces: ParkingSpaceCollection
  navigationOrigin: [number, number] | null
  maxSelectedParkingSpaceOptions: number
  addressRecommendationTargets: AddressRecommendationTarget<RecommendationSortableSegment>[]
}

interface UseSelectedSegmentStateResult {
  selectedSegment: SelectedSegment | null
  latestReport: SegmentReport | null
  selectedDistance: number | null
  selectedRankBreakdown: ReturnType<
    typeof useSelectedSegmentDetailState
  >['selectedRankBreakdown']
  selectedParkingSpaceMatches: ReturnType<
    typeof useSelectedParkingTargetState
  >['selectedParkingSpaceMatches']
  selectedParkingSpaceMatch: ReturnType<
    typeof useSelectedParkingTargetState
  >['selectedParkingSpaceMatch']
  selectedParkingSpaceOptions: ReturnType<
    typeof useSelectedParkingTargetState
  >['selectedParkingSpaceOptions']
  selectedParkingSpaceMapMarkers: ReturnType<
    typeof useSelectedParkingTargetState
  >['selectedParkingSpaceMapMarkers']
  recommendedParkingTargetMarkers: ReturnType<
    typeof useSelectedParkingTargetState
  >['recommendedParkingTargetMarkers']
  selectedParkingSpaceTargetMode: ReturnType<
    typeof useSelectedParkingTargetState
  >['selectedParkingSpaceTargetMode']
}

export const useSelectedSegmentState = ({
  selectedId,
  segmentsWithDistance,
  evaluatedSegments,
  reportsBySegment,
  activeDistanceLocation,
  riskMode,
  selectedParkingSpaceKeyBySegment,
  parkingSpaces,
  navigationOrigin,
  maxSelectedParkingSpaceOptions,
  addressRecommendationTargets,
}: UseSelectedSegmentStateOptions): UseSelectedSegmentStateResult => {
  const selectedSegment = useMemo(() => {
    if (!selectedId) {
      return null
    }
    const rankedMatch = segmentsWithDistance.find((segment) => segment.id === selectedId)
    if (rankedMatch) {
      return rankedMatch as SelectedSegment
    }
    return evaluatedSegments.find((segment) => segment.id === selectedId) ?? null
  }, [evaluatedSegments, segmentsWithDistance, selectedId])

  const {
    latestReport,
    selectedDistance,
    selectedRankBreakdown,
  } = useSelectedSegmentDetailState({
    selectedSegment,
    reportsBySegment,
    activeDistanceLocation,
    riskMode,
  })

  const {
    selectedParkingSpaceMatches,
    selectedParkingSpaceMatch,
    selectedParkingSpaceOptions,
    selectedParkingSpaceMapMarkers,
    recommendedParkingTargetMarkers,
    selectedParkingSpaceTargetMode,
  } = useSelectedParkingTargetState({
    selectedSegment,
    selectedParkingSpaceKeyBySegment,
    parkingSpaces,
    navigationOrigin,
    maxSelectedParkingSpaceOptions,
    addressRecommendationTargets,
    selectedId,
  })

  return {
    selectedSegment,
    latestReport,
    selectedDistance,
    selectedRankBreakdown,
    selectedParkingSpaceMatches,
    selectedParkingSpaceMatch,
    selectedParkingSpaceOptions,
    selectedParkingSpaceMapMarkers,
    recommendedParkingTargetMarkers,
    selectedParkingSpaceTargetMode,
  }
}
