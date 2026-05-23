import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildIssueReportSummaryJsonOutput, loadIssueReportSummary } from './issueReportSummary'
import type { SyncServiceStore } from './syncServiceTypes'

describe('issueReportSummary', () => {
  it('loads and filters issue reports from the sync store file', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-summary-'))
    const syncStorePath = path.join(base, 'sync-service.json')
    const store: SyncServiceStore = {
      schemaVersion: 1,
      buckets: {
        alpha: {
          savedPlans: [],
          reports: [],
          issueReports: [
            {
              issueId: 'issue-a',
              districtId: 'xinyi',
              segmentId: 'seg-1',
              summary: 'Newest issue',
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
                  reasonCodes: ['TIME_WINDOW'],
                },
              },
            },
            {
              issueId: 'issue-b',
              districtId: 'xinyi',
              segmentId: 'seg-2',
              summary: 'Older issue',
              createdAt: '2026-04-02T10:00:00.000Z',
            },
          ],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 2,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    }

    await fs.writeFile(syncStorePath, JSON.stringify(store, null, 2), 'utf-8')

    await expect(
      loadIssueReportSummary({
        syncStorePath,
        scope: 'alpha',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        reasonCode: null,
        since: '2026-04-02T11:00:00.000Z',
        limit: 5,
      }),
    ).resolves.toEqual({
      storageFile: syncStorePath,
      storeExists: true,
      totalCount: 2,
      filteredCount: 1,
      filters: {
        scope: 'alpha',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        reasonCode: null,
        since: '2026-04-02T11:00:00.000Z',
      },
      summaries: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          count: 1,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Newest issue',
        },
      ],
      segmentSummaries: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          count: 1,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Newest issue',
        },
      ],
      topDistricts: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          count: 1,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Newest issue',
        },
      ],
      latestDistricts: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          count: 1,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Newest issue',
        },
      ],
      topSegments: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          count: 1,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Newest issue',
        },
      ],
      topReasons: [
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
      ],
      issues: [
        {
          scope: 'alpha',
          issueId: 'issue-a',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          allowedNow: 'PARK',
          reasonCodes: ['TIME_WINDOW'],
          bundleGeneratedAt: '2026-04-02T12:01:00.000Z',
          reportHhmm: '22:30',
          includeInferred: false,
          summary: 'Newest issue',
          createdAt: '2026-04-02T12:00:00.000Z',
        },
      ],
      rawIssues: [
        {
          scope: 'alpha',
          issueId: 'issue-a',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          allowedNow: 'PARK',
          reasonCodes: ['TIME_WINDOW'],
          bundleGeneratedAt: '2026-04-02T12:01:00.000Z',
          reportHhmm: '22:30',
          includeInferred: false,
          summary: 'Newest issue',
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
              reasonCodes: ['TIME_WINDOW'],
            },
          },
        },
      ],
    })
  })

  it('returns a missing-store result when the storage file does not exist', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-summary-missing-'))
    const syncStorePath = path.join(base, 'missing.json')

    await expect(
      loadIssueReportSummary({
        syncStorePath,
        scope: null,
        districtId: null,
        segmentId: null,
        reasonCode: null,
        since: null,
        limit: 10,
      }),
    ).resolves.toEqual({
      storageFile: syncStorePath,
      storeExists: false,
      totalCount: 0,
      filteredCount: 0,
      filters: {
        scope: null,
        districtId: null,
        segmentId: null,
        reasonCode: null,
        since: null,
      },
      summaries: [],
      segmentSummaries: [],
      topDistricts: [],
      latestDistricts: [],
      topSegments: [],
      topReasons: [],
      issues: [],
      rawIssues: [],
    })
  })

  it('can add export artifact metadata to the json output surface', async () => {
    const result = await loadIssueReportSummary({
      syncStorePath: 'C:/tmp/missing.json',
      scope: null,
      districtId: null,
      segmentId: null,
      reasonCode: null,
      since: null,
      limit: 10,
    })

    expect(
      buildIssueReportSummaryJsonOutput({
        result,
        publishGateSummary: null,
        publishGateHotspots: [],
        artifacts: {
          summaryPath: 'C:/tmp/issue-summary.json',
          summaryRelativePath: 'issue-summary.json',
          summaryUrl: 'https://example.com/issue-summary/issue-summary.json',
          rawIssuesPath: 'C:/tmp/raw-issues.json',
          rawIssuesRelativePath: 'raw-issues.json',
          rawIssuesUrl: 'https://example.com/raw-issues/raw-issues.json',
          csvRootPath: 'C:/tmp/issue-csv',
          csvRootUrl: 'https://example.com/issue-csv',
          csvBaseUrl: 'https://example.com/issue-csv',
          preferredCsvPath: 'C:/tmp/issue-csv/top-segments.csv',
          preferredCsvRelativePath: 'top-segments.csv',
          preferredCsvUrl: 'https://example.com/issue-csv/top-segments.csv',
          csvPaths: ['C:/tmp/issue-csv/top-segments.csv'],
          csvRelativePaths: ['top-segments.csv'],
          packetRootPath: 'C:/tmp/issue-packets',
          packetRootUrl: 'https://example.com/issue-packets',
          packetBaseUrl: 'https://example.com/issue-packets',
          packetSummaryPath: 'C:/tmp/issue-packets/summary.md',
          packetSummaryRelativePath: 'summary.md',
          packetSummaryUrl: 'https://example.com/issue-packets/summary.md',
          packetManifestPath: 'C:/tmp/issue-packets/manifest.json',
          packetManifestRelativePath: 'manifest.json',
          packetManifestUrl: 'https://example.com/issue-packets/manifest.json',
          packetPaths: ['C:/tmp/issue-packets/manifest.json'],
          packetRelativePaths: ['manifest.json'],
        },
      }),
    ).toEqual({
      ...result,
      artifactType: 'issue-report-summary-json',
      schemaVersion: 1,
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: 'C:/tmp/issue-summary.json',
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: 'https://example.com/issue-summary/issue-summary.json',
        rawIssuesPath: 'C:/tmp/raw-issues.json',
        rawIssuesRelativePath: 'raw-issues.json',
        rawIssuesUrl: 'https://example.com/raw-issues/raw-issues.json',
        csvRootPath: 'C:/tmp/issue-csv',
        csvRootUrl: 'https://example.com/issue-csv',
        csvBaseUrl: 'https://example.com/issue-csv',
        preferredCsvPath: 'C:/tmp/issue-csv/top-segments.csv',
        preferredCsvRelativePath: 'top-segments.csv',
        preferredCsvUrl: 'https://example.com/issue-csv/top-segments.csv',
        csvPaths: ['C:/tmp/issue-csv/top-segments.csv'],
        csvRelativePaths: ['top-segments.csv'],
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: 'https://example.com/issue-packets',
        packetBaseUrl: 'https://example.com/issue-packets',
        packetSummaryPath: 'C:/tmp/issue-packets/summary.md',
        packetSummaryRelativePath: 'summary.md',
        packetSummaryUrl: 'https://example.com/issue-packets/summary.md',
        packetManifestPath: 'C:/tmp/issue-packets/manifest.json',
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: 'https://example.com/issue-packets/manifest.json',
        packetPaths: ['C:/tmp/issue-packets/manifest.json'],
        packetRelativePaths: ['manifest.json'],
      },
    })
  })
})
