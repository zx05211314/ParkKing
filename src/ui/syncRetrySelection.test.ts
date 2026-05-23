import { describe, expect, it } from 'vitest'
import type { SyncRuntimeStatusSnapshot } from '../api/syncRuntimeStatus'
import {
  listDueRetryResources,
  listPendingRetryResources,
  resolveRetrySyncResources,
} from './syncRetrySelection'

const createRuntimeSnapshot = (): SyncRuntimeStatusSnapshot => ({
  savedPlans: {
    mode: 'syncing',
    message: '',
    updatedAt: null,
    lastFailureReason: null,
    lastFailureAt: null,
    lastRecoveredAt: null,
    lastRemoteAt: null,
    lastPushAt: null,
    lastRetryAt: null,
    lastRetrySource: null,
    retryAttemptCount: 0,
    nextRetryAt: null,
    pendingCount: 0,
    lastRemoteCount: null,
    lastPushCount: null,
  },
  reports: {
    mode: 'syncing',
    message: '',
    updatedAt: null,
    lastFailureReason: null,
    lastFailureAt: null,
    lastRecoveredAt: null,
    lastRemoteAt: null,
    lastPushAt: null,
    lastRetryAt: null,
    lastRetrySource: null,
    retryAttemptCount: 0,
    nextRetryAt: null,
    pendingCount: 0,
    lastRemoteCount: null,
    lastPushCount: null,
  },
  issueReports: {
    mode: 'syncing',
    message: '',
    updatedAt: null,
    lastFailureReason: null,
    lastFailureAt: null,
    lastRecoveredAt: null,
    lastRemoteAt: null,
    lastPushAt: null,
    lastRetryAt: null,
    lastRetrySource: null,
    retryAttemptCount: 0,
    nextRetryAt: null,
    pendingCount: 0,
    lastRemoteCount: null,
    lastPushCount: null,
  },
})

describe('syncRetrySelection', () => {
  it('lists pending retry resources', () => {
    const snapshot = createRuntimeSnapshot()
    snapshot.savedPlans.pendingCount = 2

    expect(listPendingRetryResources(snapshot)).toEqual(['savedPlans'])
  })

  it('lists only due retry resources', () => {
    const snapshot = createRuntimeSnapshot()
    snapshot.savedPlans.pendingCount = 2
    snapshot.savedPlans.nextRetryAt = 1_000
    snapshot.reports.pendingCount = 1
    snapshot.reports.nextRetryAt = 5_000

    expect(listDueRetryResources(snapshot, 2_000)).toEqual(['savedPlans'])
  })

  it('filters retry resources by request, in-flight state, and enabled endpoints', () => {
    const snapshot = createRuntimeSnapshot()
    snapshot.savedPlans.pendingCount = 2
    snapshot.reports.pendingCount = 1

    expect(
      resolveRetrySyncResources({
        runtimeSnapshot: snapshot,
        requestedResources: ['savedPlans', 'reports'],
        retryingResources: {
          savedPlans: false,
          reports: true,
          issueReports: false,
        },
        endpointEnabled: {
          savedPlans: true,
          reports: true,
          issueReports: false,
        },
      }),
    ).toEqual(['savedPlans'])
  })
})
