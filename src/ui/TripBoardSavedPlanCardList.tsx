import { TripBoardSavedPlanCard } from './TripBoardSavedPlanCard'
import type { SavedPlan } from './savedPlanTypes'
import type { TripBoardSavedPlanCardProps } from './tripBoardSavedPlanCardTypes'

interface TripBoardSavedPlanCardListProps extends Omit<TripBoardSavedPlanCardProps, 'plan'> {
  plans: SavedPlan[]
}

export const TripBoardSavedPlanCardList = ({
  plans,
  ...cardProps
}: TripBoardSavedPlanCardListProps) => (
  <div className="saved-plan-list">
    {plans.map((plan) => (
      <TripBoardSavedPlanCard key={plan.key} plan={plan} {...cardProps} />
    ))}
  </div>
)
