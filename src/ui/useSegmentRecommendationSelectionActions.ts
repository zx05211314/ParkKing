import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { RouteProfile } from '../map/routing'
import type { SegmentListItem } from './segmentListTypes'

interface UseSegmentRecommendationSelectionActionsOptions {
  selectedSegment: { id: string } | null
  setSelectedParkingSpaceKeyBySegment: Dispatch<SetStateAction<Record<string, string>>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setActiveView: Dispatch<SetStateAction<'LIST' | 'MAP'>>
  setSelectedRouteProfile: Dispatch<SetStateAction<RouteProfile>>
}

interface UseSegmentRecommendationSelectionActionsResult {
  handleSelectSelectedParkingSpace: (key: string | null) => void
  handleSelectRecommendedTarget: (segmentId: string, key: string | null) => void
  handleSelectAddressRecommendation: (id: string, key?: string | null) => void
  handleNavigateToRecommendation: (
    id: string,
    profile: RouteProfile,
    key?: string | null,
  ) => void
  handleSelectListSegment: (segment: SegmentListItem) => void
  handleNavigateFromListSegment: (
    segment: SegmentListItem,
    profile: RouteProfile,
  ) => void
}

export const useSegmentRecommendationSelectionActions = ({
  selectedSegment,
  setSelectedParkingSpaceKeyBySegment,
  setSelectedId,
  setActiveView,
  setSelectedRouteProfile,
}: UseSegmentRecommendationSelectionActionsOptions): UseSegmentRecommendationSelectionActionsResult => {
  const applySegmentParkingTarget = useCallback(
    (segmentId: string, key: string | null) => {
      setSelectedParkingSpaceKeyBySegment((current) => {
        const next = { ...current }
        if (!key) {
          delete next[segmentId]
        } else {
          next[segmentId] = key
        }
        return next
      })
    },
    [setSelectedParkingSpaceKeyBySegment],
  )

  const handleSelectSelectedParkingSpace = useCallback(
    (key: string | null) => {
      if (!selectedSegment) {
        return
      }

      applySegmentParkingTarget(selectedSegment.id, key)
      setActiveView('MAP')
    },
    [applySegmentParkingTarget, selectedSegment, setActiveView],
  )

  const handleSelectRecommendedTarget = useCallback(
    (segmentId: string, key: string | null) => {
      applySegmentParkingTarget(segmentId, key)
      setSelectedId(segmentId)
      setActiveView('MAP')
    },
    [applySegmentParkingTarget, setActiveView, setSelectedId],
  )

  const handleSelectAddressRecommendation = useCallback(
    (id: string, key: string | null = null) => {
      applySegmentParkingTarget(id, key)
      setSelectedId(id)
      setActiveView('MAP')
    },
    [applySegmentParkingTarget, setActiveView, setSelectedId],
  )

  const handleNavigateToRecommendation = useCallback(
    (id: string, profile: RouteProfile, key: string | null = null) => {
      applySegmentParkingTarget(id, key)
      setSelectedId(id)
      setSelectedRouteProfile(profile)
      setActiveView('MAP')
    },
    [applySegmentParkingTarget, setActiveView, setSelectedId, setSelectedRouteProfile],
  )

  const handleSelectListSegment = useCallback(
    (segment: SegmentListItem) => {
      applySegmentParkingTarget(segment.id, segment.quickActionTargetKey ?? null)
      setSelectedId(segment.id)
    },
    [applySegmentParkingTarget, setSelectedId],
  )

  const handleNavigateFromListSegment = useCallback(
    (segment: SegmentListItem, profile: RouteProfile) => {
      handleNavigateToRecommendation(
        segment.id,
        profile,
        segment.quickActionTargetKey ?? null,
      )
    },
    [handleNavigateToRecommendation],
  )

  return {
    handleSelectSelectedParkingSpace,
    handleSelectRecommendedTarget,
    handleSelectAddressRecommendation,
    handleNavigateToRecommendation,
    handleSelectListSegment,
    handleNavigateFromListSegment,
  }
}
