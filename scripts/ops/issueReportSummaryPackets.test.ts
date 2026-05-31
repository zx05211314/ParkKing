import { describe, expect, it } from 'vitest'
import { buildIssueReportTriagePacketBundle } from './issueReportSummaryPackets'
import type { IssueReportSummaryResult } from './issueReportSummaryTypes'

const createResult = (): IssueReportSummaryResult => ({
  storageFile: 'C:/tmp/sync-service.json',
  storeExists: true,
  totalCount: 4,
  filteredCount: 4,
  filters: {
    scope: null,
    districtId: null,
    segmentId: null,
    reasonCode: null,
    since: null,
  },
  summaries: [
    {
      scope: 'alpha',
      districtId: 'xinyi',
      count: 3,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Newest segment issue',
    },
    {
      scope: 'alpha',
      districtId: 'daan',
      count: 1,
      latestCreatedAt: '2026-04-02T09:00:00.000Z',
      latestSummary: 'District-only issue',
    },
  ],
  segmentSummaries: [
    {
      scope: 'alpha',
      districtId: 'xinyi',
      segmentId: 'seg-1',
      segmentName: 'C2 curb',
      segmentTier: 'YELLOW',
      count: 2,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Newest segment issue',
    },
    {
      scope: 'alpha',
      districtId: 'xinyi',
      segmentId: 'seg-2',
      segmentName: 'B1 curb',
      segmentTier: 'RED',
      count: 1,
      latestCreatedAt: '2026-04-02T11:00:00.000Z',
      latestSummary: 'Older segment issue',
    },
  ],
  topDistricts: [],
  latestDistricts: [],
  topSegments: [
    {
      scope: 'alpha',
      districtId: 'xinyi',
      segmentId: 'seg-1',
      segmentName: 'C2 curb',
      segmentTier: 'YELLOW',
      count: 2,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Newest segment issue',
    },
  ],
  topReasons: [
    {
      reasonCode: 'TIME_WINDOW',
      count: 2,
      districtCount: 1,
      segmentCount: 2,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestDistrictId: 'xinyi',
      latestSegmentId: 'seg-1',
      latestSegmentName: 'C2 curb',
    },
  ],
  issues: [],
  rawIssues: [
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
      summary: 'Newest segment issue',
      createdAt: '2026-04-02T12:00:00.000Z',
      bundle: { selectedSegment: { id: 'seg-1' } },
    },
    {
      scope: 'alpha',
      issueId: 'issue-b',
      districtId: 'xinyi',
      segmentId: 'seg-1',
      segmentName: 'C2 curb',
      segmentTier: 'YELLOW',
      allowedNow: 'PARK',
      reasonCodes: ['TIME_WINDOW'],
      bundleGeneratedAt: '2026-04-02T11:01:00.000Z',
      reportHhmm: '22:15',
      includeInferred: false,
      summary: 'Second segment issue',
      createdAt: '2026-04-02T11:30:00.000Z',
      bundle: { selectedSegment: { id: 'seg-1' } },
    },
    {
      scope: 'alpha',
      issueId: 'issue-c',
      districtId: 'xinyi',
      segmentId: 'seg-2',
      segmentName: 'B1 curb',
      segmentTier: 'RED',
      allowedNow: 'NO_STOP',
      reasonCodes: ['TIME_WINDOW'],
      bundleGeneratedAt: '2026-04-02T11:00:00.000Z',
      reportHhmm: '21:45',
      includeInferred: true,
      summary: 'Older segment issue',
      createdAt: '2026-04-02T11:00:00.000Z',
      bundle: { selectedSegment: { id: 'seg-2' } },
    },
    {
      scope: 'alpha',
      issueId: 'issue-d',
      districtId: 'daan',
      segmentId: null,
      segmentName: null,
      segmentTier: null,
      allowedNow: null,
      reasonCodes: [],
      bundleGeneratedAt: null,
      reportHhmm: null,
      includeInferred: null,
      summary: 'District-only issue',
      createdAt: '2026-04-02T09:00:00.000Z',
      bundle: null,
    },
  ],
})

describe('issueReportSummaryPackets', () => {
  it('builds limited segment and reason triage packets from hotspot summaries', () => {
    const bundle = buildIssueReportTriagePacketBundle(
      createResult(),
      2,
      {
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
      '2026-04-02T13:00:00.000Z',
    )

    expect(bundle).toMatchObject({
      generatedAt: '2026-04-02T13:00:00.000Z',
      filteredCount: 4,
      publishGateSummary: {
        totals: {
          warn: 1,
          fail: 2,
        },
      },
      segmentPackets: [
        {
          packetKind: 'segment',
          rank: 1,
          packetId: 'alpha-xinyi-seg-1',
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          count: 2,
          reasonCounts: [
            { reasonCode: 'TIME_WINDOW', count: 2 },
            { reasonCode: 'SIGN_OVERRIDE', count: 1 },
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
          segmentCount: 2,
        },
      ],
    })

    expect(bundle.segmentPackets[0]?.recentIssues.map((issue) => issue.issueId)).toEqual([
      'issue-a',
      'issue-b',
    ])
    expect(bundle.reasonPackets[0]?.recentIssues.map((issue) => issue.issueId)).toEqual([
      'issue-a',
      'issue-b',
    ])
    expect(bundle.reasonPackets[0]?.relatedSegments.map((segment) => segment.segmentId)).toEqual([
      'seg-1',
      'seg-2',
    ])
    expect(bundle.reasonPackets[0]?.relatedDistricts.map((district) => district.districtId)).toEqual([
      'xinyi',
    ])
  })
})
