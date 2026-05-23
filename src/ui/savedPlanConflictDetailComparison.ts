import type { SavedPlan, SavedPlanConflictDetail } from './savedPlanTypes'
import {
  formatSavedPlanConflictValue,
  getSavedPlanConflictComparableValues,
  SAVED_PLAN_CONFLICT_FIELD_LABELS,
  type SavedPlanConflictFieldKey,
} from './savedPlanConflictDetailFormatting'

export const getSavedPlanConflictDetails = (
  preferred: SavedPlan[],
  incoming: SavedPlan[],
): SavedPlanConflictDetail[] => {
  if (preferred.length === 0 || incoming.length === 0) {
    return []
  }

  const incomingByUrl = new Map(incoming.map((plan) => [plan.url, plan]))

  return preferred.flatMap((plan) => {
    const incomingPlan = incomingByUrl.get(plan.url)
    if (!incomingPlan) {
      return []
    }

    const preferredValues = getSavedPlanConflictComparableValues(plan)
    const incomingValues = getSavedPlanConflictComparableValues(incomingPlan)
    const fields = (
      Object.keys(SAVED_PLAN_CONFLICT_FIELD_LABELS) as SavedPlanConflictFieldKey[]
    ).flatMap((fieldKey) =>
      preferredValues[fieldKey] === incomingValues[fieldKey]
        ? []
        : [
            {
              label: SAVED_PLAN_CONFLICT_FIELD_LABELS[fieldKey],
              keptValue: formatSavedPlanConflictValue(
                fieldKey,
                preferredValues[fieldKey],
              ),
              sharedValue: formatSavedPlanConflictValue(
                fieldKey,
                incomingValues[fieldKey],
              ),
            },
          ],
    )

    return fields.length > 0
      ? [
          {
            url: plan.url,
            fields,
            sharedPlan: incomingPlan,
          },
        ]
      : []
  })
}

export const getSavedPlanConflictUrls = (
  preferred: SavedPlan[],
  incoming: SavedPlan[],
): string[] =>
  getSavedPlanConflictDetails(preferred, incoming).map((detail) => detail.url)
