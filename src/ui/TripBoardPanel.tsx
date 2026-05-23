import type { RefObject } from 'react'
import { TripBoardControlsSection } from './TripBoardControlsSection'
import { TripBoardReviewSummarySection } from './TripBoardReviewSummarySection'
import { TripBoardSavedPlanGroupsSection } from './TripBoardSavedPlanGroupsSection'
import {
  type SavedPlan,
  type SavedPlanConflictFieldDetail,
  type SavedPlanIntent,
  type SavedPlanIntentFilter,
  type SavedPlanIntentSuggestionFilter,
  type TripBoardFilters,
  type TripBoardSortMode,
} from './savedPlanTypes'
import { type UseTripBoardResult } from './useTripBoard'
import { type UseTripBoardInteractionActionsResult } from './useTripBoardInteractionActions'
import { type UseTripBoardManagementActionsResult } from './useTripBoardManagementActions'

interface TripBoardPanelProps {
  savedPlans: SavedPlan[]
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrls: string[]
  currentShareUrl: string | null
  tripBoardState: UseTripBoardResult
  tripBoardActions: UseTripBoardInteractionActionsResult
  tripBoardManagementActions: UseTripBoardManagementActionsResult
  tripBoardSortMode: TripBoardSortMode
  tripBoardSortModeLabels: Record<TripBoardSortMode, string>
  onTripBoardSortModeChange: (mode: TripBoardSortMode) => void
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardIntentFilterLabels: Record<SavedPlanIntentFilter, string>
  savedPlanIntents: SavedPlanIntent[]
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  tripBoardSuggestionFilterLabels: Record<SavedPlanIntentSuggestionFilter, string>
  tripBoardQuery: string
  onTripBoardQueryChange: (value: string) => void
  tripBoardFilterLabels: Record<keyof TripBoardFilters, string>
  tripBoardFilters: TripBoardFilters
  datasetLabelById: Map<string, string>
  collapsedSavedPlanGroups: string[]
  comparedSavedPlanUrls: string[]
  editingSavedPlanUrl: string | null
  savedPlanDraftTitle: string
  onSavedPlanDraftTitleChange: (value: string) => void
  savedPlanImportRef: RefObject<HTMLInputElement | null>
  formatSavedPlanTimestamp: (value: string) => string
  formatSavedPlanIntentSummary: (
    counts: Record<SavedPlanIntent, number>,
    unassigned: number,
  ) => string
  formatSuggestionActionLabel: (intent: SavedPlanIntent, count: number) => string
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  getSavedPlanSettingChips: (plan: SavedPlan) => string[]
}

export const TripBoardPanel = ({
  savedPlans,
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  currentShareUrl,
  tripBoardState,
  tripBoardActions,
  tripBoardManagementActions,
  tripBoardSortMode,
  tripBoardSortModeLabels,
  onTripBoardSortModeChange,
  tripBoardIntentFilter,
  tripBoardIntentFilterLabels,
  savedPlanIntents,
  tripBoardSuggestionFilter,
  tripBoardSuggestionFilterLabels,
  tripBoardQuery,
  onTripBoardQueryChange,
  tripBoardFilterLabels,
  tripBoardFilters,
  datasetLabelById,
  collapsedSavedPlanGroups,
  comparedSavedPlanUrls,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  onSavedPlanDraftTitleChange,
  savedPlanImportRef,
  formatSavedPlanTimestamp,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
}: TripBoardPanelProps) => {
  const hasTripBoardSearch = tripBoardQuery.trim().length > 0

  return (
    <div className="control-group">
      <TripBoardControlsSection
        savedPlans={savedPlans}
        currentShareUrl={currentShareUrl}
        tripBoardState={tripBoardState}
        tripBoardActions={tripBoardActions}
        tripBoardManagementActions={tripBoardManagementActions}
        tripBoardSortMode={tripBoardSortMode}
        tripBoardSortModeLabels={tripBoardSortModeLabels}
        onTripBoardSortModeChange={onTripBoardSortModeChange}
        tripBoardIntentFilter={tripBoardIntentFilter}
        tripBoardIntentFilterLabels={tripBoardIntentFilterLabels}
        savedPlanIntents={savedPlanIntents}
        tripBoardSuggestionFilter={tripBoardSuggestionFilter}
        tripBoardSuggestionFilterLabels={tripBoardSuggestionFilterLabels}
        tripBoardQuery={tripBoardQuery}
        onTripBoardQueryChange={onTripBoardQueryChange}
        tripBoardFilterLabels={tripBoardFilterLabels}
        tripBoardFilters={tripBoardFilters}
        savedPlanImportRef={savedPlanImportRef}
        formatSavedPlanTimestamp={formatSavedPlanTimestamp}
        getSavedPlanQualitySummary={getSavedPlanQualitySummary}
        getSavedPlanEtaSummary={getSavedPlanEtaSummary}
        getSavedPlanSettingChips={getSavedPlanSettingChips}
      />
      <TripBoardReviewSummarySection
        savedPlanConflictDetailsByUrl={savedPlanConflictDetailsByUrl}
        savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
        savedPlanConflictUrls={savedPlanConflictUrls}
        currentShareUrl={currentShareUrl}
        tripBoardState={tripBoardState}
        tripBoardActions={tripBoardActions}
        tripBoardManagementActions={tripBoardManagementActions}
        tripBoardIntentFilter={tripBoardIntentFilter}
        tripBoardSuggestionFilter={tripBoardSuggestionFilter}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        hasTripBoardSearch={hasTripBoardSearch}
        formatSavedPlanTimestamp={formatSavedPlanTimestamp}
        formatSavedPlanIntentSummary={formatSavedPlanIntentSummary}
        formatSuggestionActionLabel={formatSuggestionActionLabel}
        getSavedPlanQualitySummary={getSavedPlanQualitySummary}
        getSavedPlanEtaSummary={getSavedPlanEtaSummary}
        getSavedPlanSettingChips={getSavedPlanSettingChips}
      />
      <TripBoardSavedPlanGroupsSection
        savedPlans={savedPlans}
        savedPlanConflictDetailsByUrl={savedPlanConflictDetailsByUrl}
        savedPlanConflictSharedByUrl={savedPlanConflictSharedByUrl}
        savedPlanConflictUrls={savedPlanConflictUrls}
        currentShareUrl={currentShareUrl}
        tripBoardState={tripBoardState}
        tripBoardActions={tripBoardActions}
        tripBoardManagementActions={tripBoardManagementActions}
        tripBoardQuery={tripBoardQuery}
        tripBoardIntentFilter={tripBoardIntentFilter}
        tripBoardSuggestionFilter={tripBoardSuggestionFilter}
        datasetLabelById={datasetLabelById}
        collapsedSavedPlanGroups={collapsedSavedPlanGroups}
        comparedSavedPlanUrls={comparedSavedPlanUrls}
        editingSavedPlanUrl={editingSavedPlanUrl}
        savedPlanDraftTitle={savedPlanDraftTitle}
        onSavedPlanDraftTitleChange={onSavedPlanDraftTitleChange}
        formatSavedPlanTimestamp={formatSavedPlanTimestamp}
        formatSavedPlanIntentSummary={formatSavedPlanIntentSummary}
        formatSuggestionActionLabel={formatSuggestionActionLabel}
        getSavedPlanQualitySummary={getSavedPlanQualitySummary}
        getSavedPlanEtaSummary={getSavedPlanEtaSummary}
        getSavedPlanSettingChips={getSavedPlanSettingChips}
      />
    </div>
  )
}
