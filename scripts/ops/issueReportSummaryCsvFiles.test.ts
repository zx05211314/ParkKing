import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { writeIssueReportSummaryCsvFiles } from './issueReportSummaryCsvFiles'
import type { IssueReportSummaryResult } from './issueReportSummaryTypes'
import type { NightlyPublishGateSummary } from './notifyNightlyTypes'

const createResult = (): IssueReportSummaryResult => ({
  storageFile: 'C:/tmp/sync-service.json',
  storeExists: true,
  totalCount: 3,
  filteredCount: 2,
  filters: {
    scope: 'alpha',
    districtId: 'xinyi',
    segmentId: null,
    reasonCode: null,
    since: null,
  },
  summaries: [],
  segmentSummaries: [],
  topDistricts: [
    {
      scope: 'alpha',
      districtId: 'xinyi',
      count: 2,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Issue with "quote"',
    },
  ],
  latestDistricts: [
    {
      scope: 'alpha',
      districtId: 'xinyi',
      count: 2,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Issue with "quote"',
    },
  ],
  topSegments: [
    {
      scope: 'alpha',
      districtId: 'xinyi',
      segmentId: 'seg-1',
      segmentName: 'C2 curb',
      segmentTier: 'YELLOW',
      count: 2,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Issue with "quote"',
    },
  ],
  topReasons: [
    {
      reasonCode: 'TIME_WINDOW',
      count: 2,
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
      reasonCodes: ['TIME_WINDOW', 'SIGN_OVERRIDE'],
      bundleGeneratedAt: '2026-04-02T12:01:00.000Z',
      reportHhmm: '22:30',
      includeInferred: false,
      summary: 'Issue with "quote"',
      createdAt: '2026-04-02T12:00:00.000Z',
    },
  ],
  rawIssues: [],
})

const createPublishGateSummary = (): NightlyPublishGateSummary => ({
  generatedAt: '2026-04-02T12:30:00.000Z',
  mode: 'strict',
  exitCode: 0,
  allowWarn: false,
  allowFail: true,
  overrideReason: 'ci fixture override',
  totals: {
    info: 0,
    warn: 1,
    fail: 2,
  },
  topDistricts: [
    {
      districtId: 'xinyi',
      warn: 1,
      fail: 2,
      topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
      topFailCodes: ['HASH_MISMATCH'],
      signOverrideBreakdown: {
        matchedBySegmentId: 3,
        matchedBySpatial: 1,
        unmatchedNamed: 2,
      },
    },
  ],
  summaryPath: 'public/data/generated/_ops/publish_gate_summary.json',
  summaryUrl: null,
})

describe('issueReportSummaryCsvFiles', () => {
  it('writes hotspot and recent-issue csv exports', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-csv-'))
    const outPath = path.join(base, 'csv')

    const result = await writeIssueReportSummaryCsvFiles(
      outPath,
      createResult(),
      createPublishGateSummary(),
    )

    expect(result.filePaths).toHaveLength(6)
    await expect(fs.readFile(path.join(outPath, 'top-districts.csv'), 'utf8')).resolves.toContain(
      '"scope","district_id","count","latest_created_at","latest_summary"',
    )
    await expect(fs.readFile(path.join(outPath, 'top-segments.csv'), 'utf8')).resolves.toContain(
      '"alpha","xinyi","seg-1","C2 curb (seg-1)","YELLOW","2"',
    )
    await expect(fs.readFile(path.join(outPath, 'top-reasons.csv'), 'utf8')).resolves.toContain(
      '"TIME_WINDOW","2","1","1"',
    )
    await expect(fs.readFile(path.join(outPath, 'recent-issues.csv'), 'utf8')).resolves.toContain(
      '"TIME_WINDOW|SIGN_OVERRIDE"',
    )
    await expect(fs.readFile(path.join(outPath, 'recent-issues.csv'), 'utf8')).resolves.toContain(
      '"Issue with ""quote"""',
    )
    await expect(
      fs.readFile(path.join(outPath, 'publish-gate-districts.csv'), 'utf8'),
    ).resolves.toContain(
      '"district_id","warn","fail","top_warn_codes","top_fail_codes","direct_override_matches","spatial_override_matches","unmatched_named_overrides","issue_hotspot_segment_id","issue_hotspot_segment_name","issue_hotspot_segment_label"',
    )
    await expect(
      fs.readFile(path.join(outPath, 'publish-gate-districts.csv'), 'utf8'),
    ).resolves.toContain(
      '"xinyi","1","2","METRIC_SIGN_OVERRIDE_UNMATCHED","HASH_MISMATCH","3","1","2","seg-1","C2 curb","C2 curb (seg-1)"',
    )
  })
})
