import { describe, expect, it } from 'vitest'
import { normalizeBootstrapResources } from './syncServiceConfig'
import {
  ensureSyncServiceBucket,
  normalizeSyncServiceBucket,
} from './syncServiceState'

describe('normalizeBootstrapResources', () => {
  it('supports comma-delimited and repeated include params without duplicates', () => {
    expect(
      normalizeBootstrapResources(['savedPlans,reports', 'reports', 'savedPlans']),
    ).toEqual(['savedPlans', 'reports'])
  })
})

describe('ensureSyncServiceBucket', () => {
  it('normalizes malformed buckets and creates missing scopes', () => {
    const store = {
      schemaVersion: 1,
      buckets: {
        alpha: normalizeSyncServiceBucket({
          savedPlans: [{}],
          reports: 'bad',
          savedPlansRevision: 2.7,
        }),
      },
    }

    const alpha = ensureSyncServiceBucket(store, 'alpha', 'default')
    const beta = ensureSyncServiceBucket(store, 'beta', 'default')

    expect(alpha.bucket).toEqual({
      savedPlans: [{}],
      reports: [],
      issueReports: [],
      savedPlansRevision: 2,
      reportsRevision: 0,
      issueReportsRevision: 0,
      savedPlansUpdatedAt: null,
      reportsUpdatedAt: null,
      issueReportsUpdatedAt: null,
    })
    expect(beta.bucket.savedPlans).toEqual([])
    expect(beta.bucket.reports).toEqual([])
    expect(beta.bucket.issueReports).toEqual([])
  })
})
