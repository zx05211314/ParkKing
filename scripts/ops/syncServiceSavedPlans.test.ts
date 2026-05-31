import { describe, expect, it } from 'vitest'
import { replaceSyncSavedPlans } from './syncServiceSavedPlans'
import type { SyncServiceStore } from './syncServiceTypes'

const createStore = (): SyncServiceStore => ({
  schemaVersion: 1,
  buckets: {},
})

describe('syncServiceSavedPlans', () => {
  it('returns a conflict result for stale revisions without mutating the bucket', () => {
    const store = createStore()
    const firstWrite = replaceSyncSavedPlans({
      store,
      scope: 'alpha',
      defaultScope: 'default',
      plans: [{ key: 'a' }],
      updatedAt: '2026-03-21T00:00:00.000Z',
    })
    const staleWrite = replaceSyncSavedPlans({
      store,
      scope: 'alpha',
      defaultScope: 'default',
      plans: [{ key: 'b' }],
      expectedRevision: 0,
      updatedAt: '2026-03-21T01:00:00.000Z',
    })

    expect(firstWrite.changed).toBe(true)
    expect(staleWrite).toEqual({
      changed: false,
      result: {
        conflict: true,
        plans: [{ key: 'a' }],
        revision: 1,
      },
    })
  })
})
