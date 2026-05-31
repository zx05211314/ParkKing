import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { writeIssueReportTriagePacketBundle } from './issueReportSummaryPacketFiles'
import type { IssueReportTriagePacketBundle } from './issueReportSummaryTypes'

const createBundle = (): IssueReportTriagePacketBundle => ({
  generatedAt: '2026-04-02T13:00:00.000Z',
  storageFile: 'C:/tmp/sync-service.json',
  filters: {
    scope: 'alpha',
    districtId: 'xinyi',
    segmentId: null,
    reasonCode: null,
    since: null,
  },
  totalCount: 4,
  filteredCount: 3,
  publishGateSummary: {
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
  },
  segmentPackets: [
    {
      packetKind: 'segment',
      rank: 1,
      packetId: 'alpha-xinyi-seg-1',
      scope: 'alpha',
      districtId: 'xinyi',
      segmentId: 'seg-1',
      segmentName: 'C2 curb',
      segmentTier: 'YELLOW',
      count: 2,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Newest issue',
      reasonCounts: [{ reasonCode: 'TIME_WINDOW', count: 2 }],
      recentIssues: [
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
          bundle: { selectedSegment: { id: 'seg-1' } },
        },
      ],
    },
  ],
  reasonPackets: [
    {
      packetKind: 'reason',
      rank: 1,
      packetId: 'time-window',
      reasonCode: 'TIME_WINDOW',
      count: 2,
      districtCount: 1,
      segmentCount: 1,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestDistrictId: 'xinyi',
      latestSegmentId: 'seg-1',
      latestSegmentName: 'C2 curb',
      relatedDistricts: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          count: 2,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Newest issue',
        },
      ],
      relatedSegments: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          count: 2,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Newest issue',
        },
      ],
      recentIssues: [
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
          bundle: { selectedSegment: { id: 'seg-1' } },
        },
      ],
    },
  ],
})

describe('issueReportSummaryPacketFiles', () => {
  it('writes a packet directory with summary and per-packet json files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-packets-'))
    const outPath = path.join(base, 'packets')
    const csvRootPath = path.join(base, 'csv')
    const csvPath = path.join(csvRootPath, 'publish-gate-districts.csv')
    await fs.mkdir(csvRootPath, { recursive: true })
    await fs.writeFile(csvPath, 'district_id,warn\nxinyi,1\n', 'utf8')

    const result = await writeIssueReportTriagePacketBundle(
      outPath,
      createBundle(),
      {
        packetRootUrl: 'https://example.com/issue-packets',
        csvWrite: {
          rootPath: csvRootPath,
          filePaths: [csvPath],
        },
        csvRootUrl: 'https://example.com/issue-csv',
      },
    )

    expect(result.rootPath).toBe(outPath)
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '# Issue Report Triage Packets',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Manifest schema: issue-report-triage-packets v1',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'CSV exchange root URL: https://example.com/issue-csv',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '## Publish Gate',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '| strict | 0 | 0 | 1 | 2 | yes | ci fixture override |',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '| xinyi | 1 | 2 | 3 | 1 | 2 | top-segments/01-alpha-xinyi-seg-1.json | https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json |',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'top-segments/01-alpha-xinyi-seg-1.json',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'https://example.com/issue-packets/top-reasons/01-time-window.json',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'top-reasons/01-time-window.json',
    )
    await expect(fs.readFile(result.segmentPacketPaths[0]!, 'utf8')).resolves.toContain(
      '"packetKind": "segment"',
    )
    await expect(fs.readFile(result.reasonPacketPaths[0]!, 'utf8')).resolves.toContain(
      '"packetKind": "reason"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"artifactType": "issue-report-triage-packets"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"schemaVersion": 1',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"summaryRelativePath": "summary.md"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"packetRootUrl": "https://example.com/issue-packets"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"packetBaseUrl": null',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"summaryUrl": "https://example.com/issue-packets/summary.md"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"csvRootUrl": "https://example.com/issue-csv"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"csvBaseUrl": null',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"issueHotspotPacketUrl": "https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"url": "https://example.com/issue-csv/publish-gate-districts.csv"',
    )
  })
})
