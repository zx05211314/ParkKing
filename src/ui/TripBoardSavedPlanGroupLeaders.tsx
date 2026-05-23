import type { SavedPlanMetricLeader } from './savedPlanTypes'

interface TripBoardSavedPlanGroupLeadersProps {
  leaders: SavedPlanMetricLeader[]
  onOpenSavedPlan: (url: string) => void
}

export const TripBoardSavedPlanGroupLeaders = ({
  leaders,
  onOpenSavedPlan,
}: TripBoardSavedPlanGroupLeadersProps) => {
  if (leaders.length === 0) {
    return null
  }

  return (
    <div className="saved-plan-group-leaders">
      {leaders.map((leader) => (
        <button
          key={`saved-plan-group-leader:${leader.key}:${leader.plan.url}`}
          type="button"
          className="saved-plan-group-leader"
          onClick={() => onOpenSavedPlan(leader.plan.url)}
        >
          {leader.label}: {leader.plan.title}
        </button>
      ))}
    </div>
  )
}
