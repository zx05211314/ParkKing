import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildIssueReportSummaryJsonOutput as buildIssueReportSummaryExportJsonOutput } from './issueReportSummary'
import { buildIssueReportSummaryIndex } from './issueReportSummaryIndex'
import { buildIssueReportArtifactIndex } from './issueReportArtifactIndex'
import { buildIssueReportArtifactSummaryJsonOutput } from './issueReportArtifactSummary'
import { buildIssueReportSummaryArtifacts } from './issueReportSummaryArtifacts'
import {
  buildIssueReportArtifactSummaryJsonSurfaceSummary,
  loadIssueReportArtifactSummarySurfaceInput,
  loadIssueReportArtifactSummaryJsonOutput,
  resolveIssueReportArtifactSummarySurfaceOutPath,
  renderIssueReportArtifactSummaryJsonSurfaceSummary,
  renderIssueReportArtifactSummaryJsonSurfaceWriteResult,
} from './issueReportArtifactSummaryJson'
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
              tier: 'GREEN',
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

describe('issueReportArtifactSummaryJson', () => {
  it('loads and summarizes a versioned artifact summary sidecar', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-json-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        indexBaseUrl: 'https://example.com/issue-index-base',
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    const artifactIndex = await buildIssueReportArtifactIndex(workflow.manifestPath)
    const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index: artifactIndex,
      options: {
        label: 'Nightly',
        inputUrl: 'https://example.com/issue-index',
        topCount: 3,
        inputArtifactType: 'issue-report-artifact-index',
      },
    })
    const summaryPath = path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.json')
    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')

    const loaded = await loadIssueReportArtifactSummaryJsonOutput(summaryPath)
    expect(loaded.summary.artifactType).toBe('issue-report-artifact-summary-json')
    expect(loaded.summary.schemaVersion).toBe(1)

    const surfaceSummary = buildIssueReportArtifactSummaryJsonSurfaceSummary(loaded)
    expect(surfaceSummary).toMatchObject({
      artifactType: 'issue-report-artifact-summary-surface',
      schemaVersion: 1,
      sourceArtifactType: 'issue-report-artifact-summary-json',
      sourceSchemaVersion: 1,
      label: 'Nightly',
      inputArtifactType: 'issue-report-artifact-index',
      resolvedIndexArtifactType: 'issue-report-artifact-index',
      resolvedIndexSchemaVersion: 1,
      topCount: 3,
      filteredCount: 1,
      totalCount: 1,
      linkedPublishGateHotspotCount: 0,
      totalPublishGateHotspotCount: 0,
      segmentPacketCount: 1,
      reasonPacketCount: 1,
      csvCount: 5,
      publishGateSummary: null,
      topPublishGateHotspots: [],
      topDistricts: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          count: 1,
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Driver could not interpret curb hours',
        },
      ],
      topSegments: [
        {
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: 'seg-1',
          segmentName: 'C2 curb',
          segmentLabel: 'C2 curb (seg-1)',
          count: 1,
          segmentTier: 'GREEN',
          latestCreatedAt: '2026-04-02T12:00:00.000Z',
          latestSummary: 'Driver could not interpret curb hours',
          packetPath: 'top-segments/01-alpha-xinyi-seg-1.json',
          packetUrl: 'https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json',
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
          packetPath: 'top-reasons/01-time-window.json',
          packetUrl: 'https://example.com/issue-packets/top-reasons/01-time-window.json',
        },
      ],
      packetRootPath: path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'packets'),
      packetRootRelativePath: 'packets',
      packetRootUrl: 'https://example.com/issue-packets',
      packetBaseUrl: null,
      csvRootPath: path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'csv'),
      csvRootRelativePath: 'csv',
      csvRootUrl: 'https://example.com/issue-csv',
      csvBaseUrl: null,
      workflowSummaryRelativePath: 'summary.md',
      workflowSummaryUrl: 'https://example.com/issue-index-base/summary.md',
      indexSummaryRelativePath: 'index-summary.md',
      indexSummaryUrl: 'https://example.com/issue-index-base/index-summary.md',
      indexSummaryJsonRelativePath: 'index-summary.json',
      indexSummaryJsonUrl: 'https://example.com/issue-index-base/index-summary.json',
      indexSurfaceRelativePath: 'index-surface.json',
      indexSurfaceUrl: 'https://example.com/issue-index-base/index-surface.json',
      artifactIndexRelativePath: 'artifact-index.json',
      artifactIndexUrl: 'https://example.com/issue-index-base/artifact-index.json',
      sourceSummaryRelativePath: null,
      rawIssuesRelativePath: null,
      preferredCsvRelativePath: 'top-segments.csv',
      preferredCsvUrl: 'https://example.com/issue-csv/top-segments.csv',
      packetSummaryRelativePath: 'summary.md',
      packetManifestRelativePath: 'manifest.json',
      packetSummaryUrl: 'https://example.com/issue-packets/summary.md',
      packetManifestUrl: 'https://example.com/issue-packets/manifest.json',
      packetArtifactUrl: null,
      csvArtifactUrl: null,
    })
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Index summary json entry: index-summary.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Workflow summary URL: https://example.com/issue-index-base/summary.md',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Index summary URL: https://example.com/issue-index-base/index-summary.md',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Index summary json URL: https://example.com/issue-index-base/index-summary.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Index surface entry: index-surface.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Index surface URL: https://example.com/issue-index-base/index-surface.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Artifact index entry: artifact-index.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Artifact index URL: https://example.com/issue-index-base/artifact-index.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Preferred CSV join file: top-segments.csv',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Preferred CSV join file URL: https://example.com/issue-csv/top-segments.csv',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Packet summary URL: https://example.com/issue-packets/summary.md',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Packet manifest URL: https://example.com/issue-packets/manifest.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Top district: alpha/xinyi x1',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Input surface: issue-report-artifact-index',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      `Packet root: ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'packets')}`,
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Packet root entry: packets',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      `CSV exchange root: ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'csv')}`,
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'CSV exchange root URL: https://example.com/issue-csv',
    )
    const legacySurfaceSummary = renderIssueReportArtifactSummaryJsonSurfaceSummary({
      ...surfaceSummary,
      packetRootUrl: 'https://example.com/canonical-issue-packets',
      packetArtifactUrl: 'https://legacy.example.com/issue-packets',
      csvRootUrl: 'https://example.com/canonical-issue-csv',
      csvArtifactUrl: 'https://legacy.example.com/issue-csv',
    })
    expect(legacySurfaceSummary).toContain(
      'Packet root URL: https://example.com/canonical-issue-packets',
    )
    expect(legacySurfaceSummary).toContain(
      'CSV exchange root URL: https://example.com/canonical-issue-csv',
    )
    expect(legacySurfaceSummary).toContain(
      'Legacy packet artifact URL: https://legacy.example.com/issue-packets',
    )
    expect(legacySurfaceSummary).toContain(
      'Legacy CSV artifact URL: https://legacy.example.com/issue-csv',
    )
    const aliasOnlySurfaceSummary = renderIssueReportArtifactSummaryJsonSurfaceSummary({
      ...surfaceSummary,
      packetRootUrl: null,
      packetArtifactUrl: 'https://legacy.example.com/issue-packets',
      csvRootUrl: null,
      csvArtifactUrl: 'https://legacy.example.com/issue-csv',
    })
    expect(aliasOnlySurfaceSummary).toContain(
      'Packet root URL: https://legacy.example.com/issue-packets',
    )
    expect(aliasOnlySurfaceSummary).toContain(
      'CSV exchange root URL: https://legacy.example.com/issue-csv',
    )
    expect(aliasOnlySurfaceSummary).not.toContain('Legacy packet artifact URL:')
    expect(aliasOnlySurfaceSummary).not.toContain('Legacy CSV artifact URL:')
    expect(
      renderIssueReportArtifactSummaryJsonSurfaceWriteResult(summaryPath, surfaceSummary),
    ).toContain(`Wrote issue report artifact summary surface to ${summaryPath}`)
    expect(
      renderIssueReportArtifactSummaryJsonSurfaceWriteResult(summaryPath, surfaceSummary),
    ).toContain('Input surface: issue-report-artifact-index')
  })

  it('rejects non-portable relative paths', async () => {
    const cwd = await fs.mkdtemp(
      path.join(tmpdir(), 'issue-artifact-summary-json-invalid-'),
    )
    const summaryPath = path.join(cwd, 'index-summary.json')
    const summaryJson = {
      artifactType: 'issue-report-artifact-summary-json' as const,
      schemaVersion: 1 as const,
      generatedAt: '2026-04-11T00:00:00.000Z',
      label: null,
      inputArtifactType: 'issue-report-artifact-index' as const,
      resolvedIndexArtifactType: 'issue-report-artifact-index' as const,
      resolvedIndexSchemaVersion: 1,
      inputUrl: null,
      publishGateSummaryUrl: null,
      topCount: 5,
      matchingIssueReports: {
        filteredCount: 1,
        totalCount: 1,
      },
      linkedPublishGateHotspots: {
        linkedCount: 0,
        totalCount: 0,
      },
      packetEntries: {
        segmentCount: 1,
        reasonCount: 1,
      },
      summaryEntries: {
        workflowSummaryRelativePath: 'summary.md',
        indexSummaryRelativePath: 'index-summary.md',
        indexSummaryJsonRelativePath: 'C:/bad/index-summary.json',
        indexSurfaceRelativePath: 'index-surface.json',
        artifactIndexRelativePath: 'artifact-index.json',
        sourceSummaryRelativePath: null,
        rawIssuesRelativePath: null,
        preferredCsvRelativePath: null,
        packetSummaryRelativePath: 'summary.md',
        packetManifestRelativePath: 'manifest.json',
      },
      artifactLinks: {
        summaryUrl: null,
        indexSummaryUrl: null,
        indexSummaryJsonUrl: null,
        indexSurfaceUrl: null,
        artifactIndexUrl: null,
        preferredCsvUrl: null,
        packetSummaryUrl: null,
        packetManifestUrl: null,
        packetArtifactUrl: null,
        csvArtifactUrl: null,
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      topDistricts: [],
      topSegments: [],
      topReasons: [],
      csvExports: [],
    }

    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')

    await expect(
      loadIssueReportArtifactSummaryJsonOutput(summaryPath).then(
        buildIssueReportArtifactSummaryJsonSurfaceSummary,
      ),
    ).rejects.toThrow('artifact summary json relative paths must be portable bundle paths')
  })

  it('follows workflow manifest and artifact-index inputs to the canonical summary sidecar', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-json-manifest-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        manifestPath: null,
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        indexBaseUrl: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    const artifactIndex = await buildIssueReportArtifactIndex(workflow.manifestPath)
    const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index: artifactIndex,
      options: {
        label: 'Nightly',
        inputUrl: 'https://example.com/issue-index',
        topCount: 3,
        inputArtifactType: 'issue-report-artifact-index',
      },
    })
    const summaryPath = path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.json')
    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')
    const artifactIndexPath = path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'artifact-index.json')
    await fs.writeFile(artifactIndexPath, JSON.stringify(artifactIndex, null, 2), 'utf8')

    const loadedFromManifest = await loadIssueReportArtifactSummarySurfaceInput(
      workflow.manifestPath,
    )
    expect(loadedFromManifest.inputArtifactType).toBe('issue-report-workflow-artifacts')
    expect(loadedFromManifest.summary?.summaryPath).toBe(summaryPath)
    expect(loadedFromManifest.surface).toBeNull()
    expect(loadedFromManifest.surfacePath).toBeNull()
    expect(
      resolveIssueReportArtifactSummarySurfaceOutPath(loadedFromManifest, {
        outPath: null,
        writeIndexSurface: true,
      }),
    ).toBe(path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-surface.json'))

    const loadedFromIndex = await loadIssueReportArtifactSummarySurfaceInput(
      artifactIndexPath,
    )
    expect(loadedFromIndex.inputArtifactType).toBe('issue-report-artifact-index')
    expect(loadedFromIndex.summary?.summaryPath).toBe(summaryPath)
    expect(loadedFromIndex.surface).toBeNull()
    expect(loadedFromIndex.surfacePath).toBeNull()
  })

  it('derives canonical manual sidecars from issue-report-summary-index input', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-json-manual-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')
    const summaryIndexPath = path.join(cwd, 'issue-summary-index.json')
    const packetManifestPath = path.join(cwd, 'issue-packets', 'manifest.json')

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
        summaries: [],
        segmentSummaries: [],
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
        topSegments: [],
        topReasons: [],
        issues: [],
        rawIssues: [],
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath,
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: 'https://example.com/manual-summary/issue-summary.json',
        rawIssuesPath: path.join(cwd, 'raw-issues.json'),
        rawIssuesRelativePath: 'raw-issues.json',
        rawIssuesUrl: 'https://example.com/manual-raw/raw-issues.json',
        csvRootPath: null,
        csvRootUrl: null,
        csvBaseUrl: null,
        csvPaths: [],
        csvRelativePaths: [],
        packetRootPath: path.join(cwd, 'issue-packets'),
        packetRootUrl: 'https://example.com/issue-packets',
        packetBaseUrl: 'https://example.com/issue-packets',
        packetSummaryPath: path.join(cwd, 'issue-packets', 'summary.md'),
        packetSummaryRelativePath: 'summary.md',
        packetManifestPath,
        packetManifestRelativePath: 'manifest.json',
        packetPaths: [],
        packetRelativePaths: [],
      },
    })

    const packetManifest = {
      artifactType: 'issue-report-triage-packets' as const,
      schemaVersion: 1 as const,
      generatedAt: '2026-04-02T12:31:00.000Z',
      storageFile: path.join(cwd, 'sync-service.json'),
      filters: summaryJson.filters,
      totalCount: 1,
      filteredCount: 1,
      packetRootPath: path.join(cwd, 'issue-packets'),
      packetRootUrl: 'https://example.com/issue-packets',
      packetBaseUrl: 'https://example.com/issue-packets',
      csvRootPath: null,
      csvRootUrl: null,
      csvBaseUrl: null,
      summaryPath: path.join(cwd, 'issue-packets', 'summary.md'),
      summaryRelativePath: 'summary.md',
      summaryUrl: 'https://example.com/issue-packets/summary.md',
      publishGateSummary: null,
      publishGateHotspots: [],
      segmentPackets: [],
      reasonPackets: [],
      csvExports: [],
    }

    const summaryIndex = buildIssueReportSummaryIndex({
      summaryPath,
      summary: summaryJson,
      packetManifest,
      indexPath: summaryIndexPath,
      indexBaseUrl: 'https://example.com/manual-index-base',
    })

    await fs.mkdir(path.dirname(packetManifestPath), { recursive: true })
    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')
    await fs.writeFile(packetManifestPath, JSON.stringify(packetManifest, null, 2), 'utf8')
    await fs.writeFile(summaryIndexPath, JSON.stringify(summaryIndex, null, 2), 'utf8')

    const loaded = await loadIssueReportArtifactSummarySurfaceInput(summaryIndexPath)
    expect(loaded.inputArtifactType).toBe('issue-report-summary-index')
    expect(loaded.summary?.summaryPath).toBe(path.join(cwd, 'index-summary.json'))
    expect(loaded.surface).toBeNull()
    expect(loaded.surfacePath).toBeNull()
    expect(
      resolveIssueReportArtifactSummarySurfaceOutPath(loaded, {
        outPath: null,
        writeIndexSurface: true,
      }),
    ).toBe(path.join(cwd, 'index-surface.json'))

    const surfaceSummary = buildIssueReportArtifactSummaryJsonSurfaceSummary(loaded.summary!)
    expect(surfaceSummary.indexSummaryRelativePath).toBe('index-summary.md')
    expect(surfaceSummary.indexSummaryJsonRelativePath).toBe('index-summary.json')
    expect(surfaceSummary.indexSurfaceRelativePath).toBe('index-surface.json')
    expect(surfaceSummary.indexSummaryUrl).toBe(
      'https://example.com/manual-index-base/index-summary.md',
    )
    expect(surfaceSummary.indexSummaryJsonUrl).toBe(
      'https://example.com/manual-index-base/index-summary.json',
    )
    expect(surfaceSummary.indexSurfaceUrl).toBe(
      'https://example.com/manual-index-base/index-surface.json',
    )
    expect(surfaceSummary.manualManifestRelativePath).toBe('artifacts-manifest.json')
    expect(surfaceSummary.manualManifestUrl).toBe(
      'https://example.com/manual-index-base/artifacts-manifest.json',
    )
    expect(surfaceSummary.packetRootPath).toBe(path.join(cwd, 'issue-packets'))
    expect(surfaceSummary.csvRootPath).toBeNull()
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Manual artifacts manifest entry: artifacts-manifest.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      `Packet root: ${path.join(cwd, 'issue-packets')}`,
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Manual artifacts manifest URL: https://example.com/manual-index-base/artifacts-manifest.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Preferred portable input: artifacts-manifest.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Preferred portable input URL: https://example.com/manual-index-base/artifacts-manifest.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Fallback compatibility input: issue-summary-index.json',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Fallback compatibility input URL: https://example.com/manual-index-base/issue-summary-index.json',
    )

    const artifactBundle = await buildIssueReportSummaryArtifacts(
      {
        inputPath: summaryPath,
        label: 'Manual',
        inputUrl: 'https://example.com/manual-index',
        publishGateSummaryUrl: null,
        topCount: 3,
        indexBaseUrl: 'https://example.com/manual-index-base',
      },
      cwd,
    )
    const overriddenPacketRootPath = path.join(cwd, 'manual-root-canonical-issue-packets')
    const overriddenPacketSummaryPath = path.join(overriddenPacketRootPath, 'manual-summary.md')
    const overriddenPacketManifestPath = path.join(
      overriddenPacketRootPath,
      'manual-manifest.json',
    )
    const overriddenCsvRootPath = path.join(cwd, 'manual-root-canonical-issue-csv')
    const overriddenManualManifest = {
      ...JSON.parse(await fs.readFile(artifactBundle.manifestPath, 'utf8')),
      csvRootPath: overriddenCsvRootPath,
      csvArtifactUrl: 'https://example.com/manual-root-canonical/issue-csv',
      preferredCsvPath: path.join(overriddenCsvRootPath, 'publish-gate-districts.csv'),
      preferredCsvRelativePath: 'publish-gate-districts.csv',
      preferredCsvUrl: 'https://example.com/manual-root-canonical/publish-gate-districts.csv',
      packetArtifactUrl: 'https://example.com/manual-root-canonical/issue-packets',
      packetRootPath: overriddenPacketRootPath,
      packetSummaryPath: overriddenPacketSummaryPath,
      packetSummaryRelativePath: 'manual-summary.md',
      packetSummaryUrl: 'https://example.com/manual-root-canonical/issue-packets/manual-summary.md',
      packetManifestPath: overriddenPacketManifestPath,
      packetManifestRelativePath: 'manual-manifest.json',
      packetManifestUrl: 'https://example.com/manual-root-canonical/issue-packets/manual-manifest.json',
      packetPaths: [overriddenPacketManifestPath],
    }
    await fs.writeFile(
      artifactBundle.manifestPath,
      JSON.stringify(overriddenManualManifest, null, 2),
      'utf8',
    )

    const loadedFromManualIndex = await loadIssueReportArtifactSummarySurfaceInput(summaryIndexPath)
    expect(loadedFromManualIndex.summary?.summary.artifactLinks.preferredCsvUrl).toBe(
      'https://example.com/manual-root-canonical/publish-gate-districts.csv',
    )
    expect(
      buildIssueReportArtifactSummaryJsonSurfaceSummary(loadedFromManualIndex.summary!).csvRootPath,
    ).toBe(overriddenCsvRootPath)
    expect(loadedFromManualIndex.summary?.summary.artifactLinks.packetSummaryUrl).toBe(
      'https://example.com/manual-root-canonical/issue-packets/manual-summary.md',
    )
    expect(loadedFromManualIndex.summary?.summary.artifactLinks.packetManifestUrl).toBe(
      'https://example.com/manual-root-canonical/issue-packets/manual-manifest.json',
    )
  })

  it('keeps manual base-url aliases out of compact artifact-url compat fields', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-json-base-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')
    const summaryIndexPath = path.join(cwd, 'issue-summary-index.json')

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
        summaries: [],
        segmentSummaries: [],
        topDistricts: [],
        latestDistricts: [],
        topSegments: [],
        topReasons: [],
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
        csvRootPath: path.join(cwd, 'issue-csv'),
        csvRootUrl: 'https://example.com/issue-csv',
        csvBaseUrl: 'https://legacy.example.com/issue-csv-base',
        csvPaths: [path.join(cwd, 'issue-csv', 'publish-gate-districts.csv')],
        csvRelativePaths: ['publish-gate-districts.csv'],
        packetRootPath: path.join(cwd, 'issue-packets'),
        packetRootUrl: 'https://example.com/issue-packets',
        packetBaseUrl: 'https://legacy.example.com/issue-packets-base',
        packetSummaryPath: path.join(cwd, 'issue-packets', 'summary.md'),
        packetSummaryRelativePath: 'summary.md',
        packetManifestPath: path.join(cwd, 'issue-packets', 'manifest.json'),
        packetManifestRelativePath: 'manifest.json',
        packetPaths: [],
        packetRelativePaths: [],
      },
    })

    const summaryIndex = buildIssueReportSummaryIndex({
      summaryPath,
      summary: summaryJson,
      packetManifest: null,
      indexPath: summaryIndexPath,
      indexBaseUrl: 'https://example.com/manual-index-base',
    })
    const artifactSummaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index: summaryIndex,
      options: {
        inputArtifactType: 'issue-report-summary-index',
      },
    })
    const surfaceSummary = buildIssueReportArtifactSummaryJsonSurfaceSummary({
      summaryPath: path.join(cwd, 'index-summary.json'),
      summary: artifactSummaryJson,
    })

    expect(surfaceSummary.packetRootUrl).toBe('https://example.com/issue-packets')
    expect(surfaceSummary.packetBaseUrl).toBe(
      'https://legacy.example.com/issue-packets-base',
    )
    expect(surfaceSummary.packetArtifactUrl).toBeNull()
    expect(surfaceSummary.csvRootUrl).toBe('https://example.com/issue-csv')
    expect(surfaceSummary.csvBaseUrl).toBe(
      'https://legacy.example.com/issue-csv-base',
    )
    expect(surfaceSummary.csvArtifactUrl).toBeNull()
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Legacy packet base URL: https://legacy.example.com/issue-packets-base',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).toContain(
      'Legacy CSV base URL: https://legacy.example.com/issue-csv-base',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).not.toContain(
      'Legacy packet artifact URL:',
    )
    expect(renderIssueReportArtifactSummaryJsonSurfaceSummary(surfaceSummary)).not.toContain(
      'Legacy CSV artifact URL:',
    )
  })
})
