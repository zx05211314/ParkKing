import {
  DEFAULT_SAVED_PLAN_LIMIT,
  DEFAULT_TRIP_BOARD_FILTERS,
} from './savedPlanTypes'
import {
  normalizeSavedPlansValue,
  normalizeTripBoardFiltersValue,
} from './savedPlanNormalization'
import {
  addSavedPlanValue,
  applySavedPlanIntentSuggestionsValue,
  mergeSavedPlansValue,
  mergeSavedPlansWithConflictsValue,
  removeSavedPlanByUrl,
  resolveSavedPlanConflictsWithSharedValue,
  setSavedPlanIntentForUrlsValue,
  updateSavedPlanValue,
} from './savedPlanMutations'
import { filterSavedPlansValue } from './savedPlanFilters'
import type {
  SavedPlan,
  SavedPlanConflictMergeResult,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
  TripBoardFilters,
} from './savedPlanTypes'

export {
  buildSavedPlanComparisonHighlights,
  buildSavedPlanComparisonRows,
} from './savedPlanComparison'
export {
  getSavedPlanLeaderCandidates,
  getSavedPlanMetricLeaders,
  sortSavedPlans,
} from './savedPlanSort'
export {
  groupSavedPlansByDataset,
  groupSavedPlansByIntent,
  summarizeSavedPlanIntents,
  summarizeSavedPlans,
} from './savedPlanGrouping'
export {
  getSavedPlanGroupStorageKey,
  getTopSavedPlan,
  hasTripBoardFilters,
  normalizeSavedPlanCollapsedGroups,
  selectSavedPlansForCompare,
  toggleSavedPlanCollapsedGroup,
} from './savedPlanBoardState'
export {
  getSavedPlanConflictDetails,
  getSavedPlanConflictUrls,
} from './savedPlanConflictDetails'
export {
  filterSavedPlanIntentSuggestionAssignments,
  getSavedPlanIntentSuggestion,
  getSavedPlanIntentSuggestionAssignments,
  summarizeSavedPlanIntentSuggestionFilters,
  summarizeSavedPlanIntentSuggestions,
} from './savedPlanIntentSuggestions'
export {
  DEFAULT_SAVED_PLAN_LIMIT,
  DEFAULT_TRIP_BOARD_FILTERS,
  SAVED_PLAN_INTENT_LABELS,
  SAVED_PLAN_INTENTS,
  isSavedPlanIntent,
} from './savedPlanTypes'
export type {
  SavedPlan,
  SavedPlanComparisonHighlight,
  SavedPlanComparisonRow,
  SavedPlanConflictDetail,
  SavedPlanConflictFieldDetail,
  SavedPlanConflictMergeResult,
  SavedPlanGroup,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentGroup,
  SavedPlanIntentSuggestion,
  SavedPlanIntentSuggestionAssignment,
  SavedPlanIntentSuggestionFilter,
  SavedPlanIntentSuggestionFilterSummary,
  SavedPlanIntentSuggestionSummary,
  SavedPlanIntentSummary,
  SavedPlanMetricLeader,
  SavedPlanSummary,
  TripBoardFilters,
  TripBoardSortMode,
} from './savedPlanTypes'

export const normalizeSavedPlans = (
  value: unknown,
  limit = DEFAULT_SAVED_PLAN_LIMIT,
): SavedPlan[] => normalizeSavedPlansValue(value, limit)

export const normalizeTripBoardFilters = (
  value: unknown,
  fallback: TripBoardFilters = DEFAULT_TRIP_BOARD_FILTERS,
): TripBoardFilters => normalizeTripBoardFiltersValue(value, fallback)

export const addSavedPlan = (
  existing: SavedPlan[],
  next: Omit<SavedPlan, 'key'>,
  limit = DEFAULT_SAVED_PLAN_LIMIT,
) => addSavedPlanValue(existing, next, limit)

export const mergeSavedPlans = (
  incoming: SavedPlan[],
  existing: SavedPlan[],
  limit = DEFAULT_SAVED_PLAN_LIMIT,
) => mergeSavedPlansValue(incoming, existing, limit)

export const mergeSavedPlansWithConflicts = (
  preferred: SavedPlan[],
  incoming: SavedPlan[],
  limit = DEFAULT_SAVED_PLAN_LIMIT,
): SavedPlanConflictMergeResult =>
  mergeSavedPlansWithConflictsValue(preferred, incoming, limit)

export const updateSavedPlan = (
  existing: SavedPlan[],
  url: string,
  changes: Partial<
    Pick<
      SavedPlan,
      'title' | 'addressLabel' | 'segmentName' | 'targetLabel' | 'pinned'
    >
  > & {
    intent?: SavedPlanIntent | null
  },
  limit = DEFAULT_SAVED_PLAN_LIMIT,
) => updateSavedPlanValue(existing, url, changes, limit)

export const resolveSavedPlanConflictWithShared = (
  existing: SavedPlan[],
  sharedPlan: SavedPlan,
  limit = DEFAULT_SAVED_PLAN_LIMIT,
) => resolveSavedPlanConflictsWithShared(existing, [sharedPlan], limit)

export const resolveSavedPlanConflictsWithShared = (
  existing: SavedPlan[],
  sharedPlans: SavedPlan[],
  limit = DEFAULT_SAVED_PLAN_LIMIT,
) => resolveSavedPlanConflictsWithSharedValue(existing, sharedPlans, limit)

export const removeSavedPlan = (existing: SavedPlan[], url: string) =>
  removeSavedPlanByUrl(existing, url)

export const filterSavedPlans = (
  plans: SavedPlan[],
  query: string,
  filters: TripBoardFilters = DEFAULT_TRIP_BOARD_FILTERS,
  intentFilter: SavedPlanIntentFilter = 'ALL',
  suggestionFilter: SavedPlanIntentSuggestionFilter = 'ALL',
  conflictedUrls: string[] = [],
) =>
  filterSavedPlansValue(
    plans,
    query,
    filters,
    intentFilter,
    suggestionFilter,
    conflictedUrls,
  )

export const setSavedPlanIntentForUrls = (
  existing: SavedPlan[],
  urls: string[],
  intent: SavedPlanIntent | null,
  limit = DEFAULT_SAVED_PLAN_LIMIT,
) => setSavedPlanIntentForUrlsValue(existing, urls, intent, limit)

export const applySavedPlanIntentSuggestions = (
  existing: SavedPlan[],
  urls: string[],
  limit = DEFAULT_SAVED_PLAN_LIMIT,
) => applySavedPlanIntentSuggestionsValue(existing, urls, limit)
