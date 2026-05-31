import { describe, expect, it } from 'vitest'
import { appendSyncReport } from './syncServiceReports'
import type { SyncServiceStore } from './syncServiceTypes'

const createStore = (): SyncServiceStore => ({
  schemaVersion: 1,
  buckets: {},
})

describe('syncServiceReports', () => {
  it('dedupes reports before mutating the bucket revision', () => {
    const store = createStore()
    const report = {
      schemaVersion: 1,
      districtId: 'xinyi',
      segmentId: 'seg-1',
      status: 'LEGAL',
      createdAt: '2026-03-21T00:00:00.000Z',
    }

    const firstAppend = appendSyncReport({
      store,
      scope: 'alpha',
      defaultScope: 'default',
      report,
      updatedAt: '2026-03-21T00:00:00.000Z',
    })
    const secondAppend = appendSyncReport({
      store,
      scope: 'alpha',
      defaultScope: 'default',
      report,
      updatedAt: '2026-03-21T01:00:00.000Z',
    })

    expect(firstAppend.changed).toBe(true)
    expect(secondAppend).toEqual({
      changed: false,
      result: {
        report,
        revision: 1,
      },
    })
  })
})
