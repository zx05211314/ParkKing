import { resolveSavedPlanConflictsWithSharedValue } from './savedPlanMutations'
import {
  buildSavedPlanConflictResolutionHistoryEntry,
  restoreSavedPlanConflictResolution,
  type SavedPlanConflictResolutionHistoryEntry,
} from './savedPlanConflictResolutionHistory'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'

export const MAX_SAVED_PLAN_CONFLICT_RESOLUTION_HISTORY = 5

export interface SavedPlanConflictResolutionStateResult {
  message: string
  resolvedUrls: string[]
  resolvedPlans: SavedPlan[]
}

export const appendSavedPlanConflictResolutionHistory = (
  currentHistory: SavedPlanConflictResolutionHistoryEntry[],
  nextEntry: SavedPlanConflictResolutionHistoryEntry | null,
  maxEntries = MAX_SAVED_PLAN_CONFLICT_RESOLUTION_HISTORY,
) => {
  if (!nextEntry) {
    return currentHistory
  }
  return [nextEntry, ...currentHistory].slice(0, maxEntries)
}

export const buildSavedPlanConflictResolutionState = ({
  mode,
  savedPlanConflictSharedByUrl,
  urls,
}: {
  mode: 'single' | 'visible'
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  urls: string[]
}):
  | { kind: 'error'; message: string }
  | { kind: 'success'; value: SavedPlanConflictResolutionStateResult } => {
  const resolvedPlans = Array.from(
    new Map(
      urls.flatMap((url) => {
        const sharedPlan = savedPlanConflictSharedByUrl[url]
        return sharedPlan ? [[sharedPlan.url, sharedPlan] as const] : []
      }),
    ).values(),
  )

  if (resolvedPlans.length === 0) {
    return {
      kind: 'error',
      message:
        mode === 'single'
          ? 'Shared conflict version is unavailable for that saved plan.'
          : 'No visible conflicted saved plans have a shared version to apply.',
    }
  }

  return {
    kind: 'success',
    value: {
      message:
        mode === 'single'
          ? 'Applied the shared version for that saved plan.'
          : `Applied shared versions for ${resolvedPlans.length} visible conflicted saved plan${resolvedPlans.length === 1 ? '' : 's'}.`,
      resolvedUrls: resolvedPlans.map((plan) => plan.url),
      resolvedPlans,
    },
  }
}

export const buildSavedPlanConflictResolutionHistory = ({
  savedPlanConflictDetailsByUrl,
  savedPlanConflictSharedByUrl,
  savedPlanConflictUrls,
  savedPlans,
  urls,
}: {
  savedPlanConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  savedPlanConflictSharedByUrl: Record<string, SavedPlan>
  savedPlanConflictUrls: string[]
  savedPlans: SavedPlan[]
  urls: string[]
}) =>
  buildSavedPlanConflictResolutionHistoryEntry({
    urls,
    savedPlans,
    savedPlanConflictDetailsByUrl,
    savedPlanConflictSharedByUrl,
    savedPlanConflictUrls,
  })

export const applySavedPlanConflictResolution = ({
  currentPlans,
  resolvedPlans,
  savedPlanLimit,
}: {
  currentPlans: SavedPlan[]
  resolvedPlans: SavedPlan[]
  savedPlanLimit: number
}) => resolveSavedPlanConflictsWithSharedValue(currentPlans, resolvedPlans, savedPlanLimit)

export const buildUndoSavedPlanConflictResolutionState = ({
  currentConflictDetailsByUrl,
  currentConflictSharedByUrl,
  currentConflictUrls,
  currentPlans,
  history,
  savedPlanLimit,
}: {
  currentConflictDetailsByUrl: Record<string, SavedPlanConflictFieldDetail[]>
  currentConflictSharedByUrl: Record<string, SavedPlan>
  currentConflictUrls: string[]
  currentPlans: SavedPlan[]
  history: SavedPlanConflictResolutionHistoryEntry[]
  savedPlanLimit: number
}):
  | { kind: 'error'; message: string }
  | {
      kind: 'success'
      message: string
      restoredState: ReturnType<typeof restoreSavedPlanConflictResolution>
    } => {
  const latestResolution = history[0]
  if (!latestResolution) {
    return {
      kind: 'error',
      message: 'No shared conflict resolution to undo.',
    }
  }

  return {
    kind: 'success',
    message: 'Reverted the last shared conflict resolution.',
    restoredState: restoreSavedPlanConflictResolution({
      currentPlans,
      currentConflictDetailsByUrl,
      currentConflictSharedByUrl,
      currentConflictUrls,
      entry: latestResolution,
      savedPlanLimit,
    }),
  }
}
