import { useCallback, type Dispatch, type SetStateAction } from 'react'
import {
  DEFAULT_TRIP_BOARD_FILTERS,
  type SavedPlanIntentFilter,
  type SavedPlanIntentSuggestionFilter,
  type TripBoardFilters,
} from './savedPlanTypes'
import { toggleSavedPlanCollapsedGroup } from './savedPlanBoardState'

interface UseTripBoardFilterActionsOptions {
  visibleSavedPlanGroupKeys: string[]
  tripBoardIntentFilter: SavedPlanIntentFilter
  setTripBoardFilters: Dispatch<SetStateAction<TripBoardFilters>>
  setTripBoardIntentFilter: Dispatch<SetStateAction<SavedPlanIntentFilter>>
  setTripBoardSuggestionFilter: Dispatch<
    SetStateAction<SavedPlanIntentSuggestionFilter>
  >
  setTripBoardQuery: Dispatch<SetStateAction<string>>
  setCollapsedSavedPlanGroups: Dispatch<SetStateAction<string[]>>
}

export interface UseTripBoardFilterActionsResult {
  handleToggleTripBoardFilter: (key: keyof TripBoardFilters) => void
  handleSetTripBoardIntentFilter: (value: SavedPlanIntentFilter) => void
  handleSetTripBoardSuggestionFilter: (
    value: SavedPlanIntentSuggestionFilter,
  ) => void
  handleShowAllUntaggedSavedPlans: () => void
  handleResetTripBoardFilters: () => void
  handleClearTripBoardSearch: () => void
  handleToggleSavedPlanGroupCollapsed: (groupKey: string | null) => void
  handleCollapseAllSavedPlanGroups: () => void
  handleExpandAllSavedPlanGroups: () => void
}

export const useTripBoardFilterActions = ({
  visibleSavedPlanGroupKeys,
  tripBoardIntentFilter,
  setTripBoardFilters,
  setTripBoardIntentFilter,
  setTripBoardSuggestionFilter,
  setTripBoardQuery,
  setCollapsedSavedPlanGroups,
}: UseTripBoardFilterActionsOptions): UseTripBoardFilterActionsResult => {
  const handleToggleTripBoardFilter = useCallback(
    (key: keyof TripBoardFilters) => {
      setTripBoardFilters((current) => ({
        ...current,
        [key]: !current[key],
      }))
    },
    [setTripBoardFilters],
  )

  const handleSetTripBoardIntentFilter = useCallback(
    (value: SavedPlanIntentFilter) => {
      setTripBoardIntentFilter(value)
      if (value !== 'UNTAGGED') {
        setTripBoardSuggestionFilter('ALL')
      }
    },
    [setTripBoardIntentFilter, setTripBoardSuggestionFilter],
  )

  const handleSetTripBoardSuggestionFilter = useCallback(
    (value: SavedPlanIntentSuggestionFilter) => {
      setTripBoardSuggestionFilter(value)
      if (value !== 'ALL' && tripBoardIntentFilter !== 'UNTAGGED') {
        setTripBoardIntentFilter('UNTAGGED')
      }
    },
    [setTripBoardIntentFilter, setTripBoardSuggestionFilter, tripBoardIntentFilter],
  )

  const handleShowAllUntaggedSavedPlans = useCallback(() => {
    setTripBoardIntentFilter('UNTAGGED')
    setTripBoardSuggestionFilter('ALL')
  }, [setTripBoardIntentFilter, setTripBoardSuggestionFilter])

  const handleResetTripBoardFilters = useCallback(() => {
    setTripBoardFilters(DEFAULT_TRIP_BOARD_FILTERS)
    setTripBoardIntentFilter('ALL')
    setTripBoardSuggestionFilter('ALL')
  }, [setTripBoardFilters, setTripBoardIntentFilter, setTripBoardSuggestionFilter])

  const handleClearTripBoardSearch = useCallback(() => {
    setTripBoardQuery('')
  }, [setTripBoardQuery])

  const handleToggleSavedPlanGroupCollapsed = useCallback(
    (groupKey: string | null) => {
      setCollapsedSavedPlanGroups((current) =>
        toggleSavedPlanCollapsedGroup(current, groupKey),
      )
    },
    [setCollapsedSavedPlanGroups],
  )

  const handleCollapseAllSavedPlanGroups = useCallback(() => {
    setCollapsedSavedPlanGroups((current) =>
      Array.from(new Set([...current, ...visibleSavedPlanGroupKeys])),
    )
  }, [setCollapsedSavedPlanGroups, visibleSavedPlanGroupKeys])

  const handleExpandAllSavedPlanGroups = useCallback(() => {
    setCollapsedSavedPlanGroups((current) =>
      current.filter((key) => !visibleSavedPlanGroupKeys.includes(key)),
    )
  }, [setCollapsedSavedPlanGroups, visibleSavedPlanGroupKeys])

  return {
    handleToggleTripBoardFilter,
    handleSetTripBoardIntentFilter,
    handleSetTripBoardSuggestionFilter,
    handleShowAllUntaggedSavedPlans,
    handleResetTripBoardFilters,
    handleClearTripBoardSearch,
    handleToggleSavedPlanGroupCollapsed,
    handleCollapseAllSavedPlanGroups,
    handleExpandAllSavedPlanGroups,
  }
}
