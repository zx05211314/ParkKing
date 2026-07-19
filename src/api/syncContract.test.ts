import { afterEach, describe, expect, it } from 'vitest'
import { resolveParkKingSyncServiceConfig } from './syncContract'

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('syncContract', () => {
  it('builds first-party resource endpoints from a shared base url', () => {
    expect(
      resolveParkKingSyncServiceConfig({
        VITE_SYNC_BASE_URL: '/api/sync',
      }),
    ).toEqual({
      baseUrl: '/api/sync',
      bootstrapEndpoint: '/api/sync/bootstrap',
      statusEndpoint: '/api/sync/status',
      readinessEndpoint: '/api/sync/ready',
      savedPlansEndpoint: '/api/sync/saved-plans',
      reportsEndpoint: '/api/sync/reports',
      issueReportsEndpoint: '/api/sync/issues',
    })
  })

  it('respects custom first-party resource paths', () => {
    expect(
      resolveParkKingSyncServiceConfig({
        VITE_SYNC_BASE_URL: 'https://api.parkking.test/v1',
        VITE_SYNC_BOOTSTRAP_PATH: 'state',
        VITE_SYNC_STATUS_PATH: 'status-check',
        VITE_SYNC_READINESS_PATH: 'ready-check',
        VITE_SYNC_SAVED_PLANS_PATH: 'trip-board',
        VITE_SYNC_REPORTS_PATH: '/feedback/reports',
        VITE_SYNC_ISSUES_PATH: 'feedback/issues',
      }),
    ).toEqual({
      baseUrl: 'https://api.parkking.test/v1',
      bootstrapEndpoint: 'https://api.parkking.test/v1/state',
      statusEndpoint: 'https://api.parkking.test/v1/status-check',
      readinessEndpoint: 'https://api.parkking.test/v1/ready-check',
      savedPlansEndpoint: 'https://api.parkking.test/v1/trip-board',
      reportsEndpoint: 'https://api.parkking.test/v1/feedback/reports',
      issueReportsEndpoint: 'https://api.parkking.test/v1/feedback/issues',
    })
  })

  it('applies an optional sync scope to both first-party resources', () => {
    expect(
      resolveParkKingSyncServiceConfig({
        VITE_SYNC_BASE_URL: '/api/sync',
        VITE_SYNC_SCOPE: 'tester-a',
      }),
    ).toEqual({
      baseUrl: '/api/sync',
      bootstrapEndpoint: '/api/sync/bootstrap?scope=tester-a',
      statusEndpoint: '/api/sync/status?scope=tester-a',
      readinessEndpoint: '/api/sync/ready?scope=tester-a',
      savedPlansEndpoint: '/api/sync/saved-plans?scope=tester-a',
      reportsEndpoint: '/api/sync/reports?scope=tester-a',
      issueReportsEndpoint: '/api/sync/issues?scope=tester-a',
    })
  })

  it('exposes only issue upload when the client is in upload-only mode', () => {
    expect(
      resolveParkKingSyncServiceConfig({
        VITE_SYNC_BASE_URL: '/api/sync',
        VITE_SYNC_MODE: 'issue-upload-only',
        VITE_SYNC_SCOPE: 'feedback',
      }),
    ).toEqual({
      baseUrl: null,
      bootstrapEndpoint: null,
      statusEndpoint: null,
      readinessEndpoint: null,
      savedPlansEndpoint: null,
      reportsEndpoint: null,
      issueReportsEndpoint: '/api/sync/issues?scope=feedback',
    })
  })

  it('defaults to the local first-party sync service on localhost', () => {
    ;(globalThis as { window?: { location: { hostname: string } } }).window = {
      location: {
        hostname: 'localhost',
      },
    }

    expect(resolveParkKingSyncServiceConfig({})).toEqual({
      baseUrl: '/api/sync',
      bootstrapEndpoint: '/api/sync/bootstrap',
      statusEndpoint: '/api/sync/status',
      readinessEndpoint: '/api/sync/ready',
      savedPlansEndpoint: '/api/sync/saved-plans',
      reportsEndpoint: '/api/sync/reports',
      issueReportsEndpoint: '/api/sync/issues',
    })
  })

  it('falls back to legacy per-resource endpoints when no shared base url is configured', () => {
    expect(
      resolveParkKingSyncServiceConfig({
        VITE_SAVED_PLANS_URL: '/legacy/plans',
        VITE_REPORTS_URL: '/legacy/reports',
        VITE_ISSUE_REPORTS_URL: '/legacy/issues',
      }),
    ).toEqual({
      baseUrl: null,
      bootstrapEndpoint: null,
      statusEndpoint: null,
      readinessEndpoint: null,
      savedPlansEndpoint: '/legacy/plans',
      reportsEndpoint: '/legacy/reports',
      issueReportsEndpoint: '/legacy/issues',
    })
  })

  it('does not override explicit legacy endpoints with the implicit localhost sync service', () => {
    ;(globalThis as { window?: { location: { hostname: string } } }).window = {
      location: {
        hostname: 'localhost',
      },
    }

    expect(
      resolveParkKingSyncServiceConfig({
        VITE_SAVED_PLANS_URL: '/legacy/plans',
        VITE_REPORTS_URL: '/legacy/reports',
        VITE_ISSUE_REPORTS_URL: '/legacy/issues',
      }),
    ).toEqual({
      baseUrl: null,
      bootstrapEndpoint: null,
      statusEndpoint: null,
      readinessEndpoint: null,
      savedPlansEndpoint: '/legacy/plans',
      reportsEndpoint: '/legacy/reports',
      issueReportsEndpoint: '/legacy/issues',
    })
  })

  it('applies an optional sync scope to legacy per-resource endpoints too', () => {
    expect(
      resolveParkKingSyncServiceConfig({
        VITE_SAVED_PLANS_URL: '/legacy/plans',
        VITE_REPORTS_URL: '/legacy/reports',
        VITE_ISSUE_REPORTS_URL: '/legacy/issues',
        VITE_SYNC_SCOPE: 'tester-b',
      }),
    ).toEqual({
      baseUrl: null,
      bootstrapEndpoint: null,
      statusEndpoint: null,
      readinessEndpoint: null,
      savedPlansEndpoint: '/legacy/plans?scope=tester-b',
      reportsEndpoint: '/legacy/reports?scope=tester-b',
      issueReportsEndpoint: '/legacy/issues?scope=tester-b',
    })
  })
})
