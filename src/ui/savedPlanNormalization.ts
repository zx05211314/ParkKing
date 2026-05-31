import type { SavedPlan, TripBoardFilters } from './savedPlanTypes'
import { normalizeSavedPlanValue } from './savedPlanEntryNormalization'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

export const normalizeSavedPlansValue = (
  value: unknown,
  limit: number,
): SavedPlan[] => {
  if (!Array.isArray(value) || limit <= 0) {
    return []
  }

  const seen = new Set<string>()

  return value
    .flatMap((entry) => {
      const normalized = normalizeSavedPlanValue(entry)
      if (!normalized || seen.has(normalized.url)) {
        return []
      }
      seen.add(normalized.url)
      return [normalized]
    })
    .slice(0, limit)
}

export const normalizeTripBoardFiltersValue = (
  value: unknown,
  fallback: TripBoardFilters,
): TripBoardFilters => {
  if (!isRecord(value)) {
    return fallback
  }
  return {
    pinnedOnly: value.pinnedOnly === true,
    parkOnly: value.parkOnly === true,
    markedSpacesOnly: value.markedSpacesOnly === true,
    etaReadyOnly: value.etaReadyOnly === true,
    conflictedOnly: value.conflictedOnly === true,
  }
}
