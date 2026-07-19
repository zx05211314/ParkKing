import { describe, expect, it } from 'vitest'
import {
  collectSyncIssueReportDistrictSummaries,
  collectSyncIssueReportEntries,
  filterSyncIssueReportEntries,
  isSyntheticSyncIssueReport,
  summarizeSyncIssueReportEntries,
  summarizeSyncIssueReportReasons,
  summarizeSyncIssueReportSegments,
} from './issueReportSummaryState'
import { createLegacySyncServiceStore } from './syncServiceStoreState'

describe('issueReportSummaryState', () => {
  it('excludes API smoke roundtrips without hiding similar user reports', () => {
    const smoke = {
      issueId: 'smoke-sync-issue-1234-abcd',
      districtId: 'xinyi',
      summary: 'Smoke sync issue report roundtrip',
      createdAt: '2026-04-02T12:00:00.000Z',
      bundle: {
        source: 'smoke-api-services',
      },
    }
    const userReport = {
      ...smoke,
      issueId: 'user-issue-1',
      summary: 'User saw the smoke test text in the UI',
    }
    const store = createLegacySyncServiceStore([], [], 'workspace')
    store.buckets['smoke-api-services-1234-abcd'] = {
      ...store.buckets.workspace,
      issueReports: [smoke],
    }
    store.buckets.workspace.issueReports = [userReport]

    expect(
      isSyntheticSyncIssueReport('smoke-api-services-1234-abcd', smoke),
    ).toBe(true)
    expect(isSyntheticSyncIssueReport('workspace', userReport)).toBe(false)
    expect(collectSyncIssueReportEntries(store)).toEqual([
      expect.objectContaining({
        scope: 'workspace',
        issueId: 'user-issue-1',
      }),
    ])
  })

  it('collects normalized issue reports across scoped buckets', () => {
    const store = createLegacySyncServiceStore([], [], 'workspace')
    store.buckets.workspace.issueReports = [
      {
        issueId: 'issue-a',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        summary: 'Newest issue',
        createdAt: '2026-04-02T12:00:00.000Z',
      },
      {
        issueId: 'issue-b',
        districtId: 'xinyi',
        segmentId: 'seg-2',
        summary: 'Older issue',
        createdAt: '2026-04-02T11:00:00.000Z',
      },
    ]
    store.buckets.alpha = {
      ...store.buckets.workspace,
      issueReports: [
        {
          issueId: 'issue-c',
          districtId: 'daan',
          summary: 'Alpha issue',
          createdAt: '2026-04-02T10:00:00.000Z',
        },
      ],
    }

    expect(collectSyncIssueReportEntries(store)).toEqual([
      {
        scope: 'workspace',
        issueId: 'issue-a',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        segmentName: null,
        segmentTier: null,
        allowedNow: null,
        reasonCodes: [],
        bundleGeneratedAt: null,
        reportHhmm: null,
        includeInferred: null,
        summary: 'Newest issue',
        createdAt: '2026-04-02T12:00:00.000Z',
        bundle: null,
      },
      {
        scope: 'workspace',
        issueId: 'issue-b',
        districtId: 'xinyi',
        segmentId: 'seg-2',
        segmentName: null,
        segmentTier: null,
        allowedNow: null,
        reasonCodes: [],
        bundleGeneratedAt: null,
        reportHhmm: null,
        includeInferred: null,
        summary: 'Older issue',
        createdAt: '2026-04-02T11:00:00.000Z',
        bundle: null,
      },
      {
        scope: 'alpha',
        issueId: 'issue-c',
        districtId: 'daan',
        segmentId: null,
        segmentName: null,
        segmentTier: null,
        allowedNow: null,
        reasonCodes: [],
        bundleGeneratedAt: null,
        reportHhmm: null,
        includeInferred: null,
        summary: 'Alpha issue',
        createdAt: '2026-04-02T10:00:00.000Z',
        bundle: null,
      },
    ])
  })

  it('filters and summarizes issue reports by scope, district, and time', () => {
    const issues = [
      {
        scope: 'workspace',
        issueId: 'issue-a',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        segmentName: 'C2 curb',
        segmentTier: 'YELLOW',
        allowedNow: null,
        reasonCodes: ['TIME_WINDOW'],
        bundleGeneratedAt: null,
        reportHhmm: null,
        includeInferred: null,
        summary: 'Newest issue',
        createdAt: '2026-04-02T12:00:00.000Z',
      },
      {
        scope: 'workspace',
        issueId: 'issue-b',
        districtId: 'xinyi',
        segmentId: 'seg-2',
        segmentName: 'B1 curb',
        segmentTier: 'RED',
        allowedNow: null,
        reasonCodes: ['SIGN_OVERRIDE'],
        bundleGeneratedAt: null,
        reportHhmm: null,
        includeInferred: null,
        summary: 'Older issue',
        createdAt: '2026-04-02T11:00:00.000Z',
      },
      {
        scope: 'alpha',
        issueId: 'issue-c',
        districtId: 'daan',
        segmentId: null,
        segmentName: null,
        segmentTier: null,
        allowedNow: null,
        reasonCodes: [],
        bundleGeneratedAt: null,
        reportHhmm: null,
        includeInferred: null,
        summary: 'Alpha issue',
        createdAt: '2026-04-02T10:00:00.000Z',
      },
    ]

    const filtered = filterSyncIssueReportEntries(issues, {
      scope: 'workspace',
      districtId: 'xinyi',
      segmentId: 'seg-1',
      reasonCode: null,
      since: '2026-04-02T11:30:00.000Z',
    })

    expect(filtered).toEqual([
      {
        scope: 'workspace',
        issueId: 'issue-a',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        segmentName: 'C2 curb',
        segmentTier: 'YELLOW',
        allowedNow: null,
        reasonCodes: ['TIME_WINDOW'],
        bundleGeneratedAt: null,
        reportHhmm: null,
        includeInferred: null,
        summary: 'Newest issue',
        createdAt: '2026-04-02T12:00:00.000Z',
      },
    ])

    expect(summarizeSyncIssueReportEntries(issues)).toEqual([
      {
        scope: 'alpha',
        districtId: 'daan',
        count: 1,
        latestCreatedAt: '2026-04-02T10:00:00.000Z',
        latestSummary: 'Alpha issue',
      },
      {
        scope: 'workspace',
        districtId: 'xinyi',
        count: 2,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Newest issue',
      },
    ])

    expect(summarizeSyncIssueReportSegments(issues)).toEqual([
      {
        scope: 'workspace',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        segmentName: 'C2 curb',
        segmentTier: 'YELLOW',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Newest issue',
      },
      {
        scope: 'workspace',
        districtId: 'xinyi',
        segmentId: 'seg-2',
        segmentName: 'B1 curb',
        segmentTier: 'RED',
        count: 1,
        latestCreatedAt: '2026-04-02T11:00:00.000Z',
        latestSummary: 'Older issue',
      },
    ])

    expect(summarizeSyncIssueReportReasons(issues)).toEqual([
      {
        reasonCode: 'TIME_WINDOW',
        count: 1,
        districtCount: 1,
        segmentCount: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestDistrictId: 'xinyi',
        latestSegmentId: 'seg-1',
        latestSegmentName: 'C2 curb',
      },
      {
        reasonCode: 'SIGN_OVERRIDE',
        count: 1,
        districtCount: 1,
        segmentCount: 1,
        latestCreatedAt: '2026-04-02T11:00:00.000Z',
        latestDistrictId: 'xinyi',
        latestSegmentId: 'seg-2',
        latestSegmentName: 'B1 curb',
      },
    ])

    expect(
      filterSyncIssueReportEntries(issues, {
        scope: null,
        districtId: null,
        segmentId: null,
        reasonCode: 'TIME_WINDOW',
        since: null,
      }),
    ).toEqual([
      {
        scope: 'workspace',
        issueId: 'issue-a',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        segmentName: 'C2 curb',
        segmentTier: 'YELLOW',
        allowedNow: null,
        reasonCodes: ['TIME_WINDOW'],
        bundleGeneratedAt: null,
        reportHhmm: null,
        includeInferred: null,
        summary: 'Newest issue',
        createdAt: '2026-04-02T12:00:00.000Z',
      },
    ])
  })

  it('collects filtered district summaries directly from the sync store', () => {
    const store = createLegacySyncServiceStore([], [], 'workspace')
    store.buckets.workspace.issueReports = [
      {
        issueId: 'issue-a',
        districtId: 'xinyi',
        summary: 'Workspace issue',
        createdAt: '2026-04-02T12:00:00.000Z',
      },
    ]
    store.buckets.alpha = {
      ...store.buckets.workspace,
      issueReports: [
        {
          issueId: 'issue-b',
          districtId: 'daan',
          summary: 'Alpha issue',
          createdAt: '2026-04-02T09:00:00.000Z',
        },
      ],
    }

    expect(
      collectSyncIssueReportDistrictSummaries(store, {
        scope: 'workspace',
        districtId: null,
        segmentId: null,
        reasonCode: null,
        since: null,
      }),
    ).toEqual([
      {
        scope: 'workspace',
        districtId: 'xinyi',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Workspace issue',
      },
    ])
  })

  it('extracts bundle snapshot details for segment triage', () => {
    const store = createLegacySyncServiceStore([], [], 'workspace')
    store.buckets.workspace.issueReports = [
      {
        issueId: 'issue-a',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        summary: 'Bundle-backed issue',
        createdAt: '2026-04-02T12:00:00.000Z',
        bundle: {
          generatedAt: '2026-04-02T12:01:00.000Z',
          context: {
            hhmm: '22:30',
            includeInferred: false,
          },
          selectedSegment: {
            name: 'C2 curb',
            tier: 'YELLOW',
            allowedNow: 'PARK',
            reasonCodes: ['TIME_WINDOW', 'SIGN_OVERRIDE'],
          },
        },
      },
    ]

    expect(collectSyncIssueReportEntries(store)).toEqual([
      {
        scope: 'workspace',
        issueId: 'issue-a',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        segmentName: 'C2 curb',
        segmentTier: 'YELLOW',
        allowedNow: 'PARK',
        reasonCodes: ['TIME_WINDOW', 'SIGN_OVERRIDE'],
        bundleGeneratedAt: '2026-04-02T12:01:00.000Z',
        reportHhmm: '22:30',
        includeInferred: false,
        summary: 'Bundle-backed issue',
        createdAt: '2026-04-02T12:00:00.000Z',
        bundle: {
          generatedAt: '2026-04-02T12:01:00.000Z',
          context: {
            hhmm: '22:30',
            includeInferred: false,
          },
          selectedSegment: {
            name: 'C2 curb',
            tier: 'YELLOW',
            allowedNow: 'PARK',
            reasonCodes: ['TIME_WINDOW', 'SIGN_OVERRIDE'],
          },
        },
      },
    ])
  })
})
