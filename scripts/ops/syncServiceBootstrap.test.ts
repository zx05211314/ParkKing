import { describe, expect, it } from 'vitest'
import { readSyncBootstrapState } from './syncServiceBootstrap'
import type { SyncServiceStore } from './syncServiceTypes'

describe('syncServiceBootstrap', () => {
  it('returns only the requested bootstrap resources for a scope', () => {
    const store: SyncServiceStore = {
      schemaVersion: 1,
      buckets: {
        alpha: {
          savedPlans: [{ key: 'plan-a' }],
          reports: [{ districtId: 'xinyi' }],
          savedPlansRevision: 2,
          reportsRevision: 3,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
        },
      },
    }

    expect(readSyncBootstrapState(store, 'alpha', 'default', ['savedPlans'])).toEqual({
      plans: [{ key: 'plan-a' }],
      savedPlansRevision: 2,
    })
  })
})
