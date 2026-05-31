import {
  type SavedPlan,
  type SavedPlanConflictFieldDetail,
  type SavedPlanIntent,
  type SavedPlanIntentGroup,
  type SavedPlanMetricLeader,
} from './savedPlanTypes'
import { TripBoardConflictPanels } from './TripBoardConflictPanels'
import { TripBoardLeaderPanels } from './TripBoardLeaderPanels'

interface TripBoardSummaryPanelsProps {
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrls: string[]
  savedPlanConflictResolutionHistoryCount: number
  visibleConflictedSavedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
  visibleSavedPlanIntentGroups: SavedPlanIntentGroup[]
  visibleSavedPlanIntentLeaders: SavedPlan[]
  tripBoardIntentFilter: SavedPlanIntent | 'ALL' | 'UNTAGGED'
  tripBoardStatusSummary: string | null
  hasTripBoardSearch: boolean
  hasActiveTripBoardFilters: boolean
  hiddenCollapsedSavedPlanCount: number
  savedPlanMetricLeaders: SavedPlanMetricLeader[]
  topVisibleSavedPlan: SavedPlan | null
  currentShareUrl: string | null
  comparedSavedPlanUrls: string[]
  onCompareSavedPlanIntentLeaders: () => void
  onCopySavedPlanIntentLeaderLinks: () => void | Promise<void>
  onOpenSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  onCompareSavedPlanIntentTop: (intent: SavedPlanIntent, plans: SavedPlan[]) => void
  onCopySavedPlanIntentLinks: (
    intent: SavedPlanIntent,
    plans: SavedPlan[],
  ) => void | Promise<void>
  onSetTripBoardIntentFilter: (intent: SavedPlanIntent | 'ALL' | 'UNTAGGED') => void
  onClearTripBoardSearch: () => void
  onResetTripBoardFilters: () => void
  onExpandAllSavedPlanGroups: () => void
  onClearAllSavedPlanConflicts: () => void
  onUndoSavedPlanConflictResolution: () => void
  onKeepVisibleSavedPlanConflictsLocal: () => void
  onResolveVisibleSavedPlanConflictsWithShared: () => void
  onResolveSavedPlanConflictWithShared: (url: string) => void
  onClearSavedPlanConflict: (url: string) => void
  onCompareConflictedSavedPlans: () => void
  onOpenSavedPlan: (url: string) => void
  onToggleSavedPlanCompare: (url: string) => void
  onCopySavedPlanLink: (url: string) => void | Promise<void>
  onOpenTopSavedPlan: () => void
  onCopyTopSavedPlanLink: () => void | Promise<void>
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  getSavedPlanSettingChips: (plan: SavedPlan) => string[]
  formatSavedPlanTimestamp: (value: string) => string
}

export const TripBoardSummaryPanels = ({
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  savedPlanConflictResolutionHistoryCount,
  visibleConflictedSavedPlans,
  visibleSavedPlanUrls,
  visibleSavedPlanIntentGroups,
  visibleSavedPlanIntentLeaders,
  tripBoardIntentFilter,
  tripBoardStatusSummary,
  hasTripBoardSearch,
  hasActiveTripBoardFilters,
  hiddenCollapsedSavedPlanCount,
  savedPlanMetricLeaders,
  topVisibleSavedPlan,
  currentShareUrl,
  comparedSavedPlanUrls,
  onCompareSavedPlanIntentLeaders,
  onCopySavedPlanIntentLeaderLinks,
  onOpenSavedPlanIntentTop,
  onCompareSavedPlanIntentTop,
  onCopySavedPlanIntentLinks,
  onSetTripBoardIntentFilter,
  onClearTripBoardSearch,
  onResetTripBoardFilters,
  onExpandAllSavedPlanGroups,
  onClearAllSavedPlanConflicts,
  onUndoSavedPlanConflictResolution,
  onKeepVisibleSavedPlanConflictsLocal,
  onResolveVisibleSavedPlanConflictsWithShared,
  onResolveSavedPlanConflictWithShared,
  onClearSavedPlanConflict,
  onCompareConflictedSavedPlans,
  onOpenSavedPlan,
  onToggleSavedPlanCompare,
  onCopySavedPlanLink,
  onOpenTopSavedPlan,
  onCopyTopSavedPlanLink,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
  formatSavedPlanTimestamp,
}: TripBoardSummaryPanelsProps) => {
  return (
    <>
      <TripBoardConflictPanels
        savedPlanConflictDetailsByUrl={savedPlanConflictDetailsByUrl}
        savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
        savedPlanConflictUrls={savedPlanConflictUrls}
        savedPlanConflictResolutionHistoryCount={savedPlanConflictResolutionHistoryCount}
        visibleConflictedSavedPlans={visibleConflictedSavedPlans}
        visibleSavedPlanUrls={visibleSavedPlanUrls}
        hasTripBoardSearch={hasTripBoardSearch}
        hasActiveTripBoardFilters={hasActiveTripBoardFilters}
        hiddenCollapsedSavedPlanCount={hiddenCollapsedSavedPlanCount}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        onClearTripBoardSearch={onClearTripBoardSearch}
        onResetTripBoardFilters={onResetTripBoardFilters}
        onExpandAllSavedPlanGroups={onExpandAllSavedPlanGroups}
        onClearAllSavedPlanConflicts={onClearAllSavedPlanConflicts}
        onUndoSavedPlanConflictResolution={onUndoSavedPlanConflictResolution}
        onKeepVisibleSavedPlanConflictsLocal={onKeepVisibleSavedPlanConflictsLocal}
        onResolveVisibleSavedPlanConflictsWithShared={
          onResolveVisibleSavedPlanConflictsWithShared
        }
        onResolveSavedPlanConflictWithShared={onResolveSavedPlanConflictWithShared}
        onClearSavedPlanConflict={onClearSavedPlanConflict}
        onCompareConflictedSavedPlans={onCompareConflictedSavedPlans}
        onOpenSavedPlan={onOpenSavedPlan}
        onToggleSavedPlanCompare={onToggleSavedPlanCompare}
      />
      <TripBoardLeaderPanels
        visibleSavedPlanIntentGroups={visibleSavedPlanIntentGroups}
        visibleSavedPlanIntentLeaders={visibleSavedPlanIntentLeaders}
        tripBoardIntentFilter={tripBoardIntentFilter}
        tripBoardStatusSummary={tripBoardStatusSummary}
        hasTripBoardSearch={hasTripBoardSearch}
        hasActiveTripBoardFilters={hasActiveTripBoardFilters}
        hiddenCollapsedSavedPlanCount={hiddenCollapsedSavedPlanCount}
        savedPlanMetricLeaders={savedPlanMetricLeaders}
        topVisibleSavedPlan={topVisibleSavedPlan}
        currentShareUrl={currentShareUrl}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        onCompareSavedPlanIntentLeaders={onCompareSavedPlanIntentLeaders}
        onCopySavedPlanIntentLeaderLinks={onCopySavedPlanIntentLeaderLinks}
        onOpenSavedPlanIntentTop={onOpenSavedPlanIntentTop}
        onCompareSavedPlanIntentTop={onCompareSavedPlanIntentTop}
        onCopySavedPlanIntentLinks={onCopySavedPlanIntentLinks}
        onSetTripBoardIntentFilter={onSetTripBoardIntentFilter}
        onClearTripBoardSearch={onClearTripBoardSearch}
        onResetTripBoardFilters={onResetTripBoardFilters}
        onExpandAllSavedPlanGroups={onExpandAllSavedPlanGroups}
        onOpenSavedPlan={onOpenSavedPlan}
        onToggleSavedPlanCompare={onToggleSavedPlanCompare}
        onCopySavedPlanLink={onCopySavedPlanLink}
        onOpenTopSavedPlan={onOpenTopSavedPlan}
        onCopyTopSavedPlanLink={onCopyTopSavedPlanLink}
        getSavedPlanQualitySummary={getSavedPlanQualitySummary}
        getSavedPlanEtaSummary={getSavedPlanEtaSummary}
        getSavedPlanSettingChips={getSavedPlanSettingChips}
        formatSavedPlanTimestamp={formatSavedPlanTimestamp}
      />
    </>
  )
}
