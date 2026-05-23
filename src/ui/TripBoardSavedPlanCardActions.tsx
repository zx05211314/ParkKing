import { SAVED_PLAN_INTENT_LABELS, SAVED_PLAN_INTENTS } from './savedPlanTypes'
import type { TripBoardSavedPlanCardProps } from './tripBoardSavedPlanCardTypes'

interface TripBoardSavedPlanCardActionsProps
  extends Pick<
    TripBoardSavedPlanCardProps,
    | 'editingSavedPlanUrl'
    | 'comparedSavedPlanUrls'
    | 'savedPlanConflictSharedByUrl'
    | 'onOpenSavedPlan'
    | 'onToggleSavedPlanCompare'
    | 'onStartSavedPlanRename'
    | 'onSetSavedPlanIntent'
    | 'onToggleSavedPlanPinned'
    | 'onResolveSavedPlanConflictWithShared'
    | 'onClearSavedPlanConflict'
    | 'onCopySavedPlanLink'
    | 'onRemoveSavedPlan'
  > {
  plan: TripBoardSavedPlanCardProps['plan']
  hasConflict: boolean
}

export const TripBoardSavedPlanCardActions = ({
  plan,
  editingSavedPlanUrl,
  comparedSavedPlanUrls,
  savedPlanConflictSharedByUrl,
  onOpenSavedPlan,
  onToggleSavedPlanCompare,
  onStartSavedPlanRename,
  onSetSavedPlanIntent,
  onToggleSavedPlanPinned,
  onResolveSavedPlanConflictWithShared,
  onClearSavedPlanConflict,
  onCopySavedPlanLink,
  onRemoveSavedPlan,
  hasConflict,
}: TripBoardSavedPlanCardActionsProps) => {
  const isEditingTitle = editingSavedPlanUrl === plan.url
  const isCompared = comparedSavedPlanUrls.includes(plan.url)

  return (
    <div className="saved-plan-actions">
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onOpenSavedPlan(plan.url)}
      >
        Open
      </button>
      <button
        type="button"
        className={
          isCompared
            ? 'address-recommendations-action active'
            : 'address-recommendations-action'
        }
        onClick={() => onToggleSavedPlanCompare(plan.url)}
      >
        {isCompared ? 'Comparing' : 'Compare'}
      </button>
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onStartSavedPlanRename(plan)}
        disabled={isEditingTitle}
      >
        Rename
      </button>
      {SAVED_PLAN_INTENTS.map((intent) => (
        <button
          key={`saved-plan-intent:${plan.url}:${intent}`}
          type="button"
          className={
            plan.intent === intent
              ? 'address-recommendations-action active'
              : 'address-recommendations-action'
          }
          onClick={() => onSetSavedPlanIntent(plan, intent)}
        >
          {SAVED_PLAN_INTENT_LABELS[intent]}
        </button>
      ))}
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onToggleSavedPlanPinned(plan)}
      >
        {plan.pinned ? 'Unpin' : 'Pin'}
      </button>
      {hasConflict ? (
        <button
          type="button"
          className="address-recommendations-action"
          onClick={() => onResolveSavedPlanConflictWithShared(plan.url)}
          disabled={!savedPlanConflictSharedByUrl[plan.url]}
        >
          Use shared
        </button>
      ) : null}
      {hasConflict ? (
        <button
          type="button"
          className="address-recommendations-action"
          onClick={() => onClearSavedPlanConflict(plan.url)}
        >
          Keep local
        </button>
      ) : null}
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => void onCopySavedPlanLink(plan.url)}
      >
        Copy link
      </button>
      <button
        type="button"
        className="address-recommendations-action"
        onClick={() => onRemoveSavedPlan(plan.url)}
      >
        Remove
      </button>
    </div>
  )
}
