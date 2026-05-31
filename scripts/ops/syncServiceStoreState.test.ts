import { describe, expect, it } from 'vitest'
import { createLegacySyncServiceStore, readSyncStatusSnapshot } from './syncServiceStoreState'

describe('createLegacySyncServiceStore', () => {
  it('builds a default scoped legacy store', () => {
    expect(createLegacySyncServiceStore([1], [2], 'alpha')).toEqual({
      schemaVersion: 1,
      buckets: {
        alpha: {
          savedPlans: [1],
          reports: [2],
          issueReports: [],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 0,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: null,
        },
      },
    })
  })
})

describe('readSyncStatusSnapshot', () => {
  it('reads counts and revisions from a bucket', () => {
    expect(
      readSyncStatusSnapshot(
        {
          savedPlans: [1, 2],
          reports: [3],
          issueReports: [],
          savedPlansRevision: 4,
          reportsRevision: 5,
          issueReportsRevision: 0,
          savedPlansUpdatedAt: 'a',
          reportsUpdatedAt: 'b',
          issueReportsUpdatedAt: null,
        },
        'alpha',
      ),
    ).toEqual({
      scope: 'alpha',
      savedPlansRevision: 4,
      reportsRevision: 5,
      issueReportsRevision: 0,
      savedPlansCount: 2,
      reportsCount: 1,
      issueReportsCount: 0,
      savedPlansUpdatedAt: 'a',
      reportsUpdatedAt: 'b',
      issueReportsUpdatedAt: null,
    })
  })
})
