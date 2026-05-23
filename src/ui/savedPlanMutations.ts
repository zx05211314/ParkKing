import { getSavedPlanConflictDetails } from './savedPlanConflictDetails'
import { normalizeSavedPlansValue } from './savedPlanNormalization'
import { getSavedPlanIntentSuggestion } from './savedPlanIntentSuggestions'
import type {
  SavedPlan,
  SavedPlanConflictMergeResult,
  SavedPlanIntent,
} from './savedPlanTypes'

export const addSavedPlanValue = (
  existing: SavedPlan[],
  next: Omit<SavedPlan, 'key'>,
  limit: number,
) => {
  const existingEntry = existing.find((entry) => entry.url === next.url)
  return normalizeSavedPlansValue(
    [
      {
        ...next,
        key: next.url,
        pinned: next.pinned ?? existingEntry?.pinned ?? false,
        intent: next.intent ?? existingEntry?.intent,
      },
      ...existing.filter((entry) => entry.url !== next.url),
    ],
    limit,
  )
}

export const mergeSavedPlansValue = (
  incoming: SavedPlan[],
  existing: SavedPlan[],
  limit: number,
) => normalizeSavedPlansValue([...incoming, ...existing], limit)

export const mergeSavedPlansWithConflictsValue = (
  preferred: SavedPlan[],
  incoming: SavedPlan[],
  limit: number,
): SavedPlanConflictMergeResult => {
  const conflictDetails = getSavedPlanConflictDetails(preferred, incoming)

  return {
    plans: normalizeSavedPlansValue([...preferred, ...incoming], limit),
    conflictedUrls: conflictDetails.map((detail) => detail.url),
    conflictDetails,
  }
}

export const updateSavedPlanValue = (
  existing: SavedPlan[],
  url: string,
  changes: Partial<
    Pick<
      SavedPlan,
      'title' | 'addressLabel' | 'segmentName' | 'targetLabel' | 'pinned'
    >
  > & {
    intent?: SavedPlanIntent | null
  },
  limit: number,
) =>
  normalizeSavedPlansValue(
    existing.map((entry) =>
      entry.url === url
        ? {
            ...entry,
            ...changes,
            title:
              typeof changes.title === 'string' && changes.title.trim().length > 0
                ? changes.title.trim()
                : entry.title,
          }
        : entry,
    ),
    limit,
  )

export const resolveSavedPlanConflictsWithSharedValue = (
  existing: SavedPlan[],
  sharedPlans: SavedPlan[],
  limit: number,
) => {
  if (sharedPlans.length === 0) {
    return normalizeSavedPlansValue(existing, limit)
  }

  const sharedPlanByUrl = new Map(sharedPlans.map((plan) => [plan.url, plan]))
  const nextPlans = existing.map((entry) => sharedPlanByUrl.get(entry.url) ?? entry)
  const missingSharedPlans = sharedPlans.filter(
    (plan) => !existing.some((entry) => entry.url === plan.url),
  )

  return normalizeSavedPlansValue([...missingSharedPlans, ...nextPlans], limit)
}

export const removeSavedPlanByUrl = (existing: SavedPlan[], url: string) =>
  existing.filter((entry) => entry.url !== url)

export const setSavedPlanIntentForUrlsValue = (
  existing: SavedPlan[],
  urls: string[],
  intent: SavedPlanIntent | null,
  limit: number,
) => {
  if (urls.length === 0) {
    return existing
  }

  const urlSet = new Set(urls)

  return normalizeSavedPlansValue(
    existing.map((entry) =>
      urlSet.has(entry.url)
        ? {
            ...entry,
            intent: intent ?? undefined,
          }
        : entry,
    ),
    limit,
  )
}

export const applySavedPlanIntentSuggestionsValue = (
  existing: SavedPlan[],
  urls: string[],
  limit: number,
) => {
  if (urls.length === 0) {
    return existing
  }

  const urlSet = new Set(urls)

  return normalizeSavedPlansValue(
    existing.map((entry) => {
      if (!urlSet.has(entry.url)) {
        return entry
      }

      const suggestion = getSavedPlanIntentSuggestion(entry)
      return suggestion
        ? {
            ...entry,
            intent: suggestion.intent,
          }
        : entry
    }),
    limit,
  )
}
