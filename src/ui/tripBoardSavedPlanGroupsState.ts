import type {
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
} from './savedPlanTypes'

export const getTripBoardSavedPlanGroupsEmptyMessage = (
  tripBoardQuery: string,
  tripBoardIntentFilter: SavedPlanIntentFilter,
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter,
) => {
  if (tripBoardQuery.trim().length > 0) {
    return `No saved plans match "${tripBoardQuery.trim()}".`
  }

  if (tripBoardIntentFilter === 'UNTAGGED') {
    if (tripBoardSuggestionFilter === 'SUGGESTED') {
      return 'No suggested untagged saved plans match the current trip board filters.'
    }
    if (tripBoardSuggestionFilter === 'MANUAL') {
      return 'No manual-review untagged saved plans match the current trip board filters.'
    }
    return 'No untagged saved plans match the current trip board filters.'
  }

  return 'No saved plans match the current trip board filters.'
}
