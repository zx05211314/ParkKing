import type { SavedPlan } from './savedPlanTypes'

export const compareComparisonValue = (
  value: string | null | undefined,
  fallback = '-',
) => value ?? fallback

export const formatSavedPlanComparisonDuration = (
  value: number | undefined,
  estimated: boolean | undefined,
  fallback = '-',
) => {
  if (value === undefined) {
    return fallback
  }
  const roundedMinutes = Math.max(1, Math.round(value / 60))
  return `${estimated ? '~' : ''}${roundedMinutes} min`
}

export const describeSavedPlanParkingQuality = (plan: SavedPlan) => {
  const parts: string[] = []
  if (plan.allowedAction) {
    parts.push(plan.allowedAction === 'TEMP_STOP' ? 'STOP OK' : plan.allowedAction)
  }
  if (typeof plan.parkingSpaceCount === 'number') {
    parts.push(`${plan.parkingSpaceCount} space${plan.parkingSpaceCount === 1 ? '' : 's'}`)
  }
  if (plan.tier) {
    parts.push(plan.tier)
  }
  return parts.length > 0 ? parts.join(' • ') : 'no parking-quality data'
}
