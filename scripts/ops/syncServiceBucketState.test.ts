import { describe, expect, it } from 'vitest'
import {
  createEmptySyncServiceBucket,
  normalizeSyncServiceBucket,
} from './syncServiceBucketState'

describe('createEmptySyncServiceBucket', () => {
  it('creates a zeroed sync bucket', () => {
    expect(createEmptySyncServiceBucket()).toEqual({
      savedPlans: [],
      reports: [],
      issueReports: [],
      savedPlansRevision: 0,
      reportsRevision: 0,
      issueReportsRevision: 0,
      savedPlansUpdatedAt: null,
      reportsUpdatedAt: null,
      issueReportsUpdatedAt: null,
    })
  })
})

describe('normalizeSyncServiceBucket', () => {
  it('normalizes malformed bucket fields', () => {
    expect(
      normalizeSyncServiceBucket({
        savedPlans: [{}],
        reports: 'bad',
        savedPlansRevision: 2.7,
      }),
    ).toEqual({
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
  })
})
