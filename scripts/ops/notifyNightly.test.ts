import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'

import { buildIssueReportArtifactIndex } from './issueReportArtifactIndex'
import { buildIssueReportArtifactSummaryJsonOutput } from './issueReportArtifactSummary'
import { buildIssueReportArtifactSummaryJsonSurfaceSummary } from './issueReportArtifactSummaryJson'
import { buildIssueReportSummaryJsonOutput as buildIssueReportSummaryExportJsonOutput } from './issueReportSummary'
import { buildIssueReportSummaryIndex } from './issueReportSummaryIndex'
import { buildIssueReportWorkflowArtifacts } from './issueReportWorkflowArtifacts'
import type { SyncServiceStore } from './syncServiceTypes'
import {
  buildIssueReportSummaryArtifacts,
} from './issueReportSummaryArtifacts'
import {
  buildNightlyIssueBody,
  collectNightlyAlerts,
  collectNightlyIssueReports,
  loadNightlyIssueArtifacts,
  loadNightlyIssueReports,
  resolveDiffPaths,
} from './notifyNightly'

describe('notifyNightly', () => {
  it('resolves diff path from directory', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-'))
    const diffPath = path.join(base, 'diff_report.json')
    await fs.writeFile(diffPath, '{}', 'utf-8')

    const resolved = await resolveDiffPaths([base])
    expect(resolved).toEqual([diffPath])
  })

  it('resolves diff path from file', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-file-'))
    const diffPath = path.join(base, 'diff_report.json')
    await fs.writeFile(diffPath, '{}', 'utf-8')

    const resolved = await resolveDiffPaths([diffPath])
    expect(resolved).toEqual([diffPath])
  })

  it('throws usage error when diff is missing', async () => {
    await expect(resolveDiffPaths([])).rejects.toThrow('Usage:')
  })

  it('builds issue body with publish gate, WARN/FAIL entries, and synced issue reports', () => {
    const alerts = collectNightlyAlerts([
      {
        districts: [
          {
            districtId: 'xinyi',
            severity: 'WARN',
            meta: {
              segmentsCount: { deltaPct: -0.2 },
              signOverrideMatchedSegmentCount: { delta: 3 },
              signOverrideSpatialMatchCount: { delta: 1 },
              signOverrideUnmatchedNamedCount: { delta: 2 },
              curbMarkingKnownRate: { delta: -0.12 },
              restrictionTriggeredRate: { delta: -0.02 },
            },
          },
          {
            districtId: 'daan',
            severity: 'FAIL',
            meta: {
              segmentsCount: { deltaPct: -1 },
              signOverrideMatchedSegmentCount: { delta: -1 },
              signOverrideSpatialMatchCount: { delta: 0 },
              signOverrideUnmatchedNamedCount: { delta: -1 },
              curbMarkingKnownRate: { delta: -0.2 },
              restrictionTriggeredRate: { delta: -0.05 },
            },
          },
        ],
      },
    ])

    const body = buildNightlyIssueBody({
      alerts,
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
        summaryUrl: 'https://example.com/publish-gate-summary',
      },
      issueReports: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          count: 2,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Issue report for C2 segment',
        },
      ],
      topIssueSegments: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentTier: 'YELLOW',
          count: 2,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Issue report for C2 segment',
        },
      ],
      topIssueReasons: [
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
      issueArtifacts: {
        indexUrl: 'https://example.com/issue-index',
        indexPath: null,
        workflowSummaryUrl: 'https://example.com/issue-index/summary.md',
        workflowSummaryPath: '.tmp/nightly-issue-artifacts/summary.md',
        workflowSummaryRelativePath: 'summary.md',
        indexSummaryUrl: 'https://example.com/issue-index/index-summary.md',
        indexSummaryPath: '.tmp/nightly-issue-artifacts/index-summary.md',
        indexSummaryRelativePath: 'index-summary.md',
        indexSummaryJsonUrl: 'https://example.com/issue-index/index-summary.json',
        indexSummaryJsonPath: '.tmp/nightly-issue-artifacts/index-summary.json',
        indexSummaryJsonRelativePath: 'index-summary.json',
        indexSurfaceUrl: 'https://example.com/issue-index/index-surface.json',
        indexSurfacePath: '.tmp/nightly-issue-artifacts/index-surface.json',
        indexSurfaceRelativePath: 'index-surface.json',
        packetSummaryUrl: 'https://example.com/issue-packets',
        packetSummaryPath: '.tmp/nightly-issue-packets/summary.md',
        packetSummaryRelativePath: 'summary.md',
        packetManifestUrl: 'https://example.com/issue-packets/manifest.json',
        packetManifestPath: '.tmp/nightly-issue-packets/manifest.json',
        packetManifestRelativePath: 'manifest.json',
        packetRootPath: '.tmp/nightly-issue-packets',
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootPath: '.tmp/nightly-issue-csv',
        csvRootUrl: 'https://example.com/issue-csv',
        preferredCsvUrl: 'https://example.com/issue-csv/publish-gate-districts.csv',
        preferredCsvPath: '.tmp/nightly-issue-csv/publish-gate-districts.csv',
        preferredCsvRelativePath: 'publish-gate-districts.csv',
        packetUrl: 'https://example.com/issue-packets',
        csvUrl: 'https://example.com/issue-csv',
      },
      runUrl: 'https://example.com/run',
    })

    expect(body).toContain('Publish gate summary:')
    expect(body).toContain('| strict | 0 | 0 | 1 | 2 | yes | ci fixture override |')
    expect(body).toContain('Top publish gate districts:')
    expect(body).toContain(
      '| xinyi | 1 | 2 | METRIC_SIGN_OVERRIDE_UNMATCHED | HASH_MISMATCH | +3 | +1 | +2 |',
    )
    expect(body).toContain('[download artifact](https://example.com/publish-gate-summary)')
    expect(body).toContain('xinyi')
    expect(body).toContain('WARN')
    expect(body).toContain('daan')
    expect(body).toContain('FAIL')
    expect(body).toContain('Segments delta %')
    expect(body).toContain('Direct override match ?')
    expect(body).toContain('Spatial override match ?')
    expect(body).toContain('Unmatched named overrides ?')
    expect(body).toContain('Curb known delta')
    expect(body).toContain('| xinyi | WARN | -20.0% | +3 | +1 | +2 |')
    expect(body).toContain('Synced user issue reports:')
    expect(body).toContain('Issue report for C2 segment')
    expect(body).toContain('Top recurring issue segments:')
    expect(body).toContain('C2 curb (seg-1)')
    expect(body).toContain('Top recurring issue reasons:')
    expect(body).toContain('TIME_WINDOW')
    expect(body).toContain('Issue triage artifacts:')
    expect(body).toContain('[download artifact](https://example.com/issue-index)')
    expect(body).toContain('Issue workflow summary: [download artifact](https://example.com/issue-index/summary.md) (summary.md)')
    expect(body).toContain('Issue index summary: [download artifact](https://example.com/issue-index/index-summary.md) (index-summary.md)')
    expect(body).toContain('Issue index summary json: [download artifact](https://example.com/issue-index/index-summary.json) (index-summary.json)')
    expect(body).toContain('Issue index surface: [download artifact](https://example.com/issue-index/index-surface.json) (index-surface.json)')
    expect(body).toContain('Packet summary: [download artifact](https://example.com/issue-packets) (summary.md)')
    expect(body).toContain('Packet preferred portable input: [download artifact](https://example.com/issue-packets/manifest.json) (manifest.json)')
    expect(body).toContain('Packet root: .tmp/nightly-issue-packets')
    expect(body).toContain('Packet root URL: [download artifact](https://example.com/issue-packets)')
    expect(body).toContain('CSV exchange root: .tmp/nightly-issue-csv')
    expect(body).toContain('CSV exchange root URL: [download artifact](https://example.com/issue-csv)')
    expect(body).toContain('Preferred CSV join file: [download artifact](https://example.com/issue-csv/publish-gate-districts.csv) (publish-gate-districts.csv)')
  })

  it('builds issue body for synced issue reports even when diff alerts are empty', () => {
    const body = buildNightlyIssueBody({
      alerts: [],
      issueReports: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          count: 1,
          latestCreatedAt: '2026-04-02T13:00:00.000Z',
          latestSummary: 'Issue report without diff warning',
        },
      ],
      runUrl: 'https://example.com/run',
    })

    expect(body).toContain('No WARN/FAIL districts found in diff reports.')
    expect(body).toContain('Synced user issue reports:')
    expect(body).toContain('Issue report without diff warning')
  })

  it('renders publish gate summary even without diff alerts or synced issue reports', () => {
    const body = buildNightlyIssueBody({
      alerts: [],
      publishGateSummary: {
        generatedAt: '2026-04-02T13:00:00.000Z',
        mode: 'strict',
        exitCode: 1,
        allowWarn: false,
        allowFail: false,
        overrideReason: null,
        totals: {
          info: 0,
          warn: 0,
          fail: 1,
        },
        topDistricts: [
          {
            districtId: 'xinyi',
            warn: 0,
            fail: 1,
            topWarnCodes: [],
            topFailCodes: ['COUNT_DELTA'],
            signOverrideBreakdown: null,
          },
        ],
        summaryPath: 'public/data/generated/_ops/publish_gate_summary.json',
        summaryUrl: null,
      },
    })

    expect(body).toContain('Publish gate summary:')
    expect(body).toContain('| strict | 1 | 0 | 0 | 1 | no | - |')
    expect(body).toContain('Top publish gate districts:')
    expect(body).toContain('| xinyi | 0 | 1 | - | COUNT_DELTA | - | - | - |')
    expect(body).toContain('No WARN/FAIL districts found in diff reports.')
  })

  it('collects and loads issue report summaries from sync store files', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-sync-'))
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
              summary: 'First issue',
              createdAt: '2026-04-02T11:00:00.000Z',
            },
            {
              issueId: 'issue-b',
              districtId: 'xinyi',
              summary: 'Latest issue',
              createdAt: '2026-04-02T12:00:00.000Z',
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

    expect(collectNightlyIssueReports(store)).toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 2,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Latest issue',
      },
    ])

    await expect(loadNightlyIssueReports(syncStorePath)).resolves.toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 2,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Latest issue',
      },
    ])
  })

  it('loads issue hotspots and writes nightly triage artifacts', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-issues-'))
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
                selectedSegment: {
                  name: 'C2 curb',
                  tier: 'YELLOW',
                  reasonCodes: ['TIME_WINDOW'],
                },
              },
            },
          ],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 1,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    }

    await fs.writeFile(syncStorePath, JSON.stringify(store, null, 2), 'utf-8')

    const result = await loadNightlyIssueArtifacts({
      syncStorePath,
      issueLimit: 3,
      issuePacketOutPath: path.join(base, 'issue-packets'),
      issueCsvOutPath: path.join(base, 'issue-csv'),
      issuePacketIssueLimit: 2,
      issuePacketUrl: 'https://example.com/generated-issue-packets',
      issueCsvUrl: 'https://example.com/generated-issue-csv',
    })

    expect(result.summaries).toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Newest issue',
      },
    ])
    expect(result.topSegments).toEqual([
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
    ])
    expect(result.topReasons).toEqual([
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
    ])
    await expect(
      fs.readFile(path.join(result.artifacts.packetRootPath!, 'summary.md'), 'utf8'),
    ).resolves.toContain('# Issue Report Triage Packets')
    expect(result.artifacts.packetSummaryPath).toBe(
      path.join(result.artifacts.packetRootPath!, 'summary.md'),
    )
    expect(result.artifacts.packetSummaryUrl).toBe(
      'https://example.com/generated-issue-packets/summary.md',
    )
    expect(result.artifacts.packetSummaryRelativePath).toBe('summary.md')
    expect(result.artifacts.packetManifestPath).toBe(
      path.join(result.artifacts.packetRootPath!, 'manifest.json'),
    )
    expect(result.artifacts.packetManifestRelativePath).toBe('manifest.json')
    await expect(
      fs.readFile(path.join(result.artifacts.csvRootPath!, 'top-segments.csv'), 'utf8'),
    ).resolves.toContain('"alpha","xinyi","seg-1","C2 curb (seg-1)"')
    expect(result.artifacts.preferredCsvPath).toBe(
      path.join(result.artifacts.csvRootPath!, 'top-segments.csv'),
    )
    expect(result.artifacts.preferredCsvRelativePath).toBe('top-segments.csv')
    expect(result.artifacts.preferredCsvUrl).toBe(
      'https://example.com/generated-issue-csv/top-segments.csv',
    )
  })

  it('loads nightly issue hotspots directly from artifact-index.json when provided', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-index-'))
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
                selectedSegment: {
                  name: 'C2 curb',
                  tier: 'YELLOW',
                  reasonCodes: ['TIME_WINDOW'],
                },
              },
            },
          ],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 1,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    }

    await fs.writeFile(syncStorePath, JSON.stringify(store, null, 2), 'utf-8')

    const workflowArtifacts = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath,
        outRoot: path.join(base, 'issue-artifacts'),
        limit: 3,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      base,
    )

    const builtIndex = await buildIssueReportArtifactIndex(workflowArtifacts.manifestPath)
    const index = {
      ...builtIndex,
      rootManifest: {
        ...builtIndex.rootManifest,
        packetRootUrl: null,
        packetArtifactUrl: null,
        csvRootUrl: null,
        csvArtifactUrl: null,
        preferredCsvUrl: 'https://example.com/issue-csv/root-preferred-top-segments.csv',
        packetSummaryPath: path.join(base, 'issue-artifacts', 'packets', 'root-summary.md'),
        packetSummaryRelativePath: 'root-summary.md',
        packetSummaryUrl: 'https://example.com/issue-packets/root-summary.md',
        packetManifestPath: path.join(base, 'issue-artifacts', 'packets', 'root-manifest.json'),
        packetManifestRelativePath: 'root-manifest.json',
        packetManifestUrl: 'https://example.com/issue-packets/root-manifest.json',
      },
      preferredCsvFile: builtIndex.preferredCsvFile
        ? {
            ...builtIndex.preferredCsvFile,
            url: 'https://example.com/issue-csv/packet-preferred-top-segments.csv',
          }
        : null,
    }
    const indexPath = path.join(base, 'issue-artifacts', 'artifact-index.json')
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8')

    const result = await loadNightlyIssueArtifacts({
      syncStorePath: path.join(base, 'missing-sync-service.json'),
        issueInputPath: indexPath,
      issueLimit: 3,
      issuePacketOutPath: null,
      issueCsvOutPath: null,
      issuePacketIssueLimit: 2,
    })

    expect(result.summaries).toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Newest issue',
      },
    ])
    expect(result.topSegments).toEqual([
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
    ])
    expect(result.topReasons).toEqual([
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
    ])
    expect(result.artifacts.indexPath).toBe(indexPath)
    expect(result.artifacts.workflowSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'summary.md'),
    )
    expect(result.artifacts.workflowSummaryRelativePath).toBe('summary.md')
    expect(result.artifacts.indexSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'index-summary.md'),
    )
    expect(result.artifacts.indexSummaryRelativePath).toBe('index-summary.md')
    expect(result.artifacts.indexSurfacePath).toBe(
      path.join(base, 'issue-artifacts', 'index-surface.json'),
    )
    expect(result.artifacts.indexSurfaceRelativePath).toBe('index-surface.json')
    expect(result.artifacts.packetSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'packets', 'root-summary.md'),
    )
    expect(result.artifacts.packetSummaryRelativePath).toBe('root-summary.md')
    expect(result.artifacts.packetSummaryUrl).toBe(
      'https://example.com/issue-packets/root-summary.md',
    )
    expect(result.artifacts.packetManifestPath).toBe(
      path.join(base, 'issue-artifacts', 'packets', 'root-manifest.json'),
    )
    expect(result.artifacts.packetManifestRelativePath).toBe('root-manifest.json')
    expect(result.artifacts.packetRootUrl).toBe('https://example.com/issue-packets')
    expect(result.artifacts.csvRootUrl).toBe('https://example.com/issue-csv')
    expect(result.artifacts.packetUrl).toBe('https://example.com/issue-packets')
    expect(result.artifacts.csvUrl).toBe('https://example.com/issue-csv')
    expect(result.artifacts.preferredCsvRelativePath).toBe('top-segments.csv')
    expect(result.artifacts.preferredCsvUrl).toBe(
      'https://example.com/issue-csv/root-preferred-top-segments.csv',
    )
  })

  it('loads nightly issue hotspots directly from index-surface.json when provided', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-surface-'))
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
                selectedSegment: {
                  name: 'C2 curb',
                  tier: 'YELLOW',
                  reasonCodes: ['TIME_WINDOW'],
                },
              },
            },
          ],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 1,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    }

    await fs.writeFile(syncStorePath, JSON.stringify(store, null, 2), 'utf-8')

    const workflowArtifacts = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath,
        outRoot: path.join(base, 'issue-artifacts'),
        limit: 3,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      base,
    )

    const index = await buildIssueReportArtifactIndex(workflowArtifacts.manifestPath)
    const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index: {
        ...index,
        rootManifest: {
          ...index.rootManifest,
          packetSummaryPath: path.join(base, 'issue-artifacts', 'packets', 'root-summary.md'),
          packetSummaryRelativePath: 'root-summary.md',
          packetSummaryUrl: 'https://example.com/issue-packets/root-summary.md',
          packetManifestPath: path.join(base, 'issue-artifacts', 'packets', 'root-manifest.json'),
          packetManifestRelativePath: 'root-manifest.json',
          packetManifestUrl: 'https://example.com/issue-packets/root-manifest.json',
        },
      },
      options: {
        label: 'Nightly',
        inputArtifactType: 'issue-report-artifact-index',
        topCount: 3,
      },
    })
    const summaryPath = path.join(base, 'issue-artifacts', 'index-summary.json')
    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')
    const surfacePath = path.join(base, 'issue-artifacts', 'index-surface.json')
    const overriddenPacketRootPath = path.join(base, 'surface-root-canonical-packets')
    const overriddenCsvRootPath = path.join(base, 'surface-root-canonical-csv')
    const legacyPacketBaseUrl = 'https://legacy.example.com/issue-packets-base'
    const legacyCsvBaseUrl = 'https://legacy.example.com/issue-csv-base'
    await fs.writeFile(
      surfacePath,
      JSON.stringify(
        {
          ...buildIssueReportArtifactSummaryJsonSurfaceSummary({
            summaryPath,
            summary: summaryJson,
          }),
          packetRootPath: overriddenPacketRootPath,
          packetRootUrl: null,
          packetBaseUrl: legacyPacketBaseUrl,
          packetSummaryUrl: null,
          packetManifestUrl: null,
          csvRootPath: overriddenCsvRootPath,
          csvRootUrl: null,
          csvBaseUrl: legacyCsvBaseUrl,
          preferredCsvUrl: null,
        },
        null,
        2,
      ),
      'utf8',
    )

    const result = await loadNightlyIssueArtifacts({
      syncStorePath: path.join(base, 'missing-sync-service.json'),
        issueInputPath: surfacePath,
      issueLimit: 3,
      issuePacketOutPath: null,
      issueCsvOutPath: null,
      issuePacketIssueLimit: 2,
    })

    expect(result.summaries).toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Newest issue',
      },
    ])
    expect(result.topSegments).toEqual([
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
    ])
    expect(result.topReasons).toEqual([
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
    ])
    expect(result.artifacts.indexPath).toBe(
      path.join(base, 'issue-artifacts', 'artifact-index.json'),
    )
    expect(result.artifacts.workflowSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'summary.md'),
    )
    expect(result.artifacts.indexSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'index-summary.md'),
    )
    expect(result.artifacts.indexSurfacePath).toBe(surfacePath)
    expect(result.artifacts.indexSurfaceRelativePath).toBe('index-surface.json')
    expect(result.artifacts.packetRootPath).toBe(
      overriddenPacketRootPath,
    )
    expect(result.artifacts.packetSummaryPath).toBe(
      path.join(overriddenPacketRootPath, 'root-summary.md'),
    )
    expect(result.artifacts.packetSummaryUrl).toBe(
      `${legacyPacketBaseUrl}/root-summary.md`,
    )
    expect(result.artifacts.csvRootPath).toBe(
      overriddenCsvRootPath,
    )
    expect(result.artifacts.packetManifestPath).toBe(
      path.join(overriddenPacketRootPath, 'root-manifest.json'),
    )
    expect(result.artifacts.packetManifestRelativePath).toBe('root-manifest.json')
    expect(result.artifacts.packetManifestUrl).toBe(
      `${legacyPacketBaseUrl}/root-manifest.json`,
    )
    expect(result.artifacts.preferredCsvRelativePath).toBe('top-segments.csv')
    expect(result.artifacts.preferredCsvUrl).toBe(
      `${legacyCsvBaseUrl}/top-segments.csv`,
    )
    expect(result.artifacts.packetRootUrl).toBe(legacyPacketBaseUrl)
    expect(result.artifacts.csvRootUrl).toBe(legacyCsvBaseUrl)
    expect(result.artifacts.packetUrl).toBe(legacyPacketBaseUrl)
    expect(result.artifacts.csvUrl).toBe(legacyCsvBaseUrl)
  })

  it('loads nightly issue hotspots directly from index-summary.json when provided', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-summary-json-'))
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
                selectedSegment: {
                  name: 'C2 curb',
                  tier: 'YELLOW',
                  reasonCodes: ['TIME_WINDOW'],
                },
              },
            },
          ],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 1,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    }

    await fs.writeFile(syncStorePath, JSON.stringify(store, null, 2), 'utf-8')

    const workflowArtifacts = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath,
        outRoot: path.join(base, 'issue-artifacts'),
        limit: 3,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      base,
    )

    const index = await buildIssueReportArtifactIndex(workflowArtifacts.manifestPath)
    const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index,
      options: {
        label: 'Nightly',
        inputArtifactType: 'issue-report-artifact-index',
        topCount: 3,
      },
    })
    const summaryPath = path.join(base, 'issue-artifacts', 'index-summary.json')
    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')

    const result = await loadNightlyIssueArtifacts({
      syncStorePath: path.join(base, 'missing-sync-service.json'),
        issueInputPath: summaryPath,
      issueLimit: 3,
      issuePacketOutPath: null,
      issueCsvOutPath: null,
      issuePacketIssueLimit: 2,
    })

    expect(result.summaries).toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Newest issue',
      },
    ])
    expect(result.topSegments).toEqual([
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
    ])
    expect(result.topReasons).toEqual([
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
    ])
    expect(result.artifacts.indexPath).toBe(
      path.join(base, 'issue-artifacts', 'artifact-index.json'),
    )
    expect(result.artifacts.workflowSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'summary.md'),
    )
    expect(result.artifacts.indexSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'index-summary.md'),
    )
    expect(result.artifacts.indexSurfacePath).toBe(
      path.join(base, 'issue-artifacts', 'index-surface.json'),
    )
    expect(result.artifacts.indexSurfaceRelativePath).toBe('index-surface.json')
    expect(result.artifacts.packetRootPath).toBe(
      path.join(base, 'issue-artifacts', 'packets'),
    )
    expect(result.artifacts.packetSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'packets', 'summary.md'),
    )
    expect(result.artifacts.packetSummaryUrl).toBe(
      'https://example.com/issue-packets/summary.md',
    )
    expect(result.artifacts.csvRootPath).toBe(
      path.join(base, 'issue-artifacts', 'csv'),
    )
    expect(result.artifacts.packetUrl).toBe('https://example.com/issue-packets')
    expect(result.artifacts.csvUrl).toBe('https://example.com/issue-csv')
  })

  it('loads nightly issue hotspots directly from issue-report-summary-index.json when provided', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-manual-index-'))
    const summaryPath = path.join(base, 'issue-summary.json')
    const summaryIndexPath = path.join(base, 'issue-summary-index.json')
    const summaryJsonPath = path.join(base, 'index-summary.json')

    const topDistrict = {
      scope: 'alpha',
      districtId: 'xinyi',
      count: 1,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Issue report for C2 curb',
    }
    const topSegment = {
      scope: 'alpha',
      districtId: 'xinyi',
      segmentId: 'seg-1',
      segmentName: 'C2 curb',
      segmentTier: 'GREEN',
      count: 1,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestSummary: 'Issue report for C2 curb',
    }
    const topReason = {
      reasonCode: 'TIME_WINDOW',
      count: 1,
      districtCount: 1,
      segmentCount: 1,
      latestCreatedAt: '2026-04-02T12:00:00.000Z',
      latestDistrictId: 'xinyi',
      latestSegmentId: 'seg-1',
      latestSegmentName: 'C2 curb',
    }

    const summaryJson = buildIssueReportSummaryExportJsonOutput({
      result: {
        storageFile: path.join(base, 'sync-service.json'),
        storeExists: true,
        totalCount: 1,
        filteredCount: 1,
        filters: {
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: null,
          reasonCode: null,
          since: null,
        },
        summaries: [topDistrict],
        segmentSummaries: [topSegment],
        topDistricts: [topDistrict],
        latestDistricts: [topDistrict],
        topSegments: [topSegment],
        topReasons: [topReason],
        issues: [],
        rawIssues: [],
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath,
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: 'https://example.com/manual-summary/issue-summary.json',
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath: null,
        csvBaseUrl: null,
        csvPaths: [],
        csvRelativePaths: [],
        packetRootPath: null,
        packetBaseUrl: null,
        packetSummaryPath: null,
        packetSummaryRelativePath: null,
        packetManifestPath: null,
        packetManifestRelativePath: null,
        packetPaths: [],
        packetRelativePaths: [],
      },
    })

    const summaryIndex = buildIssueReportSummaryIndex({
      summaryPath,
      summary: summaryJson,
      indexPath: summaryIndexPath,
      indexBaseUrl: 'https://example.com/manual-index-base',
    })
    const summarySidecar = buildIssueReportArtifactSummaryJsonOutput({
      index: summaryIndex,
      options: {
        inputArtifactType: 'issue-report-summary-index',
        topCount: 3,
      },
    })

    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')
    await fs.writeFile(summaryIndexPath, JSON.stringify(summaryIndex, null, 2), 'utf8')
    await fs.writeFile(summaryJsonPath, JSON.stringify(summarySidecar, null, 2), 'utf8')

    const result = await loadNightlyIssueArtifacts({
      syncStorePath: path.join(base, 'missing-sync-service.json'),
      issueInputPath: summaryIndexPath,
      issueLimit: 3,
      issuePacketOutPath: null,
      issueCsvOutPath: null,
      issuePacketIssueLimit: 2,
    })

    expect(result.summaries).toEqual([topDistrict])
    expect(result.topSegments).toEqual([topSegment])
    expect(result.topReasons).toEqual([topReason])
    expect(result.artifacts.indexPath).toBe(summaryIndexPath)
    expect(result.artifacts.indexUrl).toBe(
      'https://example.com/manual-index-base/issue-summary-index.json',
    )
    expect(result.artifacts.indexSummaryJsonPath).toBe(summaryJsonPath)
    expect(result.artifacts.indexSummaryJsonRelativePath).toBe('index-summary.json')
    expect(result.artifacts.indexSummaryPath).toBe(path.join(base, 'index-summary.md'))
    expect(result.artifacts.indexSurfacePath).toBe(path.join(base, 'index-surface.json'))
    expect(result.artifacts.packetSummaryPath).toBeNull()
    expect(result.artifacts.packetManifestPath).toBeNull()
    expect(result.artifacts.preferredCsvPath).toBeNull()
  })

  it('loads nightly issue hotspots directly from issue-report-summary-artifacts manifest when provided', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-manual-manifest-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')
    const summaryJson = buildIssueReportSummaryExportJsonOutput({
      result: {
        storageFile: path.join(cwd, 'sync-service.json'),
        storeExists: true,
        totalCount: 1,
        filteredCount: 1,
        filters: {
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: null,
          reasonCode: null,
          since: null,
        },
        summaries: [
          {
            scope: 'alpha',
            districtId: 'xinyi',
            count: 1,
            latestCreatedAt: '2026-04-02T12:00:00.000Z',
            latestSummary: 'Driver could not interpret curb hours',
          },
        ],
        segmentSummaries: [
          {
            scope: 'alpha',
            districtId: 'xinyi',
            segmentId: 'seg-1',
            segmentName: 'C2 curb',
            segmentTier: 'GREEN',
            count: 1,
            latestCreatedAt: '2026-04-02T12:00:00.000Z',
            latestSummary: 'Driver could not interpret curb hours',
          },
        ],
        topDistricts: [
          {
            scope: 'alpha',
            districtId: 'xinyi',
            count: 1,
            latestCreatedAt: '2026-04-02T12:00:00.000Z',
            latestSummary: 'Driver could not interpret curb hours',
          },
        ],
        latestDistricts: [],
        topSegments: [
          {
            scope: 'alpha',
            districtId: 'xinyi',
            segmentId: 'seg-1',
            segmentName: 'C2 curb',
            segmentTier: 'GREEN',
            count: 1,
            latestCreatedAt: '2026-04-02T12:00:00.000Z',
            latestSummary: 'Driver could not interpret curb hours',
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
        issues: [],
        rawIssues: [],
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath,
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: 'https://example.com/manual-summary/issue-summary.json',
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath: null,
        csvBaseUrl: null,
        csvPaths: [],
        csvRelativePaths: [],
        packetRootPath: null,
        packetBaseUrl: null,
        packetSummaryPath: null,
        packetSummaryRelativePath: null,
        packetManifestPath: null,
        packetManifestRelativePath: null,
        packetPaths: [],
        packetRelativePaths: [],
      },
    })
    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')
    const artifacts = await buildIssueReportSummaryArtifacts(
      {
        summaryPath,
        label: 'Manual',
        inputUrl: 'https://example.com/manual-input',
        publishGateSummaryUrl: null,
        topCount: 3,
        indexBaseUrl: 'https://example.com/manual-index-base',
      },
      cwd,
    )

    const result = await loadNightlyIssueArtifacts({
      syncStorePath: null,
      issueInputPath: artifacts.manifestPath,
      issueLimit: 5,
      issuePacketOutPath: null,
      issueCsvOutPath: null,
      issuePacketIssueLimit: 3,
    })

    expect(result.summaries[0]?.districtId).toBe('xinyi')
    expect(result.topSegments[0]?.segmentId).toBe('seg-1')
    expect(result.artifacts.indexPath).toBe(artifacts.indexPath)
    expect(result.artifacts.workflowSummaryPath).toBe(artifacts.indexSummaryPath)
    expect(result.artifacts.indexSummaryJsonPath).toBe(artifacts.indexSummaryJsonPath)
    expect(result.artifacts.indexSurfacePath).toBe(artifacts.indexSurfacePath)
    expect(result.artifacts.packetManifestPath).toBeNull()
    expect(result.artifacts.preferredCsvPath).toBeNull()
  })

  it('loads nightly issue hotspots directly from workflow manifest when provided', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-manifest-'))
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
                selectedSegment: {
                  name: 'C2 curb',
                  tier: 'YELLOW',
                  reasonCodes: ['TIME_WINDOW'],
                },
              },
            },
          ],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 1,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    }

    await fs.writeFile(syncStorePath, JSON.stringify(store, null, 2), 'utf-8')

    const workflowArtifacts = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath,
        outRoot: path.join(base, 'issue-artifacts'),
        limit: 3,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      base,
    )

    const index = await buildIssueReportArtifactIndex(workflowArtifacts.manifestPath)
    const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index,
      options: {
        label: 'Nightly',
        inputArtifactType: 'issue-report-artifact-index',
        topCount: 3,
      },
    })
    const summaryPath = path.join(base, 'issue-artifacts', 'index-summary.json')
    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')
    const surfacePath = path.join(base, 'issue-artifacts', 'index-surface.json')
    await fs.writeFile(
      surfacePath,
      JSON.stringify(
        buildIssueReportArtifactSummaryJsonSurfaceSummary({
          summaryPath,
          summary: summaryJson,
        }),
        null,
        2,
      ),
      'utf8',
    )

    const result = await loadNightlyIssueArtifacts({
      syncStorePath: path.join(base, 'missing-sync-service.json'),
        issueInputPath: workflowArtifacts.manifestPath,
      issueLimit: 3,
      issuePacketOutPath: null,
      issueCsvOutPath: null,
      issuePacketIssueLimit: 2,
    })

    expect(result.summaries).toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Newest issue',
      },
    ])
    expect(result.topSegments).toEqual([
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
    ])
    expect(result.artifacts.indexPath).toBe(surfacePath)
    expect(result.artifacts.workflowSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'summary.md'),
    )
    expect(result.artifacts.indexSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'index-summary.md'),
    )
    expect(result.artifacts.indexSurfacePath).toBe(surfacePath)
    expect(result.artifacts.indexSurfaceRelativePath).toBe('index-surface.json')
    expect(result.artifacts.packetSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'packets', 'summary.md'),
    )
    expect(result.artifacts.csvRootPath).toBe(
      path.join(base, 'issue-artifacts', 'csv'),
    )
    expect(result.artifacts.packetManifestPath).toBe(
      path.join(base, 'issue-artifacts', 'packets', 'manifest.json'),
    )
    expect(result.artifacts.preferredCsvRelativePath).toBe('top-segments.csv')
    expect(result.artifacts.packetUrl).toBe('https://example.com/issue-packets')
    expect(result.artifacts.csvUrl).toBe('https://example.com/issue-csv')
  })

  it('follows the canonical artifact-index sidecar from a workflow manifest before rebuilding', async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'notify-nightly-manifest-index-'))
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
                selectedSegment: {
                  name: 'C2 curb',
                  tier: 'YELLOW',
                  reasonCodes: ['TIME_WINDOW'],
                },
              },
            },
          ],
          savedPlansRevision: 0,
          reportsRevision: 0,
          issueReportsRevision: 1,
          savedPlansUpdatedAt: null,
          reportsUpdatedAt: null,
          issueReportsUpdatedAt: '2026-04-02T12:00:00.000Z',
        },
      },
    }

    await fs.writeFile(syncStorePath, JSON.stringify(store, null, 2), 'utf-8')

    const workflowArtifacts = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath,
        outRoot: path.join(base, 'issue-artifacts'),
        limit: 3,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      base,
    )

    const artifactIndex = {
      ...(await buildIssueReportArtifactIndex(workflowArtifacts.manifestPath)),
      generatedAt: '2026-04-11T00:00:00.000Z',
    }
    await fs.writeFile(
      workflowArtifacts.artifactIndexPath,
      JSON.stringify(artifactIndex, null, 2),
      'utf8',
    )

    const result = await loadNightlyIssueArtifacts({
      syncStorePath: path.join(base, 'missing-sync-service.json'),
      issueInputPath: workflowArtifacts.manifestPath,
      issueLimit: 3,
      issuePacketOutPath: null,
      issueCsvOutPath: null,
      issuePacketIssueLimit: 2,
    })

    expect(result.summaries).toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Newest issue',
      },
    ])
    expect(result.topSegments).toEqual([
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
    ])
    expect(result.artifacts.indexPath).toBe(workflowArtifacts.artifactIndexPath)
    expect(result.artifacts.workflowSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'summary.md'),
    )
    expect(result.artifacts.indexSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'index-summary.md'),
    )
    expect(result.artifacts.indexSurfacePath).toBe(
      path.join(base, 'issue-artifacts', 'index-surface.json'),
    )
    expect(result.artifacts.packetSummaryPath).toBe(
      path.join(base, 'issue-artifacts', 'packets', 'summary.md'),
    )
    expect(result.artifacts.csvRootPath).toBe(
      path.join(base, 'issue-artifacts', 'csv'),
    )
    expect(result.artifacts.packetManifestPath).toBe(
      path.join(base, 'issue-artifacts', 'packets', 'manifest.json'),
    )
    expect(result.artifacts.preferredCsvRelativePath).toBe('top-segments.csv')
    expect(result.artifacts.packetUrl).toBe('https://example.com/issue-packets')
    expect(result.artifacts.csvUrl).toBe('https://example.com/issue-csv')
  })
})
