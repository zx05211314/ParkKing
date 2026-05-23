import type {
  SavedPlan,
  SavedPlanConflictFieldDetail,
  SavedPlanIntent,
} from './savedPlanTypes'

export interface TripBoardSavedPlanCardProps {
  plan: SavedPlan
  currentShareUrl: string | null
  editingSavedPlanUrl: string | null
  savedPlanDraftTitle: string
  comparedSavedPlanUrls: string[]
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
  formatSavedPlanTimestamp: (value: string) => string
  getSavedPlanQualitySummary: (plan: SavedPlan) => string[]
  getSavedPlanEtaSummary: (plan: SavedPlan) => string[]
  getSavedPlanSettingChips: (plan: SavedPlan) => string[]
}
