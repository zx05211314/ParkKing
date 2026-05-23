import { useState } from 'react'
import { readSetting, STORAGE_KEYS } from '../settings'
import {
  DEFAULT_TRIP_BOARD_FILTERS,
  type TripBoardFilters,
  type TripBoardSortMode,
} from './savedPlanTypes'
import { normalizeTripBoardFiltersValue } from './savedPlanNormalization'
import {
  isTripBoardIntentFilter,
  isTripBoardSortMode,
  isTripBoardSuggestionFilter,
  type TripBoardIntentFilter,
  type TripBoardSuggestionFilter,
} from './appPresentationConfig'

interface UseTripBoardFilterUiStateOptions {
  defaultTripBoardSortMode: TripBoardSortMode
}

export const useTripBoardFilterUiState = ({
  defaultTripBoardSortMode,
}: UseTripBoardFilterUiStateOptions) => {
  const [tripBoardSortMode, setTripBoardSortMode] = useState<TripBoardSortMode>(() => {
    const stored = readSetting<unknown>(
      STORAGE_KEYS.tripBoardSortMode,
      defaultTripBoardSortMode,
    )
    return isTripBoardSortMode(stored) ? stored : defaultTripBoardSortMode
  })
  const [tripBoardIntentFilter, setTripBoardIntentFilter] = useState<TripBoardIntentFilter>(() => {
    const stored = readSetting<unknown>(STORAGE_KEYS.tripBoardIntentFilter, 'ALL')
    return isTripBoardIntentFilter(stored) ? stored : 'ALL'
  })
  const [tripBoardSuggestionFilter, setTripBoardSuggestionFilter] =
    useState<TripBoardSuggestionFilter>(() => {
      const stored = readSetting<unknown>(
        STORAGE_KEYS.tripBoardSuggestionFilter,
        'ALL',
      )
      if (!isTripBoardSuggestionFilter(stored)) {
        return 'ALL'
      }
      return tripBoardIntentFilter === 'UNTAGGED' || stored === 'ALL'
        ? stored
        : 'ALL'
    })
  const [tripBoardFilters, setTripBoardFilters] = useState<TripBoardFilters>(() =>
    normalizeTripBoardFiltersValue(
      readSetting<unknown>(STORAGE_KEYS.tripBoardFilters, DEFAULT_TRIP_BOARD_FILTERS),
      DEFAULT_TRIP_BOARD_FILTERS,
    ),
  )
  const [tripBoardQuery, setTripBoardQuery] = useState('')

  return {
    setTripBoardFilters,
    setTripBoardIntentFilter,
    setTripBoardQuery,
    setTripBoardSortMode,
    setTripBoardSuggestionFilter,
    tripBoardFilters,
    tripBoardIntentFilter,
    tripBoardQuery,
    tripBoardSortMode,
    tripBoardSuggestionFilter,
  }
}
