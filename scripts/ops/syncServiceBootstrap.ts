import { ensureSyncServiceBucket } from './syncServiceState'
import type {
  SyncBootstrapResource,
  SyncServiceStore,
} from './syncServiceTypes'

export const readSyncBootstrapState = (
  store: SyncServiceStore,
  scope: string | null | undefined,
  defaultScope: string,
  resources: SyncBootstrapResource[] = ['savedPlans', 'reports'],
) => {
  const bucket = ensureSyncServiceBucket(store, scope, defaultScope).bucket
  return {
    ...(resources.includes('savedPlans')
      ? {
          plans: bucket.savedPlans,
          savedPlansRevision: bucket.savedPlansRevision,
        }
      : {}),
    ...(resources.includes('reports')
      ? {
          reports: bucket.reports,
          reportsRevision: bucket.reportsRevision,
        }
      : {}),
  }
}
