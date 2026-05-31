import { useCallback } from 'react'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type {
  UseSegmentSelectionActionsOptions,
  UseSegmentSelectionActionsResult,
} from './segmentSelectionTypes'
import { useSegmentRecommendationSelectionActions } from './useSegmentRecommendationSelectionActions'
import { useSegmentSuggestionActions } from './useSegmentSuggestionActions'

export const useSegmentSelectionActions = ({
  selectedSegment,
  segmentFilterSuggestions,
  segmentSuggestionRefs,
  filterInputRef,
  setSelectedParkingSpaceKeyBySegment,
  setSelectedId,
  setFilterQuery,
  setActiveView,
  setRecommendationRankMode,
  setSelectedRouteProfile,
  rankModeToRouteProfile,
}: UseSegmentSelectionActionsOptions): UseSegmentSelectionActionsResult => {
  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [setSelectedId])

  const {
    handleSelectSegmentSuggestion,
    handleFilterInputKeyDown,
    handleSegmentSuggestionKeyDown,
  } = useSegmentSuggestionActions({
    segmentFilterSuggestions,
    segmentSuggestionRefs,
    filterInputRef,
    setFilterQuery: (value) => setFilterQuery(value),
    setSelectedId: (value) => setSelectedId(value),
    setActiveView: (value) => setActiveView(value),
  })

  const handleRecommendationRankModeChange = useCallback(
    (nextMode: AddressRecommendationRankMode) => {
      setRecommendationRankMode(nextMode)
      const nextRouteProfile = rankModeToRouteProfile(nextMode)
      if (nextRouteProfile) {
        setSelectedRouteProfile(nextRouteProfile)
      }
    },
    [rankModeToRouteProfile, setRecommendationRankMode, setSelectedRouteProfile],
  )

  const handleSelectedRouteProfileChange = useCallback(
    (profile: RouteProfile) => {
      setSelectedRouteProfile(profile)
      setActiveView('MAP')
    },
    [setActiveView, setSelectedRouteProfile],
  )

  const {
    handleSelectSelectedParkingSpace,
    handleSelectRecommendedTarget,
    handleSelectAddressRecommendation,
    handleNavigateToRecommendation,
    handleSelectListSegment,
    handleNavigateFromListSegment,
  } = useSegmentRecommendationSelectionActions({
    selectedSegment,
    setSelectedParkingSpaceKeyBySegment,
    setSelectedId,
    setActiveView,
    setSelectedRouteProfile,
  })

  return {
    handleSelect,
    handleSelectSegmentSuggestion,
    handleFilterInputKeyDown,
    handleSegmentSuggestionKeyDown,
    handleRecommendationRankModeChange,
    handleSelectedRouteProfileChange,
    handleSelectSelectedParkingSpace,
    handleSelectRecommendedTarget,
    handleSelectAddressRecommendation,
    handleNavigateToRecommendation,
    handleSelectListSegment,
    handleNavigateFromListSegment,
  }
}
