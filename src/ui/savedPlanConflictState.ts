import type {
  SavedPlan,
  SavedPlanConflictDetail,
  SavedPlanConflictFieldDetail,
} from './savedPlanTypes'

interface ApplySavedPlanConflictStateOptions {
  conflictedUrls: string[]
  conflictDetails: SavedPlanConflictDetail[]
  mergeSavedPlanConflictUrls: (urls: string[]) => void
  mergeSavedPlanConflictDetails: (details: SavedPlanConflictDetail[]) => void
  mergeSavedPlanConflictSharedPlans: (details: SavedPlanConflictDetail[]) => void
}

export const applySavedPlanConflictState = ({
  conflictedUrls,
  conflictDetails,
  mergeSavedPlanConflictUrls,
  mergeSavedPlanConflictDetails,
  mergeSavedPlanConflictSharedPlans,
}: ApplySavedPlanConflictStateOptions) => {
  if (conflictedUrls.length === 0) {
    return
  }

  mergeSavedPlanConflictUrls(conflictedUrls)
  mergeSavedPlanConflictDetails(conflictDetails)
  mergeSavedPlanConflictSharedPlans(conflictDetails)
}

export const mergeSavedPlanConflictUrlsValue = (
  current: string[],
  incoming: string[],
) => {
  if (incoming.length === 0) {
    return current
  }

  return Array.from(new Set([...current, ...incoming]))
}

export const mergeSavedPlanConflictDetailsByUrlValue = (
  current: Record<string, SavedPlanConflictFieldDetail[]>,
  incoming: SavedPlanConflictDetail[],
) => {
  if (incoming.length === 0) {
    return current
  }

  const next = { ...current }
  incoming.forEach((detail) => {
    next[detail.url] = detail.fields
  })
  return next
}

export const mergeSavedPlanConflictSharedPlansByUrlValue = (
  current: Record<string, SavedPlan>,
  incoming: SavedPlanConflictDetail[],
) => {
  if (incoming.length === 0) {
    return current
  }

  const next = { ...current }
  incoming.forEach((detail) => {
    next[detail.url] = detail.sharedPlan
  })
  return next
}

export const clearSavedPlanConflictRecordUrls = <T>(
  current: Record<string, T>,
  urls: string[],
) => {
  if (urls.length === 0) {
    return current
  }

  const urlSet = new Set(urls)
  return Object.fromEntries(
    Object.entries(current).filter(([url]) => !urlSet.has(url)),
  )
}

export const clearSavedPlanConflictUrlList = (current: string[], urls: string[]) => {
  if (urls.length === 0) {
    return current
  }

  const urlSet = new Set(urls)
  return current.filter((url) => !urlSet.has(url))
}
