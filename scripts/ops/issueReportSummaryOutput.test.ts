import { describe, expect, it } from 'vitest'
import {
  renderIssueReportSummaryBundleHandoff,
  renderIssueReportSummaryArtifactsHandoff,
  renderIssueReportSummary,
  renderIssueReportSummaryWithArtifacts,
  renderIssueReportSummaryWithPublishGate,
} from './issueReportSummaryOutput'
import type { IssueReportSummaryJsonOutput } from './issueReportSummaryTypes'

describe('issueReportSummaryOutput', () => {
  it('renders summary and recent issue tables', () => {
    const output = renderIssueReportSummary({
      storageFile: 'C:/tmp/sync-service.json',
      storeExists: true,
      totalCount: 3,
      filteredCount: 2,
      filters: {
        scope: 'workspace',
        districtId: 'xinyi',
        segmentId: 'seg-1',
        reasonCode: 'TIME_WINDOW',
        since: '2026-04-02T11:00:00.000Z',
      },
      summaries: [
        {
          scope: 'workspace',
          districtId: 'xinyi',
          count: 2,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Issue with | separator',
        },
      ],
      segmentSummaries: [
        {
          scope: 'workspace',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          count: 1,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Issue with | separator',
        },
      ],
      topDistricts: [
        {
          scope: 'workspace',
          districtId: 'xinyi',
          count: 2,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Issue with | separator',
        },
      ],
      latestDistricts: [
        {
          scope: 'workspace',
          districtId: 'xinyi',
          count: 2,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Issue with | separator',
        },
      ],
      topSegments: [
        {
          scope: 'workspace',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          count: 1,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Issue with | separator',
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
          scope: 'workspace',
          issueId: 'issue-a',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          allowedNow: 'PARK',
          reasonCodes: ['TIME_WINDOW'],
          bundleGeneratedAt: '2026-04-02T12:00:00.000Z',
          reportHhmm: '22:30',
          includeInferred: false,
          summary: 'Issue with | separator',
          createdAt: '2026-04-02T12:00:00.000Z',
        },
        {
          scope: 'workspace',
          issueId: 'issue-b',
          districtId: 'xinyi',
          segmentId: null,
          segmentName: null,
          segmentTier: null,
          allowedNow: null,
          reasonCodes: [],
          bundleGeneratedAt: null,
          reportHhmm: null,
          includeInferred: null,
          summary: 'Second issue',
          createdAt: '2026-04-02T11:30:00.000Z',
        },
      ],
      rawIssues: [],
    })

    expect(output).toContain('Summary by scope/district:')
    expect(output).toContain('Top recurring districts:')
    expect(output).toContain('Latest affected districts:')
    expect(output).toContain('Top recurring segments:')
    expect(output).toContain('Top recurring reasons:')
    expect(output).toContain('Summary by segment:')
    expect(output).toContain('Recent issue reports (showing 2 of 2):')
    expect(output).toContain('Issue with \\| separator')
    expect(output).toContain('segment=seg-1')
    expect(output).toContain('reason=TIME_WINDOW')
    expect(output).toContain('C2 curb (seg-1)')
    expect(output).toContain('| workspace | xinyi | 2 |')
  })

  it('renders missing store state clearly', () => {
    expect(
      renderIssueReportSummary({
        storageFile: 'C:/tmp/missing.json',
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
      }),
    ).toContain('No sync store file was found.')
  })

  it('can append compact publish gate summary details', () => {
    const output = renderIssueReportSummaryWithPublishGate(
      {
        storageFile: 'C:/tmp/sync-service.json',
        storeExists: true,
        totalCount: 1,
        filteredCount: 1,
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
      },
      {
        generatedAt: '2026-04-06T00:00:00.000Z',
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
    )

    expect(output).toContain('Publish gate summary:')
    expect(output).toContain('| strict | 0 | 0 | 1 | 2 | yes | ci fixture override |')
    expect(output).toContain('Top publish gate districts:')
    expect(output).toContain('| xinyi | 1 | 2 | 3 | 1 | 2 | - |')
  })

  it('maps publish gate districts onto top issue hotspots when available', () => {
    const output = renderIssueReportSummaryWithPublishGate(
      {
        storageFile: 'C:/tmp/sync-service.json',
        storeExists: true,
        totalCount: 2,
        filteredCount: 2,
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
        topSegments: [
          {
            scope: 'alpha',
            districtId: 'xinyi',
            segmentId: 'seg-1',
            segmentName: 'C2 curb',
            segmentTier: 'GREEN',
            count: 2,
            latestCreatedAt: '2026-04-06T00:00:00.000Z',
            latestSummary: 'Hotspot',
          },
        ],
        topReasons: [],
        issues: [],
        rawIssues: [],
      },
      {
        generatedAt: '2026-04-06T00:00:00.000Z',
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
    )

    expect(output).toContain('| xinyi | 1 | 2 | 3 | 1 | 2 | C2 curb (seg-1) |')
  })

  it('renders canonical manual handoff when a saved summary export exists', () => {
    const result = {
      storageFile: 'C:/tmp/sync-service.json',
      storeExists: true,
      totalCount: 1,
      filteredCount: 1,
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
    }
    const summary: IssueReportSummaryJsonOutput = {
      ...result,
      artifactType: 'issue-report-summary-json',
      schemaVersion: 1,
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: 'C:/tmp/issue-summary.md',
        summaryRelativePath: 'issue-summary.md',
        summaryUrl: 'https://example.com/manual/issue-summary.md',
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath: null,
        csvRootUrl: null,
        csvBaseUrl: null,
        preferredCsvPath: null,
        preferredCsvRelativePath: null,
        preferredCsvUrl: null,
        csvPaths: [],
        csvRelativePaths: [],
        packetRootPath: null,
        packetRootUrl: null,
        packetBaseUrl: null,
        packetSummaryPath: null,
        packetSummaryRelativePath: null,
        packetSummaryUrl: null,
        packetManifestPath: null,
        packetManifestRelativePath: null,
        packetManifestUrl: null,
        packetPaths: [],
        packetRelativePaths: [],
      },
    }

    const handoff = renderIssueReportSummaryArtifactsHandoff(
      'C:/tmp/issue-summary.md',
      summary,
    )
    expect(handoff).toContain('Input surface: issue-report-summary-json')
    expect(handoff).toContain('Canonical full-index handoff: issue-summary-index.md')
    expect(handoff).toContain(
      'Preferred portable input: artifacts-manifest.json',
    )

    const output = renderIssueReportSummaryWithArtifacts({
      result,
      publishGateSummary: null,
      summaryPath: 'C:/tmp/issue-summary.md',
      summary,
    })
    expect(output).toContain('Artifact handoff:')
    expect(output).toContain('Canonical full-index URL: https://example.com/manual/issue-summary-index.md')
    expect(output).toContain('Fallback compatibility input: issue-summary-index.md')
  })

  it('renders packet and csv handoff details when bundle exports exist', () => {
    const summary: IssueReportSummaryJsonOutput = {
      storageFile: 'C:/tmp/sync-service.json',
      storeExists: true,
      totalCount: 2,
      filteredCount: 2,
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
      artifactType: 'issue-report-summary-json',
      schemaVersion: 1,
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: null,
        summaryRelativePath: null,
        summaryUrl: null,
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath: 'C:/tmp/issue-csv',
        csvRootUrl: 'https://example.com/root-canonical-issue-csv',
        csvBaseUrl: 'https://example.com/issue-csv',
        preferredCsvPath: 'C:/tmp/issue-csv/publish-gate-districts.csv',
        preferredCsvRelativePath: 'publish-gate-districts.csv',
        preferredCsvUrl: 'https://example.com/issue-csv/publish-gate-districts.csv',
        csvPaths: [
          'C:/tmp/issue-csv/top-segments.csv',
          'C:/tmp/issue-csv/publish-gate-districts.csv',
        ],
        csvRelativePaths: [
          'top-segments.csv',
          'publish-gate-districts.csv',
        ],
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: 'https://example.com/root-canonical-issue-packets',
        packetBaseUrl: 'https://example.com/issue-packets',
        packetSummaryPath: 'C:/tmp/issue-packets/summary.md',
        packetSummaryRelativePath: 'summary.md',
        packetSummaryUrl: 'https://example.com/issue-packets/summary.md',
        packetManifestPath: 'C:/tmp/issue-packets/manifest.json',
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: 'https://example.com/issue-packets/manifest.json',
        packetPaths: [
          'C:/tmp/issue-packets/summary.md',
          'C:/tmp/issue-packets/manifest.json',
          'C:/tmp/issue-packets/top-segments/01-seg-1.json',
        ],
        packetRelativePaths: [
          'summary.md',
          'manifest.json',
          'top-segments/01-seg-1.json',
        ],
      },
    }

    const output = renderIssueReportSummaryBundleHandoff(summary)
    expect(output).toContain('Packet handoff:')
    expect(output).toContain('Preferred portable input: C:/tmp/issue-packets/manifest.json')
    expect(output).toContain(
      'Preferred portable input URL: https://example.com/issue-packets/manifest.json',
    )
    expect(output).toContain('Human packet index: C:/tmp/issue-packets/summary.md')
    expect(output).toContain('Packet root URL: https://example.com/root-canonical-issue-packets')
    expect(output).toContain('Legacy packet base URL: https://example.com/issue-packets')
    expect(output).toContain('CSV handoff:')
    expect(output).toContain('Exchange root: C:/tmp/issue-csv')
    expect(output).toContain('Exchange root URL: https://example.com/root-canonical-issue-csv')
    expect(output).toContain('Legacy CSV base URL: https://example.com/issue-csv')
    expect(output).toContain('Preferred join file: C:/tmp/issue-csv/publish-gate-districts.csv')
    expect(output).toContain(
      'Preferred join file URL: https://example.com/issue-csv/publish-gate-districts.csv',
    )
  })

  it('falls back to legacy packet and csv root URLs without rendering same-as-root compat aliases', () => {
    const summary: IssueReportSummaryJsonOutput = {
      storageFile: 'C:/tmp/sync-service.json',
      storeExists: true,
      totalCount: 2,
      filteredCount: 2,
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
      artifactType: 'issue-report-summary-json',
      schemaVersion: 1,
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: null,
        summaryRelativePath: null,
        summaryUrl: null,
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath: 'C:/tmp/issue-csv',
        csvRootUrl: null,
        csvBaseUrl: 'https://legacy.example.com/issue-csv',
        preferredCsvPath: 'C:/tmp/issue-csv/publish-gate-districts.csv',
        preferredCsvRelativePath: 'publish-gate-districts.csv',
        preferredCsvUrl: null,
        csvPaths: ['C:/tmp/issue-csv/publish-gate-districts.csv'],
        csvRelativePaths: ['publish-gate-districts.csv'],
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: null,
        packetBaseUrl: 'https://legacy.example.com/issue-packets',
        packetSummaryPath: 'C:/tmp/issue-packets/summary.md',
        packetSummaryRelativePath: 'summary.md',
        packetSummaryUrl: null,
        packetManifestPath: 'C:/tmp/issue-packets/manifest.json',
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: null,
        packetPaths: [
          'C:/tmp/issue-packets/summary.md',
          'C:/tmp/issue-packets/manifest.json',
        ],
        packetRelativePaths: ['summary.md', 'manifest.json'],
      },
    }

    const output = renderIssueReportSummaryBundleHandoff(summary)
    expect(output).toContain('Packet root URL: https://legacy.example.com/issue-packets')
    expect(output).toContain(
      'Preferred portable input URL: https://legacy.example.com/issue-packets/manifest.json',
    )
    expect(output).toContain(
      'Human packet index URL: https://legacy.example.com/issue-packets/summary.md',
    )
    expect(output).not.toContain('Legacy packet base URL:')
    expect(output).toContain('Exchange root URL: https://legacy.example.com/issue-csv')
    expect(output).toContain(
      'Preferred join file URL: https://legacy.example.com/issue-csv/publish-gate-districts.csv',
    )
    expect(output).not.toContain('Legacy CSV base URL:')
  })
})
