import { ensureSyncServiceBucket } from './syncServiceState'
import type { SyncServiceStore } from './syncServiceTypes'

export const readSyncSavedPlansState = (
  store: SyncServiceStore,
  scope: string | null | undefined,
  defaultScope: string,
) => {
  const bucket = ensureSyncServiceBucket(store, scope, defaultScope).bucket
  return {
    plans: bucket.savedPlans,
    revision: bucket.savedPlansRevision,
  }
}

export const replaceSyncSavedPlans = (params: {
  store: SyncServiceStore
  scope: string | null | undefined
  defaultScope: string
  plans: unknown
  expectedRevision?: number | null
  updatedAt: string
}) => {
  const { store, scope, defaultScope, plans, expectedRevision, updatedAt } = params
  if (!Array.isArray(plans)) {
    throw new Error('Saved-plan payload must include a plans array.')
  }

  const bucket = ensureSyncServiceBucket(store, scope, defaultScope).bucket
  if (JSON.stringify(bucket.savedPlans) === JSON.stringify(plans)) {
    return {
      changed: false,
      result: {
        conflict: false as const,
        plans: bucket.savedPlans,
        revision: bucket.savedPlansRevision,
      },
    }
  }
  if (
    typeof expectedRevision === 'number' &&
    Number.isFinite(expectedRevision) &&
    Math.floor(expectedRevision) !== bucket.savedPlansRevision
  ) {
    return {
      changed: false,
      result: {
        conflict: true as const,
        plans: bucket.savedPlans,
        revision: bucket.savedPlansRevision,
      },
    }
  }

  bucket.savedPlans = plans
  bucket.savedPlansRevision += 1
  bucket.savedPlansUpdatedAt = updatedAt
  return {
    changed: true,
    result: {
      conflict: false as const,
      plans: bucket.savedPlans,
      revision: bucket.savedPlansRevision,
    },
  }
}
