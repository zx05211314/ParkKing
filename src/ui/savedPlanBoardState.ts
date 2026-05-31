import type { SavedPlan, TripBoardFilters } from './savedPlanTypes'

const SAVED_PLAN_UNASSIGNED_GROUP_KEY = '__unassigned__'

export const getSavedPlanGroupStorageKey = (groupKey: string | null) =>
  groupKey ?? SAVED_PLAN_UNASSIGNED_GROUP_KEY

export const normalizeSavedPlanCollapsedGroups = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0),
    ),
  )
}

export const toggleSavedPlanCollapsedGroup = (
  collapsedGroupKeys: string[],
  groupKey: string | null,
) => {
  const storageKey = getSavedPlanGroupStorageKey(groupKey)
  return collapsedGroupKeys.includes(storageKey)
    ? collapsedGroupKeys.filter((entry) => entry !== storageKey)
    : [...collapsedGroupKeys, storageKey]
}

export const hasTripBoardFilters = (filters: TripBoardFilters) =>
  filters.pinnedOnly ||
  filters.parkOnly ||
  filters.markedSpacesOnly ||
  filters.etaReadyOnly ||
  filters.conflictedOnly === true

export const getTopSavedPlan = (plans: SavedPlan[]) => plans[0] ?? null

export const selectSavedPlansForCompare = (
  plans: SavedPlan[],
  currentComparedUrls: string[],
  limit = 2,
) => {
  if (limit <= 0) {
    return []
  }

  const visibleUrls = new Set(plans.map((plan) => plan.url))
  const selected: string[] = []

  currentComparedUrls.forEach((url) => {
    if (selected.length >= limit || selected.includes(url) || !visibleUrls.has(url)) {
      return
    }
    selected.push(url)
  })

  plans.forEach((plan) => {
    if (selected.length >= limit || selected.includes(plan.url)) {
      return
    }
    selected.push(plan.url)
  })

  return selected
}
