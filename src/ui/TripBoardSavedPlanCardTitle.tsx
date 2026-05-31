import { SAVED_PLAN_INTENT_LABELS } from './savedPlanTypes'
import type { TripBoardSavedPlanCardProps } from './tripBoardSavedPlanCardTypes'

interface TripBoardSavedPlanCardTitleProps
  extends Pick<
    TripBoardSavedPlanCardProps,
    | 'currentShareUrl'
    | 'editingSavedPlanUrl'
    | 'savedPlanDraftTitle'
    | 'comparedSavedPlanUrls'
    | 'savedPlanMetricLeaderBadges'
    | 'onSavedPlanDraftTitleChange'
    | 'onCommitSavedPlanRename'
    | 'onCancelSavedPlanRename'
  > {
  plan: TripBoardSavedPlanCardProps['plan']
  hasConflict: boolean
}

export const TripBoardSavedPlanCardTitle = ({
  plan,
  currentShareUrl,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  comparedSavedPlanUrls,
  savedPlanMetricLeaderBadges,
  onSavedPlanDraftTitleChange,
  onCommitSavedPlanRename,
  onCancelSavedPlanRename,
  hasConflict,
}: TripBoardSavedPlanCardTitleProps) => {
  const isEditingTitle = editingSavedPlanUrl === plan.url
  const isCompared = comparedSavedPlanUrls.includes(plan.url)

  if (isEditingTitle) {
    return (
      <form
        className="saved-plan-title-form"
        onSubmit={(event) => {
          event.preventDefault()
          onCommitSavedPlanRename(plan.url)
        }}
      >
        <div className="control-input saved-plan-title-input">
          <input
            type="text"
            value={savedPlanDraftTitle}
            maxLength={80}
            onChange={(event) => onSavedPlanDraftTitleChange(event.target.value)}
            aria-label="Saved plan title"
          />
        </div>
        <div className="saved-plan-inline-actions">
          <button type="submit" className="address-recommendations-action">
            Save
          </button>
          <button
            type="button"
            className="address-recommendations-action"
            onClick={onCancelSavedPlanRename}
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="saved-plan-title">
      {plan.title}
      {plan.intent ? (
        <span className="search-result-badge intent">
          {SAVED_PLAN_INTENT_LABELS[plan.intent]}
        </span>
      ) : null}
      {plan.pinned ? <span className="search-result-badge favorite">Pinned</span> : null}
      {isCompared ? <span className="search-result-badge recent">Compare</span> : null}
      {hasConflict ? <span className="search-result-badge recent">Merged conflict</span> : null}
      {currentShareUrl === plan.url ? (
        <span className="search-result-badge pinned">Current</span>
      ) : null}
      {(savedPlanMetricLeaderBadges.get(plan.url) ?? []).map((badge) => (
        <span
          key={`saved-plan-leader-badge:${plan.url}:${badge}`}
          className="search-result-badge favorite"
        >
          {badge}
        </span>
      ))}
    </div>
  )
}
