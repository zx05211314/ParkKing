import { clearSavedPlanConflictRecordUrls, clearSavedPlanConflictUrlList } from './savedPlanConflictState'
import { normalizeSavedPlansValue } from './savedPlanNormalization'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'

export interface SavedPlanConflictResolutionHistoryEntry {
  resolvedUrls: string[]
  previousPlansByUrl: Record<string, SavedPlan>
  previousConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  previousConflictSharedByUrl: Record<string, SavedPlan>
  previousConflictUrls: string[]
}

interface BuildSavedPlanConflictResolutionHistoryEntryOptions {
  urls: string[]
  savedPlans: SavedPlan[]
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrls: string[]
}

interface RestoreSavedPlanConflictResolutionOptions {
  currentPlans: SavedPlan[]
  currentConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  currentConflictSharedByUrl: Record<string, SavedPlan>
  currentConflictUrls: string[]
  entry: SavedPlanConflictResolutionHistoryEntry
  savedPlanLimit: number
}

export const buildSavedPlanConflictResolutionHistoryEntry = ({
  urls,
  savedPlans,
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
}: BuildSavedPlanConflictResolutionHistoryEntryOptions): SavedPlanConflictResolutionHistoryEntry | null => {
  const resolvedUrls = Array.from(new Set(urls))
  if (resolvedUrls.length === 0) {
    return null
  }

  const resolvedUrlSet = new Set(resolvedUrls)
  const previousPlansByUrl = Object.fromEntries(
    savedPlans
      .filter((plan) => resolvedUrlSet.has(plan.url))
      .map((plan) => [plan.url, plan]),
  )
  const previousConflictDetailsByUrl = Object.fromEntries(
    resolvedUrls.flatMap((url) =>
      savedPlanConflictDetailsByUrl[url] ? [[url, savedPlanConflictDetailsByUrl[url]]] : [],
    ),
  )
  const previousConflictSharedByUrl = Object.fromEntries(
    resolvedUrls.flatMap((url) =>
      savedPlanConflictSharedByUrl[url] ? [[url, savedPlanConflictSharedByUrl[url]]] : [],
    ),
  )
  const previousConflictUrls = savedPlanConflictUrls.filter((url) =>
    resolvedUrlSet.has(url),
  )

  return {
    resolvedUrls,
    previousPlansByUrl,
    previousConflictDetailsByUrl,
    previousConflictSharedByUrl,
    previousConflictUrls,
  }
}

export const restoreSavedPlanConflictResolution = ({
  currentPlans,
  currentConflictDetailsByUrl,
  currentConflictSharedByUrl,
  currentConflictUrls,
  entry,
  savedPlanLimit,
}: RestoreSavedPlanConflictResolutionOptions) => {
  const resolvedUrlSet = new Set(entry.resolvedUrls)

  const restoredPlans = currentPlans.flatMap((plan) => {
    if (!resolvedUrlSet.has(plan.url)) {
      return [plan]
    }

    const previousPlan = entry.previousPlansByUrl[plan.url]
    return previousPlan ? [previousPlan] : []
  })
  const restoredPlanUrls = new Set(restoredPlans.map((plan) => plan.url))
  const missingPreviousPlans = Object.values(entry.previousPlansByUrl).filter(
    (plan) => !restoredPlanUrls.has(plan.url),
  )

  return {
    plans: normalizeSavedPlansValue(
      [...missingPreviousPlans, ...restoredPlans],
      savedPlanLimit,
    ),
    conflictDetailsByUrl: {
      ...clearSavedPlanConflictRecordUrls(
        currentConflictDetailsByUrl,
        entry.resolvedUrls,
      ),
      ...entry.previousConflictDetailsByUrl,
    },
    conflictSharedByUrl: {
      ...clearSavedPlanConflictRecordUrls(
        currentConflictSharedByUrl,
        entry.resolvedUrls,
      ),
      ...entry.previousConflictSharedByUrl,
    },
    conflictUrls: Array.from(
      new Set([
        ...clearSavedPlanConflictUrlList(currentConflictUrls, entry.resolvedUrls),
        ...entry.previousConflictUrls,
      ]),
    ),
  }
}
