import {
  type SavedPlan,
  type SavedPlanIntent,
  type SavedPlanIntentFilter,
  type SavedPlanIntentSuggestion,
  type SavedPlanIntentSuggestionFilter,
  type SavedPlanIntentSuggestionSummary,
  type SavedPlanIntentSummary,
} from './savedPlanTypes'
import { TripBoardBulkTagBar } from './TripBoardBulkTagBar'
import { TripBoardManualQueue } from './TripBoardManualQueue'
import { TripBoardSuggestedQueue } from './TripBoardSuggestedQueue'

interface TripBoardReviewQueuesProps {
  visibleSavedPlans: SavedPlan[]
  visibleSavedPlanIntentSummary: SavedPlanIntentSummary
  visibleUntaggedSavedPlanSuggestionSummary: SavedPlanIntentSuggestionSummary
  visibleUntaggedSavedPlanSuggestionSummaryText: string | null
  visibleSuggestedUntaggedSavedPlanQueue: SavedPlan[]
  visibleSuggestedUntaggedSavedPlans: SavedPlan[]
  visibleManualUntaggedSavedPlanQueue: SavedPlan[]
  visibleManualUntaggedSavedPlans: SavedPlan[]
  visibleUntaggedSavedPlanSuggestionByUrl: Map<string, SavedPlanIntentSuggestion>
  topSuggestedUntaggedSavedPlan: SavedPlan | null
  topManualUntaggedSavedPlan: SavedPlan | null
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  currentShareUrl: string | null
  onApplyVisibleSavedPlanIntentSuggestions: () => void
  onApplyVisibleSavedPlanIntentSuggestionsForIntent: (intent: SavedPlanIntent) => void
  onSetVisibleSavedPlanIntent: (intent: SavedPlanIntent | null) => void
  onSetTripBoardIntentFilter: (intent: SavedPlanIntentFilter) => void
  onOpenTopSuggestedUntaggedSavedPlan: () => void
  onCompareSuggestedUntaggedSavedPlans: () => void
  onShowAllUntaggedSavedPlans: () => void
  onOpenSavedPlan: (url: string) => void
  onSetSavedPlanIntent: (plan: SavedPlan, intent: SavedPlanIntent) => void
  onOpenTopManualUntaggedSavedPlan: () => void
  onCompareManualUntaggedSavedPlans: () => void
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
  formatSuggestionActionLabel: (intent: SavedPlanIntent, count: number) => string
}

export const TripBoardReviewQueues = ({
  visibleSavedPlans,
  visibleSavedPlanIntentSummary,
  visibleUntaggedSavedPlanSuggestionSummary,
  visibleUntaggedSavedPlanSuggestionSummaryText,
  visibleSuggestedUntaggedSavedPlanQueue,
  visibleSuggestedUntaggedSavedPlans,
  visibleManualUntaggedSavedPlanQueue,
  visibleManualUntaggedSavedPlans,
  visibleUntaggedSavedPlanSuggestionByUrl,
  topSuggestedUntaggedSavedPlan,
  topManualUntaggedSavedPlan,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  currentShareUrl,
  onApplyVisibleSavedPlanIntentSuggestions,
  onApplyVisibleSavedPlanIntentSuggestionsForIntent,
  onSetVisibleSavedPlanIntent,
  onSetTripBoardIntentFilter,
  onOpenTopSuggestedUntaggedSavedPlan,
  onCompareSuggestedUntaggedSavedPlans,
  onShowAllUntaggedSavedPlans,
  onOpenSavedPlan,
  onSetSavedPlanIntent,
  onOpenTopManualUntaggedSavedPlan,
  onCompareManualUntaggedSavedPlans,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
}: TripBoardReviewQueuesProps) => (
  <>
    <TripBoardBulkTagBar
      visibleSavedPlansCount={visibleSavedPlans.length}
      visibleSavedPlanIntentSummary={visibleSavedPlanIntentSummary}
      visibleUntaggedSavedPlanSuggestionSummary={visibleUntaggedSavedPlanSuggestionSummary}
      tripBoardIntentFilter={tripBoardIntentFilter}
      onApplyVisibleSavedPlanIntentSuggestions={onApplyVisibleSavedPlanIntentSuggestions}
      onApplyVisibleSavedPlanIntentSuggestionsForIntent={
        onApplyVisibleSavedPlanIntentSuggestionsForIntent
      }
      onSetVisibleSavedPlanIntent={onSetVisibleSavedPlanIntent}
      onSetTripBoardIntentFilter={onSetTripBoardIntentFilter}
      formatSavedPlanIntentSummary={formatSavedPlanIntentSummary}
      formatSuggestionActionLabel={formatSuggestionActionLabel}
    />
    <TripBoardSuggestedQueue
      visibleSuggestedUntaggedSavedPlanQueue={visibleSuggestedUntaggedSavedPlanQueue}
      visibleSuggestedUntaggedSavedPlans={visibleSuggestedUntaggedSavedPlans}
      visibleUntaggedSavedPlanSuggestionSummary={visibleUntaggedSavedPlanSuggestionSummary}
      visibleUntaggedSavedPlanSuggestionSummaryText={
        visibleUntaggedSavedPlanSuggestionSummaryText
      }
      visibleUntaggedSavedPlanSuggestionByUrl={visibleUntaggedSavedPlanSuggestionByUrl}
      topSuggestedUntaggedSavedPlan={topSuggestedUntaggedSavedPlan}
      tripBoardIntentFilter={tripBoardIntentFilter}
      tripBoardSuggestionFilter={tripBoardSuggestionFilter}
      currentShareUrl={currentShareUrl}
      onOpenTopSuggestedUntaggedSavedPlan={onOpenTopSuggestedUntaggedSavedPlan}
      onApplyVisibleSavedPlanIntentSuggestions={onApplyVisibleSavedPlanIntentSuggestions}
      onApplyVisibleSavedPlanIntentSuggestionsForIntent={
        onApplyVisibleSavedPlanIntentSuggestionsForIntent
      }
      onCompareSuggestedUntaggedSavedPlans={onCompareSuggestedUntaggedSavedPlans}
      onShowAllUntaggedSavedPlans={onShowAllUntaggedSavedPlans}
      onOpenSavedPlan={onOpenSavedPlan}
      onSetSavedPlanIntent={onSetSavedPlanIntent}
      getSavedPlanQualitySummary={getSavedPlanQualitySummary}
      getSavedPlanEtaSummary={getSavedPlanEtaSummary}
      formatSuggestionActionLabel={formatSuggestionActionLabel}
    />
    <TripBoardManualQueue
      visibleManualUntaggedSavedPlanQueue={visibleManualUntaggedSavedPlanQueue}
      visibleManualUntaggedSavedPlans={visibleManualUntaggedSavedPlans}
      topManualUntaggedSavedPlan={topManualUntaggedSavedPlan}
      tripBoardIntentFilter={tripBoardIntentFilter}
      tripBoardSuggestionFilter={tripBoardSuggestionFilter}
      currentShareUrl={currentShareUrl}
      onOpenTopManualUntaggedSavedPlan={onOpenTopManualUntaggedSavedPlan}
      onCompareManualUntaggedSavedPlans={onCompareManualUntaggedSavedPlans}
      onShowAllUntaggedSavedPlans={onShowAllUntaggedSavedPlans}
      onOpenSavedPlan={onOpenSavedPlan}
      onSetSavedPlanIntent={onSetSavedPlanIntent}
      getSavedPlanQualitySummary={getSavedPlanQualitySummary}
      getSavedPlanEtaSummary={getSavedPlanEtaSummary}
    />
  </>
)
