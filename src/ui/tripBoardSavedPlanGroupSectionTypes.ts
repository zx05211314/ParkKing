import type {
  SavedPlan,
  SavedPlanConflictFieldDetail,
  SavedPlanGroup,
  SavedPlanIntent,
} from './savedPlanTypes'

export interface TripBoardSavedPlanGroupSectionProps {
  group: SavedPlanGroup
  datasetLabelById: Map<string, string>
  collapsedSavedPlanGroups: string[]
  comparedSavedPlanUrls: string[]
  currentShareUrl: string | null
  editingSavedPlanUrl: string | null
  savedPlanDraftTitle: string
  savedPlanMetricLeaderBadges: Map<string, string[]>
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrlSet: ReadonlySet<string>
  onSavedPlanDraftTitleChange: (value: string) => void
  onCommitSavedPlanRename: (url: string) => void
  onCancelSavedPlanRename: () => void
  onOpenSavedPlan: (url: string) => void
  onToggleSavedPlanCompare: (url: string) => void
  onStartSavedPlanRename: (plan: SavedPlan) => void
  onSetSavedPlanIntent: (plan: SavedPlan, intent: SavedPlanIntent) => void
  onToggleSavedPlanPinned: (plan: SavedPlan) => void
  onResolveSavedPlanConflictWithShared: (url: string) => void
  onClearSavedPlanConflict: (url: string) => void
  onCopySavedPlanLink: (url: string) => void | Promise<void>
  onRemoveSavedPlan: (url: string) => void
  onOpenSavedPlanGroupTop: (plans: SavedPlan[]) => void
  onCompareSavedPlanGroupTop: (plans: SavedPlan[]) => void
  onCompareSavedPlanGroupLeaders: (plans: SavedPlan[]) => void
  onPinSavedPlanGroupTop: (plans: SavedPlan[]) => void
  onToggleSavedPlanGroupCollapsed: (groupKey: string | null) => void
  onCopySavedPlanGroupLinks: (plans: SavedPlan[]) => void | Promise<void>
  onApplySavedPlanGroupIntentSuggestions: (plans: SavedPlan[], groupLabel: string) => void
  onApplySavedPlanGroupIntentSuggestionsForIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent,
  ) => void
  onSetSavedPlanGroupIntent: (
    plans: SavedPlan[],
    groupLabel: string,
    intent: SavedPlanIntent | null,
  ) => void
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
