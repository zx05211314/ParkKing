import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { writeSyncStoreFile } from './syncServiceFileStore'
import {
  assertIssueReportArtifactManifestKind,
  loadIssueReportArtifactManifest,
} from './issueReportArtifactManifest'
import { buildIssueReportWorkflowArtifacts } from './issueReportWorkflowArtifacts'
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

describe('issueReportWorkflowArtifacts', () => {
  it('writes packet and csv workflow artifacts from the sync issue report store', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-workflow-artifacts-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    const publishGateSummaryPath = path.join(cwd, 'public', 'data', 'generated', '_ops', 'publish_gate_summary.json')
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
      'utf-8',
    )

    const result = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: 'public/data/generated/_ops/publish_gate_summary.json',
        indexBaseUrl: 'https://example.com/issue-index',
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    expect(result.storageFile).toBe(syncStorePath)
    expect(result.publishGateSummary?.totals.fail).toBe(2)
    expect(result.packetRootUrl).toBe('https://example.com/issue-packets')
    expect(result.packetArtifactUrl).toBeNull()
    expect(result.csvRootUrl).toBe('https://example.com/issue-csv')
    expect(result.csvArtifactUrl).toBeNull()
    expect(result.packetSummaryRelativePath).toBe('summary.md')
    expect(result.packetSummaryUrl).toBe('https://example.com/issue-packets/summary.md')
    expect(result.packetManifestRelativePath).toBe('manifest.json')
    expect(result.packetManifestUrl).toBe('https://example.com/issue-packets/manifest.json')
    expect(result.summaryRelativePath).toBe('summary.md')
    expect(result.indexSummaryPath).toBe(path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'))
    expect(result.indexSummaryRelativePath).toBe('index-summary.md')
    expect(result.indexSummaryUrl).toBe(
      'https://example.com/issue-index/index-summary.md',
    )
    expect(result.indexSummaryJsonPath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.json'),
    )
    expect(result.indexSummaryJsonRelativePath).toBe('index-summary.json')
    expect(result.indexSummaryJsonUrl).toBe(
      'https://example.com/issue-index/index-summary.json',
    )
    expect(result.indexSurfacePath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-surface.json'),
    )
    expect(result.indexSurfaceRelativePath).toBe('index-surface.json')
    expect(result.indexSurfaceUrl).toBe(
      'https://example.com/issue-index/index-surface.json',
    )
    expect(result.summaryUrl).toBe('https://example.com/issue-index/summary.md')
    expect(result.artifactIndexPath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'artifact-index.json'),
    )
    expect(result.artifactIndexRelativePath).toBe('artifact-index.json')
    expect(result.artifactIndexUrl).toBe(
      'https://example.com/issue-index/artifact-index.json',
    )
    expect(result.preferredCsvPath).toBe(
      path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'csv', 'publish-gate-districts.csv'),
    )
    expect(result.preferredCsvRelativePath).toBe('publish-gate-districts.csv')
    expect(result.preferredCsvUrl).toBe(
      'https://example.com/issue-csv/publish-gate-districts.csv',
    )
    await expect(fs.readFile(result.packetSummaryPath, 'utf8')).resolves.toContain(
      '# Issue Report Triage Packets',
    )
    await expect(fs.readFile(result.packetSummaryPath, 'utf8')).resolves.toContain(
      '## Publish Gate',
    )
    await expect(fs.readFile(result.packetSummaryPath, 'utf8')).resolves.toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    await expect(fs.readFile(result.packetSummaryPath, 'utf8')).resolves.toContain(
      'CSV exchange root URL: https://example.com/issue-csv',
    )
    await expect(fs.readFile(result.packetSummaryPath, 'utf8')).resolves.toContain(
      '| xinyi | 1 | 2 | 3 | 1 | 2 | top-segments/01-alpha-xinyi-seg-1.json |',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '# Issue Report Workflow Artifacts',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Manifest schema: issue-report-workflow-artifacts v1',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Index summary entry: index-summary.md',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Index summary json entry: index-summary.json',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Index surface entry: index-surface.json',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Artifact index entry: artifact-index.json',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Artifact index URL: [download artifact](https://example.com/issue-index/artifact-index.json)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Matching issue reports: 1',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Workflow summary entry: summary.md',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Workflow summary URL: [download artifact](https://example.com/issue-index/summary.md)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Index summary URL: [download artifact](https://example.com/issue-index/index-summary.md)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Index summary json URL: [download artifact](https://example.com/issue-index/index-summary.json)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Index surface URL: [download artifact](https://example.com/issue-index/index-surface.json)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '## Publish Gate',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '| xinyi | 1 | 2 | 3 | 1 | 2 | C2 curb (seg-1) | packets/top-segments/01-alpha-xinyi-seg-1.json |',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '[artifact](https://example.com/issue-packets)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '- Index entry: summary.md',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '- Index URL: [download artifact](https://example.com/issue-packets/summary.md)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '- Manifest entry: manifest.json',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '- Manifest URL: [download artifact](https://example.com/issue-packets/manifest.json)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '- Root URL: [download artifact](https://example.com/issue-packets)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '- Root URL: [download artifact](https://example.com/issue-csv)',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '- Preferred join file: publish-gate-districts.csv',
    )
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      '- Preferred join file URL: [download artifact](https://example.com/issue-csv/publish-gate-districts.csv)',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"artifactType": "issue-report-workflow-artifacts"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"schemaVersion": 1',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"filteredCount": 1',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"publishGateSummary"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"packetRootUrl": "https://example.com/issue-packets"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"packetArtifactUrl": null',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"csvRootUrl": "https://example.com/issue-csv"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"csvArtifactUrl": null',
    )
    const parsedManifest = await loadIssueReportArtifactManifest(result.manifestPath)
    const workflowManifest = assertIssueReportArtifactManifestKind(
      parsedManifest.manifest,
      'workflow',
    )
    expect(workflowManifest.packetArtifactUrl).toBeNull()
    expect(workflowManifest.csvArtifactUrl).toBeNull()
    expect(workflowManifest.publishGateHotspots).toMatchObject([
      {
        districtId: 'xinyi',
        packetRootUrl: 'https://example.com/issue-packets',
        packetArtifactUrl: null,
        csvRootUrl: 'https://example.com/issue-csv',
        csvArtifactUrl: null,
      },
    ])
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      `"packetManifestPath": "${result.packetManifestPath.replace(/\\/g, '\\\\')}"`,
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"summaryRelativePath": "summary.md"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"summaryUrl": "https://example.com/issue-index/summary.md"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      `"indexSummaryPath": "${result.indexSummaryPath.replace(/\\/g, '\\\\')}"`,
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"indexSummaryRelativePath": "index-summary.md"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"indexSummaryUrl": "https://example.com/issue-index/index-summary.md"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      `"indexSummaryJsonPath": "${result.indexSummaryJsonPath.replace(/\\/g, '\\\\')}"`,
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"indexSummaryJsonRelativePath": "index-summary.json"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"indexSummaryJsonUrl": "https://example.com/issue-index/index-summary.json"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      `"indexSurfacePath": "${result.indexSurfacePath.replace(/\\/g, '\\\\')}"`,
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"indexSurfaceRelativePath": "index-surface.json"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"indexSurfaceUrl": "https://example.com/issue-index/index-surface.json"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      `"artifactIndexPath": "${result.artifactIndexPath.replace(/\\/g, '\\\\')}"`,
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"artifactIndexRelativePath": "artifact-index.json"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"artifactIndexUrl": "https://example.com/issue-index/artifact-index.json"',
    )
    expect(result.preferredCsvPath).not.toBeNull()
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      `"preferredCsvPath": "${result.preferredCsvPath!.replace(/\\/g, '\\\\')}"`,
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"preferredCsvRelativePath": "publish-gate-districts.csv"',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"preferredCsvUrl": "https://example.com/issue-csv/publish-gate-districts.csv"',
    )
    await expect(fs.readFile(result.packetSummaryPath, 'utf8')).resolves.toContain(
      'top-segments/01-alpha-xinyi-seg-1.json',
    )
    await expect(
      fs.readFile(path.join(result.csvRootPath, 'top-segments.csv'), 'utf8'),
    ).resolves.toContain('"alpha","xinyi","seg-1","C2 curb (seg-1)","YELLOW","1"')
    await expect(
      fs.readFile(path.join(result.csvRootPath, 'top-reasons.csv'), 'utf8'),
    ).resolves.toContain('"TIME_WINDOW","1","1","1"')
    await expect(
      fs.readFile(path.join(result.csvRootPath, 'publish-gate-districts.csv'), 'utf8'),
    ).resolves.toContain(
      '"xinyi","1","2","METRIC_SIGN_OVERRIDE_UNMATCHED","HASH_MISMATCH","3","1","2","seg-1","C2 curb","C2 curb (seg-1)"',
    )
  })

  it('still writes empty workflow artifacts when the sync store is missing', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-workflow-empty-'))

    const result = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/missing-sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        indexBaseUrl: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    expect(result.totalCount).toBe(0)
    expect(result.filteredCount).toBe(0)
    expect(result.publishGateSummary).toBeNull()
    await expect(fs.readFile(result.summaryPath, 'utf8')).resolves.toContain(
      'Matching issue reports: 0',
    )
    await expect(fs.readFile(result.packetSummaryPath, 'utf8')).resolves.toContain(
      'No segment hotspot packets were generated.',
    )
    await expect(
      fs.readFile(path.join(result.csvRootPath, 'top-districts.csv'), 'utf8'),
    ).resolves.toContain('"scope","district_id","count","latest_created_at","latest_summary"')
  })

  it('refreshes an existing workflow artifact bundle from its manifest instead of rebuilding from sync state', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-workflow-refresh-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const initial = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        indexBaseUrl: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    await expect(fs.readFile(initial.summaryPath, 'utf8')).resolves.not.toContain(
      'download artifact',
    )

    const refreshed = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: '.tmp/workflow-issue-artifacts/manifest.json',
        syncStorePath: '.tmp/does-not-matter.json',
        outRoot: '.tmp/unused',
        limit: 99,
        packetIssueLimit: 99,
        publishGateSummaryPath: 'public/data/generated/_ops/unused.json',
        indexBaseUrl: 'https://example.com/issue-index',
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    expect(refreshed.packetRootPath).toBe(initial.packetRootPath)
    expect(refreshed.csvRootPath).toBe(initial.csvRootPath)
    expect(refreshed.totalCount).toBe(initial.totalCount)
    expect(refreshed.summaryRelativePath).toBe(initial.summaryRelativePath)
    expect(refreshed.indexSummaryPath).toBe(initial.indexSummaryPath)
    expect(refreshed.indexSummaryRelativePath).toBe(initial.indexSummaryRelativePath)
    expect(refreshed.indexSummaryUrl).toBe(
      'https://example.com/issue-index/index-summary.md',
    )
    expect(refreshed.indexSummaryJsonPath).toBe(initial.indexSummaryJsonPath)
    expect(refreshed.indexSummaryJsonRelativePath).toBe(
      initial.indexSummaryJsonRelativePath,
    )
    expect(refreshed.indexSummaryJsonUrl).toBe(
      'https://example.com/issue-index/index-summary.json',
    )
    expect(refreshed.indexSurfacePath).toBe(initial.indexSurfacePath)
    expect(refreshed.indexSurfaceRelativePath).toBe(initial.indexSurfaceRelativePath)
    expect(refreshed.indexSurfaceUrl).toBe(
      'https://example.com/issue-index/index-surface.json',
    )
    expect(refreshed.summaryUrl).toBe('https://example.com/issue-index/summary.md')
    expect(refreshed.artifactIndexPath).toBe(initial.artifactIndexPath)
    expect(refreshed.artifactIndexRelativePath).toBe(initial.artifactIndexRelativePath)
    expect(refreshed.artifactIndexUrl).toBe(
      'https://example.com/issue-index/artifact-index.json',
    )
    await expect(fs.readFile(refreshed.summaryPath, 'utf8')).resolves.toContain(
      '[download artifact](https://example.com/issue-packets)',
    )
    await expect(fs.readFile(refreshed.summaryPath, 'utf8')).resolves.toContain(
      '[download artifact](https://example.com/issue-csv)',
    )
    await expect(fs.readFile(refreshed.packetSummaryPath, 'utf8')).resolves.toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    await expect(fs.readFile(refreshed.packetSummaryPath, 'utf8')).resolves.toContain(
      'CSV exchange root URL: https://example.com/issue-csv',
    )
    await expect(fs.readFile(refreshed.packetManifestPath, 'utf8')).resolves.toContain(
      '"packetBaseUrl": null',
    )
    await expect(fs.readFile(refreshed.packetManifestPath, 'utf8')).resolves.toContain(
      '"csvBaseUrl": null',
    )
  })
})
