import type {
  SavedPlan,
  SavedPlanGroup,
  SavedPlanIntent,
  SavedPlanIntentGroup,
  SavedPlanIntentSummary,
  SavedPlanSummary,
} from './savedPlanTypes'

const SAVED_PLAN_INTENT_ORDER: SavedPlanIntent[] = ['COMMUTE', 'PICKUP', 'BACKUP']

export const summarizeSavedPlans = (plans: SavedPlan[]): SavedPlanSummary => ({
  totalCount: plans.length,
  pinnedCount: plans.filter((plan) => plan.pinned).length,
  parkReadyCount: plans.filter((plan) => plan.allowedAction === 'PARK').length,
  etaReadyCount: plans.filter(
    (plan) =>
      typeof plan.walkingDurationSeconds === 'number' ||
      typeof plan.drivingDurationSeconds === 'number',
  ).length,
  markedSpaceCount: plans.filter((plan) => (plan.parkingSpaceCount ?? 0) > 0).length,
})

export const summarizeSavedPlanIntents = (
  plans: SavedPlan[],
): SavedPlanIntentSummary => {
  const summary: SavedPlanIntentSummary = {
    COMMUTE: 0,
    PICKUP: 0,
    BACKUP: 0,
    taggedCount: 0,
    unassignedCount: 0,
  }

  plans.forEach((plan) => {
    if (plan.intent) {
      summary[plan.intent] += 1
      summary.taggedCount += 1
      return
    }
    summary.unassignedCount += 1
  })

  return summary
}

export const groupSavedPlansByIntent = (
  plans: SavedPlan[],
): SavedPlanIntentGroup[] => {
  const grouped = new Map<SavedPlanIntent, SavedPlan[]>()

  plans.forEach((plan) => {
    if (!plan.intent) {
      return
    }
    const existing = grouped.get(plan.intent)
    if (existing) {
      existing.push(plan)
      return
    }
    grouped.set(plan.intent, [plan])
  })

  return SAVED_PLAN_INTENT_ORDER.flatMap((intent) => {
    const intentPlans = grouped.get(intent)
    const leader = intentPlans?.[0]
    return intentPlans && leader
      ? [
          {
            intent,
            plans: intentPlans,
            count: intentPlans.length,
            leader,
          },
        ]
      : []
  })
}

export const groupSavedPlansByDataset = (
  plans: SavedPlan[],
): SavedPlanGroup[] => {
  const groups = new Map<string | null, SavedPlan[]>()

  plans.forEach((plan) => {
    const key = plan.datasetId ?? null
    const existing = groups.get(key)
    if (existing) {
      existing.push(plan)
      return
    }
    groups.set(key, [plan])
  })

  return Array.from(groups.entries()).map(([key, groupedPlans]) => ({
    key,
    plans: groupedPlans,
    count: groupedPlans.length,
    pinnedCount: groupedPlans.filter((plan) => plan.pinned).length,
  }))
}
