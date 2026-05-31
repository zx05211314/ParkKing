import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from 'react'
import type { RouteProfile } from '../map/routing'
import type { AddressRecommendationRankMode } from './addressRecommendations'
import type { SegmentListItem } from './segmentListTypes'

export interface SegmentSuggestion {
  id: string
  name: string
}

export interface UseSegmentSelectionActionsOptions {
  selectedSegment: { id: string } | null
  segmentFilterSuggestions: SegmentSuggestion[]
  segmentSuggestionRefs: RefObject<(HTMLButtonElement | null)[]>
  filterInputRef: RefObject<HTMLInputElement | null>
  setSelectedParkingSpaceKeyBySegment: Dispatch<SetStateAction<Record<string, string>>>
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setFilterQuery: Dispatch<SetStateAction<string>>
  setActiveView: Dispatch<SetStateAction<'LIST' | 'MAP'>>
  setRecommendationRankMode: Dispatch<SetStateAction<AddressRecommendationRankMode>>
  setSelectedRouteProfile: Dispatch<SetStateAction<RouteProfile>>
  rankModeToRouteProfile: (value: AddressRecommendationRankMode) => RouteProfile | null
}

export interface UseSegmentSelectionActionsResult {
  handleSelect: (id: string | null) => void
  handleSelectSegmentSuggestion: (segment: SegmentSuggestion) => void
  handleFilterInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  handleSegmentSuggestionKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => void
  handleRecommendationRankModeChange: (nextMode: AddressRecommendationRankMode) => void
  handleSelectedRouteProfileChange: (profile: RouteProfile) => void
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
