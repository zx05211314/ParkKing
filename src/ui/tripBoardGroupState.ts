import { groupSavedPlansByDataset } from './savedPlanGrouping'
import { getSavedPlanGroupStorageKey } from './savedPlanBoardState'
import type {
  SavedPlan,
  SavedPlanGroup,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
  SavedPlanIntentSummary,
} from './savedPlanTypes'

interface BuildTripBoardGroupStateOptions {
  orderedSavedPlans: SavedPlan[]
  visibleSavedPlans: SavedPlan[]
  savedPlansCount: number
  collapsedSavedPlanGroups: string[]
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  tripBoardIntentFilterLabels: Record<SavedPlanIntentFilter, string>
  tripBoardSuggestionFilterLabels: Record<SavedPlanIntentSuggestionFilter, string>
  visibleSavedPlanIntentSummary: SavedPlanIntentSummary
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
}

export interface TripBoardGroupState {
  visibleSavedPlanGroups: SavedPlanGroup[]
  visibleSavedPlanGroupKeys: string[]
  hasCollapsedVisibleSavedPlanGroups: boolean
  hasExpandedVisibleSavedPlanGroups: boolean
  hiddenCollapsedSavedPlanCount: number
  tripBoardStatusSummary: string | null
}

export const buildTripBoardGroupState = ({
  orderedSavedPlans,
  visibleSavedPlans,
  savedPlansCount,
  collapsedSavedPlanGroups,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  tripBoardIntentFilterLabels,
  tripBoardSuggestionFilterLabels,
  visibleSavedPlanIntentSummary,
  formatSavedPlanIntentSummary,
}: BuildTripBoardGroupStateOptions): TripBoardGroupState => {
  const totalSavedPlanGroupCount = groupSavedPlansByDataset(orderedSavedPlans).length
  const visibleSavedPlanGroups = groupSavedPlansByDataset(visibleSavedPlans)
  const visibleSavedPlanGroupKeys = visibleSavedPlanGroups.map((group) =>
    getSavedPlanGroupStorageKey(group.key),
  )
  const hasCollapsedVisibleSavedPlanGroups = visibleSavedPlanGroupKeys.some((key) =>
    collapsedSavedPlanGroups.includes(key),
  )
  const hasExpandedVisibleSavedPlanGroups = visibleSavedPlanGroupKeys.some(
    (key) => !collapsedSavedPlanGroups.includes(key),
  )
  const expandedVisibleSavedPlanGroupCount = visibleSavedPlanGroups.filter(
    (group) => !collapsedSavedPlanGroups.includes(getSavedPlanGroupStorageKey(group.key)),
  ).length
  const expandedVisibleSavedPlanCount = visibleSavedPlanGroups.reduce(
    (sum, group) =>
      collapsedSavedPlanGroups.includes(getSavedPlanGroupStorageKey(group.key))
        ? sum
        : sum + group.count,
    0,
  )
  const filteredOutSavedPlanCount = Math.max(0, savedPlansCount - visibleSavedPlans.length)
  const hiddenCollapsedSavedPlanCount = Math.max(
    0,
    visibleSavedPlans.length - expandedVisibleSavedPlanCount,
  )

  let tripBoardStatusSummary: string | null = null
  if (savedPlansCount > 0) {
    const parts = [
      `Showing ${expandedVisibleSavedPlanCount} of ${savedPlansCount} saved plans`,
      `across ${expandedVisibleSavedPlanGroupCount} of ${totalSavedPlanGroupCount} groups`,
    ]

    if (filteredOutSavedPlanCount > 0) {
      parts.push(`${filteredOutSavedPlanCount} filtered out`)
    }
    if (hiddenCollapsedSavedPlanCount > 0) {
      parts.push(`${hiddenCollapsedSavedPlanCount} hidden in collapsed groups`)
    }
    if (tripBoardIntentFilter !== 'ALL') {
      parts.push(`intent ${tripBoardIntentFilterLabels[tripBoardIntentFilter]}`)
    }
    if (tripBoardIntentFilter === 'UNTAGGED' && tripBoardSuggestionFilter !== 'ALL') {
      parts.push(
        `review ${tripBoardSuggestionFilterLabels[tripBoardSuggestionFilter].toLowerCase()}`,
      )
    }
    const visibleIntentSummary = formatSavedPlanIntentSummary(
      visibleSavedPlanIntentSummary,
      visibleSavedPlanIntentSummary.unassignedCount,
    )
    if (visibleIntentSummary.length > 0) {
      parts.push(`visible intents ${visibleIntentSummary}`)
    }

    tripBoardStatusSummary = `${parts[0]}. ${parts.slice(1).join('. ')}.`
  }

  return {
    visibleSavedPlanGroups,
    visibleSavedPlanGroupKeys,
    hasCollapsedVisibleSavedPlanGroups,
    hasExpandedVisibleSavedPlanGroups,
    hiddenCollapsedSavedPlanCount,
    tripBoardStatusSummary,
  }
}
