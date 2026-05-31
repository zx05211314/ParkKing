import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  buildIssueReportArtifactIndex,
  parseIssueReportArtifactIndex,
  renderIssueReportArtifactIndex,
} from './issueReportArtifactIndex'
import { buildIssueReportWorkflowArtifacts } from './issueReportWorkflowArtifacts'
import { writeSyncStoreFile } from './syncServiceFileStore'
import type { SyncServiceStore } from './syncServiceTypes'

const createStore = (): SyncServiceStore => ({
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
          summary: 'Driver could not interpret curb hours',
          createdAt: '2026-04-02T12:00:00.000Z',
          bundle: {
            generatedAt: '2026-04-02T12:01:00.000Z',
            selectedSegment: {
              name: 'C2 curb',
              tier: 'YELLOW',
              allowedNow: 'PARK',
              reasonCodes: ['TIME_WINDOW'],
            },
            context: {
              hhmm: '22:30',
              includeInferred: false,
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
})

describe('issueReportArtifactIndex', () => {
  it('builds a normalized machine-readable index from a workflow manifest', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-index-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    const publishGateSummaryPath = path.join(
      cwd,
      'public',
      'data',
      'generated',
      '_ops',
      'publish_gate_summary.json',
    )
    await writeSyncStoreFile(syncStorePath, createStore())
    await fs.mkdir(path.dirname(publishGateSummaryPath), { recursive: true })
    await fs.writeFile(
      publishGateSummaryPath,
      JSON.stringify(
        {
          generatedAt: '2026-04-02T12:30:00.000Z',
          reportPath: 'report.json',
          mode: 'strict',
          allowWarn: false,
          allowFail: true,
          allowFailRequested: true,
          allowBaselineAdopt: false,
          overrideReason: 'ci fixture override',
          bootstrap: {
            requested: false,
            modeUsed: false,
            denied: false,
            previousPackExists: true,
          },
          baselineAdopt: {
            enabled: false,
            applied: false,
            districtIds: [],
            reason: null,
          },
          gateMessageFlags: [],
          totals: {
            info: 0,
            warn: 1,
            fail: 2,
          },
          districts: [
            {
              districtId: 'xinyi',
              info: 0,
              warn: 1,
              fail: 2,
              topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
              topFailCodes: ['HASH_MISMATCH'],
              signOverrideBreakdown: {
                total: 4,
                matchedBySegmentId: 3,
                matchedBySpatial: 1,
                unmatchedNamed: 2,
              },
            },
          ],
          exitCode: 0,
        },
        null,
        2,
      ),
      'utf8',
    )

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: 'public/data/generated/_ops/publish_gate_summary.json',
        indexBaseUrl: 'https://example.com/issue-index-base',
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    const index = await buildIssueReportArtifactIndex(workflow.manifestPath)

    expect(index.artifactType).toBe('issue-report-artifact-index')
    expect(index.schemaVersion).toBe(1)
    expect(index.rootManifest.manifestPath).toBe(workflow.manifestPath)
    expect(index.rootManifest.summaryRelativePath).toBe('summary.md')
    expect(index.rootManifest.summaryUrl).toBe(
      'https://example.com/issue-index-base/summary.md',
    )
    expect(index.rootManifest.indexSummaryPath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'),
    )
    expect(index.rootManifest.indexSummaryRelativePath).toBe('index-summary.md')
    expect(index.rootManifest.indexSummaryUrl).toBe(
      'https://example.com/issue-index-base/index-summary.md',
    )
    expect(index.rootManifest.indexSummaryJsonPath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.json'),
    )
    expect(index.rootManifest.indexSummaryJsonRelativePath).toBe('index-summary.json')
    expect(index.rootManifest.indexSummaryJsonUrl).toBe(
      'https://example.com/issue-index-base/index-summary.json',
    )
    expect(index.rootManifest.indexSurfacePath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-surface.json'),
    )
    expect(index.rootManifest.indexSurfaceRelativePath).toBe('index-surface.json')
    expect(index.rootManifest.indexSurfaceUrl).toBe(
      'https://example.com/issue-index-base/index-surface.json',
    )
    expect(index.rootManifest.artifactIndexPath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'artifact-index.json'),
    )
    expect(index.rootManifest.artifactIndexRelativePath).toBe('artifact-index.json')
    expect(index.rootManifest.artifactIndexUrl).toBe(
      'https://example.com/issue-index-base/artifact-index.json',
    )
    expect(index.rootManifest.preferredCsvPath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'csv', 'publish-gate-districts.csv'),
    )
    expect(index.rootManifest.preferredCsvRelativePath).toBe('publish-gate-districts.csv')
    expect(index.rootManifest.preferredCsvUrl).toBe(
      'https://example.com/issue-csv/publish-gate-districts.csv',
    )
    expect(index.rootManifest.packetRootUrl).toBe('https://example.com/issue-packets')
    expect(index.rootManifest.packetArtifactUrl).toBeNull()
    expect(index.rootManifest.csvRootUrl).toBe('https://example.com/issue-csv')
    expect(index.rootManifest.csvArtifactUrl).toBeNull()
    expect(index.rootManifest.packetManifestPath).toBe(workflow.packetManifestPath)
    expect(index.rootManifest.packetSummaryRelativePath).toBe('summary.md')
    expect(index.rootManifest.packetSummaryUrl).toBe(
      'https://example.com/issue-packets/summary.md',
    )
    expect(index.rootManifest.packetManifestRelativePath).toBe('manifest.json')
    expect(index.rootManifest.packetManifestUrl).toBe(
      'https://example.com/issue-packets/manifest.json',
    )
    expect(index.packetManifest.manifestPath).toBe(workflow.packetManifestPath)
    expect(index.packetManifest.summaryRelativePath).toBe('summary.md')
    expect(index.packetManifest.packetRootUrl).toBe('https://example.com/issue-packets')
    expect(index.packetManifest.packetBaseUrl).toBeNull()
    expect(index.packetManifest.csvBaseUrl).toBeNull()
    const parsedAliasOnlyIndex = parseIssueReportArtifactIndex({
      ...index,
      rootManifest: {
        ...index.rootManifest,
        packetRootUrl: null,
        packetArtifactUrl: 'https://legacy.example.com/issue-packets',
        csvRootUrl: null,
        csvArtifactUrl: 'https://legacy.example.com/issue-csv',
      },
      packetManifest: {
        ...index.packetManifest,
        packetRootUrl: null,
        packetBaseUrl: 'https://legacy.example.com/issue-packets',
        csvRootUrl: null,
        csvBaseUrl: 'https://legacy.example.com/issue-csv',
      },
    })
    expect(parsedAliasOnlyIndex.rootManifest.packetRootUrl).toBe(
      'https://legacy.example.com/issue-packets',
    )
    expect(parsedAliasOnlyIndex.rootManifest.packetArtifactUrl).toBeNull()
    expect(parsedAliasOnlyIndex.rootManifest.csvRootUrl).toBe(
      'https://legacy.example.com/issue-csv',
    )
    expect(parsedAliasOnlyIndex.rootManifest.csvArtifactUrl).toBeNull()
    expect(parsedAliasOnlyIndex.packetManifest.packetRootUrl).toBe(
      'https://legacy.example.com/issue-packets',
    )
    expect(parsedAliasOnlyIndex.packetManifest.packetBaseUrl).toBeNull()
    expect(parsedAliasOnlyIndex.packetManifest.csvRootUrl).toBe(
      'https://legacy.example.com/issue-csv',
    )
    expect(parsedAliasOnlyIndex.packetManifest.csvBaseUrl).toBeNull()
    expect(index.packetManifest.csvRootUrl).toBe('https://example.com/issue-csv')
    expect(index.publishGateSummary?.totals.fail).toBe(2)
    expect(index.relationSummary.packetSegmentCount).toBe(1)
    expect(index.relationSummary.packetReasonCount).toBe(1)
    expect(index.topDistricts).toEqual([
      {
        scope: 'alpha',
        districtId: 'xinyi',
        count: 1,
        latestCreatedAt: '2026-04-02T12:00:00.000Z',
        latestSummary: 'Driver could not interpret curb hours',
      },
    ])
    expect(index.topSegments).toEqual([
      expect.objectContaining({
        packetId: 'alpha-xinyi-seg-1',
        segmentId: 'seg-1',
        count: 1,
      }),
    ])
    expect(index.topReasons).toEqual([
      expect.objectContaining({
        packetId: 'time-window',
        reasonCode: 'TIME_WINDOW',
        count: 1,
      }),
    ])
    expect(index.publishGateHotspots).toEqual([
      expect.objectContaining({
        districtId: 'xinyi',
        directOverrideMatches: 3,
        spatialOverrideMatches: 1,
        unmatchedNamedOverrides: 2,
        issueHotspotSegmentId: 'seg-1',
        issueHotspotPacketPath: 'top-segments/01-alpha-xinyi-seg-1.json',
        issueHotspotPacketUrl:
          'https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json',
      }),
    ])
    expect(index.segmentPackets).toEqual([
      expect.objectContaining({
        packetId: 'alpha-xinyi-seg-1',
        relativePath: 'top-segments/01-alpha-xinyi-seg-1.json',
      }),
    ])
    expect(index.reasonPackets).toEqual([
      expect.objectContaining({
        packetId: 'time-window',
        relativePath: 'top-reasons/01-time-window.json',
      }),
    ])
    expect(index.csvExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: 'publish-gate-districts.csv',
          url: 'https://example.com/issue-csv/publish-gate-districts.csv',
        }),
      ]),
    )
    expect(index.preferredCsvFile).toEqual({
      path: path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'csv', 'publish-gate-districts.csv'),
      relativePath: 'publish-gate-districts.csv',
      url: 'https://example.com/issue-csv/publish-gate-districts.csv',
    })

    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Manifest schema: issue-report-artifact-index v1',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Workflow summary entry: summary.md',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Workflow summary URL: https://example.com/issue-index-base/summary.md',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      `Index summary: ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md')}`,
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Index summary entry: index-summary.md',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Index summary URL: https://example.com/issue-index-base/index-summary.md',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      `Index summary json: ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.json')}`,
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Index summary json entry: index-summary.json',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Index summary json URL: https://example.com/issue-index-base/index-summary.json',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Root preferred CSV join file: publish-gate-districts.csv',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Root preferred CSV join URL: https://example.com/issue-csv/publish-gate-districts.csv',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Preferred CSV join file: publish-gate-districts.csv',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Preferred CSV join file URL: https://example.com/issue-csv/publish-gate-districts.csv',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      `Index surface: ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-surface.json')}`,
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Index surface entry: index-surface.json',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Index surface URL: https://example.com/issue-index-base/index-surface.json',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      `Artifact index: ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'artifact-index.json')}`,
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Artifact index entry: artifact-index.json',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Artifact index URL: https://example.com/issue-index-base/artifact-index.json',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      'CSV root URL: https://example.com/issue-csv',
    )
    expect(renderIssueReportArtifactIndex(index)).not.toContain(
      'Legacy packet artifact URL:',
    )
    expect(renderIssueReportArtifactIndex(index)).not.toContain(
      'Legacy packet base URL:',
    )
    expect(renderIssueReportArtifactIndex(index)).not.toContain(
      'Legacy CSV artifact URL:',
    )
    expect(renderIssueReportArtifactIndex(index)).not.toContain(
      'Legacy CSV base URL:',
    )
    const legacyAliasIndex = parseIssueReportArtifactIndex({
      ...index,
      rootManifest: {
        ...index.rootManifest,
        packetArtifactUrl: 'https://legacy.example.com/root-packets',
        csvArtifactUrl: 'https://legacy.example.com/root-csv',
      },
      packetManifest: {
        ...index.packetManifest,
        packetBaseUrl: 'https://legacy.example.com/packet-base',
        csvBaseUrl: 'https://legacy.example.com/csv-base',
      },
    })
    const renderedLegacyAliasIndex = renderIssueReportArtifactIndex(legacyAliasIndex)
    expect(renderedLegacyAliasIndex).toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    expect(renderedLegacyAliasIndex).toContain(
      'Legacy packet artifact URL: https://legacy.example.com/root-packets',
    )
    expect(renderedLegacyAliasIndex).toContain(
      'Legacy packet base URL: https://legacy.example.com/packet-base',
    )
    expect(renderedLegacyAliasIndex).toContain(
      'CSV root URL: https://example.com/issue-csv',
    )
    expect(renderedLegacyAliasIndex).toContain(
      'Legacy CSV artifact URL: https://legacy.example.com/root-csv',
    )
    expect(renderedLegacyAliasIndex).toContain(
      'Legacy CSV base URL: https://legacy.example.com/csv-base',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      '- Packet summary entry: summary.md',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      '- Packet manifest entry: manifest.json',
    )
    expect(renderIssueReportArtifactIndex(index)).toContain(
      '| xinyi | 1 | 2 | 3 | 1 | 2 | C2 curb (seg-1) | https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json |',
    )

    const canonicalPacketIndex = {
      ...index,
      rootManifest: {
        ...index.rootManifest,
        packetSummaryPath: path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'packets', 'root-summary.md'),
        packetSummaryRelativePath: 'root-summary.md',
        packetSummaryUrl: 'https://example.com/issue-packets/root-summary.md',
        packetManifestPath: path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'packets', 'root-manifest.json'),
        packetManifestRelativePath: 'root-manifest.json',
        packetManifestUrl: 'https://example.com/issue-packets/root-manifest.json',
      },
    }
    expect(renderIssueReportArtifactIndex(canonicalPacketIndex)).toContain(
      '- Packet summary entry: root-summary.md',
    )
    expect(renderIssueReportArtifactIndex(canonicalPacketIndex)).toContain(
      '- Packet summary URL: https://example.com/issue-packets/root-summary.md',
    )
    expect(renderIssueReportArtifactIndex(canonicalPacketIndex)).toContain(
      '- Packet manifest entry: root-manifest.json',
    )
    expect(renderIssueReportArtifactIndex(canonicalPacketIndex)).toContain(
      '- Packet manifest URL: https://example.com/issue-packets/root-manifest.json',
    )
    expect(renderIssueReportArtifactIndex(canonicalPacketIndex)).toContain(
      '- Packet root URL: https://example.com/issue-packets',
    )

    const packetManifestFallbackIndex = {
      ...index,
      rootManifest: {
        ...index.rootManifest,
        packetSummaryPath: null,
        packetSummaryRelativePath: null,
        packetSummaryUrl: null,
        packetManifestPath: null,
        packetManifestRelativePath: null,
        packetManifestUrl: null,
        packetRootPath: null,
        packetRootUrl: null,
        packetArtifactUrl: null,
        csvRootPath: null,
        csvRootUrl: null,
        csvArtifactUrl: null,
      },
    } as unknown as typeof index
    expect(renderIssueReportArtifactIndex(packetManifestFallbackIndex)).toContain(
      '- Packet summary entry: summary.md',
    )
    expect(renderIssueReportArtifactIndex(packetManifestFallbackIndex)).toContain(
      '- Packet summary URL: https://example.com/issue-packets/summary.md',
    )
    expect(renderIssueReportArtifactIndex(packetManifestFallbackIndex)).toContain(
      '- Packet manifest entry: manifest.json',
    )
    expect(renderIssueReportArtifactIndex(packetManifestFallbackIndex)).toContain(
      '- Packet root URL: https://example.com/issue-packets',
    )
    expect(renderIssueReportArtifactIndex(packetManifestFallbackIndex)).toContain(
      '- CSV root URL: https://example.com/issue-csv',
    )
  })
})
