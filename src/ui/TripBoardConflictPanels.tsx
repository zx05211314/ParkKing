import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import { TripBoardConflictReviewQueue } from './TripBoardConflictReviewQueue'
import { TripBoardConflictStatusBar } from './TripBoardConflictStatusBar'

interface TripBoardConflictPanelsProps {
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrls: string[]
  savedPlanConflictResolutionHistoryCount: number
  visibleConflictedSavedPlans: SavedPlan[]
  visibleSavedPlanUrls: string[]
  hasTripBoardSearch: boolean
  hasActiveTripBoardFilters: boolean
  hiddenCollapsedSavedPlanCount: number
  comparedSavedPlanUrls: string[]
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
}

export const TripBoardConflictPanels = ({
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  savedPlanConflictResolutionHistoryCount,
  visibleConflictedSavedPlans,
  visibleSavedPlanUrls,
  hasTripBoardSearch,
  hasActiveTripBoardFilters,
  hiddenCollapsedSavedPlanCount,
  comparedSavedPlanUrls,
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
}: TripBoardConflictPanelsProps) => {
  if (savedPlanConflictUrls.length === 0 && visibleConflictedSavedPlans.length === 0) {
    return null
  }

  const visibleSavedPlanConflictCount = visibleSavedPlanUrls.filter((url) =>
    savedPlanConflictUrls.includes(url),
  ).length
  const visibleConflictFieldSummary = Array.from(
    visibleSavedPlanUrls.reduce((counts, url) => {
      const fields = savedPlanConflictDetailsByUrl[url] ?? []
      fields.forEach((field) => {
        counts.set(field.label, (counts.get(field.label) ?? 0) + 1)
      })
      return counts
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([field, count]) => `${field}${count > 1 ? ` (${count})` : ''}`)
    .join(', ')

  return (
    <>
      <TripBoardConflictStatusBar
        savedPlanConflictUrls={savedPlanConflictUrls}
        visibleSavedPlanConflictCount={visibleSavedPlanConflictCount}
        visibleConflictFieldSummary={visibleConflictFieldSummary}
        hasTripBoardSearch={hasTripBoardSearch}
        hasActiveTripBoardFilters={hasActiveTripBoardFilters}
        hiddenCollapsedSavedPlanCount={hiddenCollapsedSavedPlanCount}
        savedPlanConflictResolutionHistoryCount={savedPlanConflictResolutionHistoryCount}
        visibleConflictedSavedPlansCount={visibleConflictedSavedPlans.length}
        onClearTripBoardSearch={onClearTripBoardSearch}
        onResetTripBoardFilters={onResetTripBoardFilters}
        onExpandAllSavedPlanGroups={onExpandAllSavedPlanGroups}
        onClearAllSavedPlanConflicts={onClearAllSavedPlanConflicts}
        onUndoSavedPlanConflictResolution={onUndoSavedPlanConflictResolution}
        onKeepVisibleSavedPlanConflictsLocal={onKeepVisibleSavedPlanConflictsLocal}
        onResolveVisibleSavedPlanConflictsWithShared={onResolveVisibleSavedPlanConflictsWithShared}
        onCompareConflictedSavedPlans={onCompareConflictedSavedPlans}
      />
      <TripBoardConflictReviewQueue
        visibleConflictedSavedPlans={visibleConflictedSavedPlans}
        savedPlanConflictDetailsByUrl={savedPlanConflictDetailsByUrl}
        savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        visibleSavedPlanConflictCount={visibleSavedPlanConflictCount}
        onCompareConflictedSavedPlans={onCompareConflictedSavedPlans}
        onOpenSavedPlan={onOpenSavedPlan}
        onToggleSavedPlanCompare={onToggleSavedPlanCompare}
        onResolveSavedPlanConflictWithShared={onResolveSavedPlanConflictWithShared}
        onClearSavedPlanConflict={onClearSavedPlanConflict}
      />
    </>
  )
}
