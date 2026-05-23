import { TripBoardIntentSnapshot } from './TripBoardIntentSnapshot'
import { TripBoardMetricSnapshot } from './TripBoardMetricSnapshot'
import { TripBoardStatusBar } from './TripBoardStatusBar'
import { TripBoardTopMatchPanel } from './TripBoardTopMatchPanel'
import {
  type SavedPlan,
  type SavedPlanIntent,
  type SavedPlanIntentGroup,
  type SavedPlanMetricLeader,
} from './savedPlanTypes'

interface TripBoardLeaderPanelsProps {
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

export const TripBoardLeaderPanels = ({
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
  onOpenSavedPlan,
  onToggleSavedPlanCompare,
  onCopySavedPlanLink,
  onOpenTopSavedPlan,
  onCopyTopSavedPlanLink,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
  formatSavedPlanTimestamp,
}: TripBoardLeaderPanelsProps) => {
  return (
    <>
      <TripBoardIntentSnapshot
        visibleSavedPlanIntentGroups={visibleSavedPlanIntentGroups}
        visibleSavedPlanIntentLeaders={visibleSavedPlanIntentLeaders}
        tripBoardIntentFilter={tripBoardIntentFilter}
        currentShareUrl={currentShareUrl}
        onCompareSavedPlanIntentLeaders={onCompareSavedPlanIntentLeaders}
        onCopySavedPlanIntentLeaderLinks={onCopySavedPlanIntentLeaderLinks}
        onOpenSavedPlanIntentTop={onOpenSavedPlanIntentTop}
        onCompareSavedPlanIntentTop={onCompareSavedPlanIntentTop}
        onCopySavedPlanIntentLinks={onCopySavedPlanIntentLinks}
        onSetTripBoardIntentFilter={onSetTripBoardIntentFilter}
        getSavedPlanQualitySummary={getSavedPlanQualitySummary}
        getSavedPlanEtaSummary={getSavedPlanEtaSummary}
      />
      <TripBoardStatusBar
        tripBoardStatusSummary={tripBoardStatusSummary}
        hasTripBoardSearch={hasTripBoardSearch}
        hasActiveTripBoardFilters={hasActiveTripBoardFilters}
        hiddenCollapsedSavedPlanCount={hiddenCollapsedSavedPlanCount}
        onClearTripBoardSearch={onClearTripBoardSearch}
        onResetTripBoardFilters={onResetTripBoardFilters}
        onExpandAllSavedPlanGroups={onExpandAllSavedPlanGroups}
      />
      <TripBoardMetricSnapshot
        savedPlanMetricLeaders={savedPlanMetricLeaders}
        currentShareUrl={currentShareUrl}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        onOpenSavedPlan={onOpenSavedPlan}
        onToggleSavedPlanCompare={onToggleSavedPlanCompare}
        onCopySavedPlanLink={onCopySavedPlanLink}
        getSavedPlanQualitySummary={getSavedPlanQualitySummary}
        getSavedPlanEtaSummary={getSavedPlanEtaSummary}
      />
      <TripBoardTopMatchPanel
        topVisibleSavedPlan={topVisibleSavedPlan}
        currentShareUrl={currentShareUrl}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        onOpenTopSavedPlan={onOpenTopSavedPlan}
        onToggleSavedPlanCompare={onToggleSavedPlanCompare}
        onCopyTopSavedPlanLink={onCopyTopSavedPlanLink}
        getSavedPlanQualitySummary={getSavedPlanQualitySummary}
        getSavedPlanEtaSummary={getSavedPlanEtaSummary}
        getSavedPlanSettingChips={getSavedPlanSettingChips}
        formatSavedPlanTimestamp={formatSavedPlanTimestamp}
      />
    </>
  )
}
