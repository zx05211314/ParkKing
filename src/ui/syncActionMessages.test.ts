import { describe, expect, it } from 'vitest'
import {
  buildRefreshSyncSuccessStatus,
  buildRetrySyncOutcomeStatus,
  buildRetrySyncSuccessStatus,
} from './syncActionMessages'

describe('syncActionMessages', () => {
  it('builds refresh success status for single-resource pulls', () => {
    expect(buildRefreshSyncSuccessStatus(['savedPlans'])).toEqual({
      kind: 'success',
      message: 'Pulled latest saved plans.',
    })
  })

  it('builds retry success status for multiple resources', () => {
    expect(buildRetrySyncSuccessStatus([
      'savedPlans',
      'reports',
      'issueReports',
    ])).toEqual({
      kind: 'success',
      message:
        'Retried sync. saved plans, reports, and issue reports are confirmed remotely.',
    })
  })

  it('builds retry outcome status for mixed remote sync results', () => {
    expect(
      buildRetrySyncOutcomeStatus({
        savedPlans: true,
        reports: false,
        issueReports: true,
      }),
    ).toEqual({
      kind: 'error',
      message:
        'Retried sync. saved plans synced; reports still using local fallback; issue reports synced.',
    })
  })
})
