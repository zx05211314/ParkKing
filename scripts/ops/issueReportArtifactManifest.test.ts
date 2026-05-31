import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  assertIssueReportArtifactManifestKind,
  buildIssueReportArtifactManifestSummary,
  getIssueReportArtifactManifestKind,
  loadIssueReportArtifactManifest,
  loadIssueReportArtifactManifestBundle,
  parseIssueReportArtifactManifest,
  renderIssueReportArtifactManifestSummary,
  validateIssueReportArtifactSummaryFiles,
  validateIssueReportArtifactManifestRelations,
} from './issueReportArtifactManifest'
import { buildIssueReportArtifactIndex } from './issueReportArtifactIndex'
import { buildIssueReportArtifactSummaryJsonOutput } from './issueReportArtifactSummary'
import {
  buildIssueReportArtifactSummaryJsonSurfaceSummary,
  loadIssueReportArtifactSummaryJsonOutput,
} from './issueReportArtifactSummaryJson'
import { buildIssueReportSummaryJsonOutput as buildIssueReportSummaryExportJsonOutput } from './issueReportSummary'
import { buildIssueReportWorkflowArtifacts } from './issueReportWorkflowArtifacts'
import { buildIssueReportSummaryArtifacts } from './issueReportSummaryArtifacts'
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

const writeManualPacketBundle = async (
  packetRoot: string,
  packetArtifactUrl: string,
) => {
  await fs.mkdir(packetRoot, { recursive: true })
  const packetSummaryPath = path.join(packetRoot, 'summary.md')
  const packetManifestPath = path.join(packetRoot, 'manifest.json')
  await fs.writeFile(packetSummaryPath, '# Packet Summary\n', 'utf8')
  await fs.writeFile(
    packetManifestPath,
    `${JSON.stringify(
      {
        artifactType: 'issue-report-triage-packets',
        schemaVersion: 1,
        generatedAt: '2026-04-06T00:00:00.000Z',
        storageFile: path.join(path.dirname(packetRoot), 'sync-service.json'),
        filters: {
          scope: 'alpha',
          districtId: 'xinyi',
          segmentId: null,
          reasonCode: null,
          since: null,
        },
        totalCount: 1,
        filteredCount: 1,
        packetRootPath: packetRoot,
        packetBaseUrl: packetArtifactUrl,
        csvRootPath: null,
        csvBaseUrl: null,
        summaryPath: packetSummaryPath,
        summaryRelativePath: 'summary.md',
        summaryUrl: `${packetArtifactUrl}/summary.md`,
        publishGateSummary: null,
        publishGateHotspots: [],
        segmentPackets: [],
        reasonPackets: [],
        csvExports: [],
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  return {
    packetSummaryPath,
    packetManifestPath,
  }
}

describe('issueReportArtifactManifest', () => {
  it('loads and summarizes workflow and nested packet manifests', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-manifest-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
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

    const loadedWorkflow = await loadIssueReportArtifactManifest(workflow.manifestPath)
    const workflowManifest = assertIssueReportArtifactManifestKind(
      loadedWorkflow.manifest,
      'workflow',
    )
    expect(getIssueReportArtifactManifestKind(workflowManifest)).toBe('workflow')
    expect(workflowManifest.artifactType).toBe('issue-report-workflow-artifacts')
    expect(workflowManifest.schemaVersion).toBe(1)
    const workflowSummary = buildIssueReportArtifactManifestSummary(
      loadedWorkflow.manifestPath,
      workflowManifest,
    )
    expect(workflowSummary).toMatchObject({
      artifactType: 'issue-report-workflow-artifacts',
      schemaVersion: 1,
      packetRootPath: workflow.packetRootPath,
      packetRootUrl: 'https://example.com/issue-packets',
      csvRootPath: workflow.csvRootPath,
      csvRootUrl: 'https://example.com/issue-csv',
      summaryRelativePath: 'summary.md',
      summaryUrl: 'https://example.com/issue-index-base/summary.md',
      indexSummaryPath: path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'),
      indexSummaryRelativePath: 'index-summary.md',
      indexSummaryUrl: 'https://example.com/issue-index-base/index-summary.md',
      indexSummaryJsonPath: path.join(
        cwd,
        '.tmp',
        'workflow-issue-artifacts',
        'index-summary.json',
      ),
      indexSummaryJsonRelativePath: 'index-summary.json',
      indexSummaryJsonUrl: 'https://example.com/issue-index-base/index-summary.json',
      indexSurfacePath: path.join(
        cwd,
        '.tmp',
        'workflow-issue-artifacts',
        'index-surface.json',
      ),
      indexSurfaceRelativePath: 'index-surface.json',
      indexSurfaceUrl: 'https://example.com/issue-index-base/index-surface.json',
      artifactIndexPath: path.join(
        cwd,
        '.tmp',
        'workflow-issue-artifacts',
        'artifact-index.json',
      ),
      artifactIndexRelativePath: 'artifact-index.json',
      artifactIndexUrl: 'https://example.com/issue-index-base/artifact-index.json',
      packetSummaryPath: workflow.packetSummaryPath,
      packetSummaryRelativePath: 'summary.md',
      packetSummaryUrl: 'https://example.com/issue-packets/summary.md',
      packetManifestPath: workflow.packetManifestPath,
      packetManifestRelativePath: 'manifest.json',
      packetManifestUrl: 'https://example.com/issue-packets/manifest.json',
    })
    expect(renderIssueReportArtifactManifestSummary(workflowSummary)).toContain(
      `Packet root: ${workflow.packetRootPath}`,
    )
    expect(renderIssueReportArtifactManifestSummary(workflowSummary)).toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    expect(renderIssueReportArtifactManifestSummary(workflowSummary)).toContain(
      `CSV root: ${workflow.csvRootPath}`,
    )
    expect(renderIssueReportArtifactManifestSummary(workflowSummary)).toContain(
      'CSV root URL: https://example.com/issue-csv',
    )
    expect(renderIssueReportArtifactManifestSummary(workflowSummary)).not.toContain(
      'Legacy packet artifact URL:',
    )
    expect(renderIssueReportArtifactManifestSummary(workflowSummary)).not.toContain(
      'Legacy CSV artifact URL:',
    )
    const workflowLegacyAliasSummary = buildIssueReportArtifactManifestSummary(
      loadedWorkflow.manifestPath,
      {
        ...workflowManifest,
        packetArtifactUrl: 'https://legacy.example.com/issue-packets',
        csvArtifactUrl: 'https://legacy.example.com/issue-csv',
      },
    )
    expect(workflowLegacyAliasSummary).toMatchObject({
      packetRootUrl: 'https://example.com/issue-packets',
      packetArtifactUrl: 'https://legacy.example.com/issue-packets',
      csvRootUrl: 'https://example.com/issue-csv',
      csvArtifactUrl: 'https://legacy.example.com/issue-csv',
    })
    expect(renderIssueReportArtifactManifestSummary(workflowLegacyAliasSummary)).toContain(
      'Legacy packet artifact URL: https://legacy.example.com/issue-packets',
    )
    expect(renderIssueReportArtifactManifestSummary(workflowLegacyAliasSummary)).toContain(
      'Legacy CSV artifact URL: https://legacy.example.com/issue-csv',
    )

    const loadedPacket = await loadIssueReportArtifactManifest(
      workflowManifest.packetManifestPath,
    )
    const packetManifest = assertIssueReportArtifactManifestKind(loadedPacket.manifest, 'packet')
    expect(getIssueReportArtifactManifestKind(packetManifest)).toBe('packet')
    expect(packetManifest.artifactType).toBe('issue-report-triage-packets')
    expect(packetManifest.schemaVersion).toBe(1)
    expect(packetManifest.summaryRelativePath).toBe('summary.md')
    expect(packetManifest.packetBaseUrl).toBeNull()
    expect(packetManifest.csvExports.length).toBe(5)
    const packetLegacyBaseSummary = buildIssueReportArtifactManifestSummary(
      loadedPacket.manifestPath,
      {
        ...packetManifest,
        packetBaseUrl: 'https://legacy.example.com/issue-packets-base',
        csvBaseUrl: 'https://legacy.example.com/issue-csv-base',
      },
    )
    expect(packetLegacyBaseSummary).toMatchObject({
      packetRootUrl: 'https://example.com/issue-packets',
      packetBaseUrl: 'https://legacy.example.com/issue-packets-base',
      csvRootUrl: 'https://example.com/issue-csv',
      csvBaseUrl: 'https://legacy.example.com/issue-csv-base',
    })
    expect(renderIssueReportArtifactManifestSummary(packetLegacyBaseSummary)).toContain(
      'Legacy packet base URL: https://legacy.example.com/issue-packets-base',
    )
    expect(renderIssueReportArtifactManifestSummary(packetLegacyBaseSummary)).toContain(
      'Legacy CSV base URL: https://legacy.example.com/issue-csv-base',
    )

    const bundle = await loadIssueReportArtifactManifestBundle(workflow.manifestPath)
    expect(validateIssueReportArtifactManifestRelations(bundle)).toMatchObject({
      linkedPublishGateHotspotCount: 0,
      totalPublishGateHotspotCount: 0,
      packetSegmentCount: 1,
      packetReasonCount: 1,
      packetCsvCount: 5,
    })
    expect(
      buildIssueReportArtifactManifestSummary(
        loadedWorkflow.manifestPath,
        workflowManifest,
        validateIssueReportArtifactManifestRelations(bundle),
      ),
    ).toMatchObject({
      summaryRelativePath: 'summary.md',
      summaryUrl: 'https://example.com/issue-index-base/summary.md',
      indexSummaryPath: path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'),
      indexSummaryRelativePath: 'index-summary.md',
      indexSummaryUrl: 'https://example.com/issue-index-base/index-summary.md',
      indexSummaryJsonPath: path.join(
        cwd,
        '.tmp',
        'workflow-issue-artifacts',
        'index-summary.json',
      ),
      indexSummaryJsonRelativePath: 'index-summary.json',
      indexSummaryJsonUrl: 'https://example.com/issue-index-base/index-summary.json',
      indexSurfacePath: path.join(
        cwd,
        '.tmp',
        'workflow-issue-artifacts',
        'index-surface.json',
      ),
      indexSurfaceRelativePath: 'index-surface.json',
      indexSurfaceUrl: 'https://example.com/issue-index-base/index-surface.json',
      artifactIndexPath: path.join(
        cwd,
        '.tmp',
        'workflow-issue-artifacts',
        'artifact-index.json',
      ),
      artifactIndexRelativePath: 'artifact-index.json',
      artifactIndexUrl: 'https://example.com/issue-index-base/artifact-index.json',
      packetSummaryPath: workflow.packetSummaryPath,
      packetSummaryRelativePath: 'summary.md',
      packetSummaryUrl: 'https://example.com/issue-packets/summary.md',
      linkedPublishGateHotspotCount: 0,
      totalPublishGateHotspotCount: 0,
      packetSegmentCount: 1,
      packetReasonCount: 1,
      packetCsvCount: 5,
    })
  })

  it('validates workflow summary sidecars when they are present', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-manifest-summary-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
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

    const index = await buildIssueReportArtifactIndex(workflow.manifestPath)
    const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index,
      options: {
        label: 'Nightly',
        inputArtifactType: 'issue-report-artifact-index',
      },
    })
    await fs.writeFile(
      workflow.indexSummaryJsonPath,
      `${JSON.stringify(summaryJson, null, 2)}\n`,
      'utf8',
    )
    const surfaceSummary = buildIssueReportArtifactSummaryJsonSurfaceSummary(
      await loadIssueReportArtifactSummaryJsonOutput(workflow.indexSummaryJsonPath),
    )
    await fs.writeFile(
      workflow.indexSurfacePath,
      `${JSON.stringify(surfaceSummary, null, 2)}\n`,
      'utf8',
    )

    const loadedWorkflow = await loadIssueReportArtifactManifest(workflow.manifestPath)
    const workflowManifest = assertIssueReportArtifactManifestKind(
      loadedWorkflow.manifest,
      'workflow',
    )
    await expect(validateIssueReportArtifactSummaryFiles(workflowManifest)).resolves.toEqual({
      indexSummaryJsonArtifactType: 'issue-report-artifact-summary-json',
      indexSummaryJsonSchemaVersion: 1,
      indexSurfaceArtifactType: 'issue-report-artifact-summary-surface',
      indexSurfaceSchemaVersion: 1,
    })

    const bundle = await loadIssueReportArtifactManifestBundle(workflow.manifestPath)
    const relationSummary = validateIssueReportArtifactManifestRelations(bundle)
    const summaryValidation = await validateIssueReportArtifactSummaryFiles(workflowManifest)
    expect(
      buildIssueReportArtifactManifestSummary(
        loadedWorkflow.manifestPath,
        workflowManifest,
        relationSummary,
        summaryValidation,
      ),
    ).toMatchObject({
      indexSummaryJsonArtifactType: 'issue-report-artifact-summary-json',
      indexSummaryJsonSchemaVersion: 1,
      indexSurfaceArtifactType: 'issue-report-artifact-summary-surface',
      indexSurfaceSchemaVersion: 1,
    })
  })

  it('loads and validates manual summary artifact manifests', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-manual-manifest-'))
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
    const outRoot = path.dirname(artifacts.manifestPath)
    const packetArtifactUrl = 'https://example.com/manual-packets'
    const packetRoot = path.join(outRoot, 'packets')
    const { packetSummaryPath, packetManifestPath } = await writeManualPacketBundle(
      packetRoot,
      packetArtifactUrl,
    )
    const manifestRecord = JSON.parse(
      await fs.readFile(artifacts.manifestPath, 'utf8'),
    ) as Record<string, unknown>
    Object.assign(manifestRecord, {
      packetArtifactUrl,
      packetRootPath: packetRoot,
      packetSummaryPath,
      packetSummaryRelativePath: 'summary.md',
      packetSummaryUrl: `${packetArtifactUrl}/summary.md`,
      packetManifestPath,
      packetManifestRelativePath: 'manifest.json',
      packetManifestUrl: `${packetArtifactUrl}/manifest.json`,
      packetPaths: [packetSummaryPath, packetManifestPath],
    })
    await fs.writeFile(artifacts.manifestPath, `${JSON.stringify(manifestRecord, null, 2)}\n`, 'utf8')

    const loaded = await loadIssueReportArtifactManifest(artifacts.manifestPath)
    const manifest = assertIssueReportArtifactManifestKind(loaded.manifest, 'manual')
    expect(getIssueReportArtifactManifestKind(manifest)).toBe('manual')
    await expect(validateIssueReportArtifactSummaryFiles(manifest)).resolves.toEqual({
      indexSummaryJsonArtifactType: 'issue-report-artifact-summary-json',
      indexSummaryJsonSchemaVersion: 1,
      indexSurfaceArtifactType: 'issue-report-artifact-summary-surface',
      indexSurfaceSchemaVersion: 1,
    })
    const bundle = await loadIssueReportArtifactManifestBundle(artifacts.manifestPath)
    const relationSummary = validateIssueReportArtifactManifestRelations(bundle)
    expect(relationSummary).toMatchObject({
      linkedPublishGateHotspotCount: 0,
      totalPublishGateHotspotCount: 0,
      packetSegmentCount: 0,
      packetReasonCount: 0,
      packetCsvCount: 0,
    })
    const manualSummary = buildIssueReportArtifactManifestSummary(
      loaded.manifestPath,
      manifest,
      relationSummary,
    )
    expect(manualSummary).toMatchObject({
      packetRootPath: packetRoot,
      packetRootUrl: packetArtifactUrl,
      packetSummaryPath,
      packetSummaryRelativePath: 'summary.md',
      packetSummaryUrl: `${packetArtifactUrl}/summary.md`,
      packetManifestPath,
      packetManifestRelativePath: 'manifest.json',
      packetManifestUrl: `${packetArtifactUrl}/manifest.json`,
    })
    expect(renderIssueReportArtifactManifestSummary(manualSummary)).toContain(
      `Packet root: ${packetRoot}`,
    )
    expect(renderIssueReportArtifactManifestSummary(manualSummary)).toContain(
      `Packet root URL: ${packetArtifactUrl}`,
    )
  })

  it('rejects manual manifests whose packet portable fields drift from packet paths and URLs', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-manual-packet-drift-'))
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
        summaryUrl: null,
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
        inputUrl: null,
        publishGateSummaryUrl: null,
        topCount: 3,
        indexBaseUrl: null,
      },
      cwd,
    )
    const outRoot = path.dirname(artifacts.manifestPath)
    const packetArtifactUrl = 'https://example.com/manual-packets'
    const packetRoot = path.join(outRoot, 'packets')
    const { packetSummaryPath, packetManifestPath } = await writeManualPacketBundle(
      packetRoot,
      packetArtifactUrl,
    )
    const manifestRecord = JSON.parse(
      await fs.readFile(artifacts.manifestPath, 'utf8'),
    ) as Record<string, unknown>
    Object.assign(manifestRecord, {
      packetArtifactUrl,
      packetRootPath: packetRoot,
      packetSummaryPath,
      packetSummaryRelativePath: 'bad-summary.md',
      packetSummaryUrl: `${packetArtifactUrl}/summary.md`,
      packetManifestPath,
      packetManifestRelativePath: 'manifest.json',
      packetManifestUrl: `${packetArtifactUrl}/wrong-manifest.json`,
      packetPaths: [packetSummaryPath, packetManifestPath],
    })
    await fs.writeFile(artifacts.manifestPath, `${JSON.stringify(manifestRecord, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(artifacts.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow(
      'manual packetSummaryRelativePath must resolve to manual packetSummaryPath',
    )
    await expect(
      loadIssueReportArtifactManifestBundle(artifacts.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow(
      'manual packetManifestUrl must align with manual packetRootUrl and packetManifestRelativePath',
    )
  })

  it('rejects schema version mismatches and bad expected kinds', () => {
    expect(() =>
      parseIssueReportArtifactManifest({
        artifactType: 'issue-report-triage-packets',
        schemaVersion: 99,
      }),
    ).toThrow('schemaVersion must be 1')

    expect(() =>
      assertIssueReportArtifactManifestKind(
        {
          artifactType: 'issue-report-workflow-artifacts',
          schemaVersion: 1,
          generatedAt: '2026-04-06T00:00:00.000Z',
          outRoot: '.tmp',
          publishGateSummary: null,
          publishGateHotspots: [],
          topDistricts: [],
          packetRootUrl: null,
          packetArtifactUrl: null,
          csvRootUrl: null,
          csvArtifactUrl: null,
          packetRootPath: '.tmp/packets',
          preferredCsvPath: null,
          preferredCsvRelativePath: null,
          preferredCsvUrl: null,
          packetSummaryPath: '.tmp/packets/summary.md',
          packetSummaryRelativePath: 'summary.md',
          packetSummaryUrl: null,
          packetManifestPath: '.tmp/packets/manifest.json',
          packetManifestRelativePath: 'manifest.json',
          packetManifestUrl: null,
          csvRootPath: '.tmp/csv',
          summaryPath: '.tmp/summary.md',
          summaryRelativePath: 'summary.md',
          summaryUrl: null,
          indexSummaryPath: '.tmp/index-summary.md',
          indexSummaryRelativePath: 'index-summary.md',
          indexSummaryUrl: null,
          indexSummaryJsonPath: '.tmp/index-summary.json',
          indexSummaryJsonRelativePath: 'index-summary.json',
          indexSummaryJsonUrl: null,
          indexSurfacePath: '.tmp/index-surface.json',
          indexSurfaceRelativePath: 'index-surface.json',
          indexSurfaceUrl: null,
          artifactIndexPath: '.tmp/artifact-index.json',
          artifactIndexRelativePath: 'artifact-index.json',
          artifactIndexUrl: null,
          manifestPath: '.tmp/manifest.json',
          packetPaths: [],
          csvPaths: [],
          storageFile: '.tmp/sync-service.json',
          totalCount: 0,
          filteredCount: 0,
        },
        'packet',
      ),
    ).toThrow('manifest kind mismatch: expected packet, received workflow')
  })

  it('labels packet manifest base-url alias type errors explicitly', () => {
    expect(() =>
      parseIssueReportArtifactManifest(
        {
          artifactType: 'issue-report-triage-packets',
          schemaVersion: 1,
          generatedAt: '2026-04-06T00:00:00.000Z',
          storageFile: '.tmp/sync-service.json',
          filters: {
            scope: null,
            districtId: null,
            segmentId: null,
            reasonCode: null,
            since: null,
          },
          totalCount: 0,
          filteredCount: 0,
          packetRootPath: '.tmp/packets',
          packetRootUrl: null,
          packetBaseUrl: 42,
          csvRootPath: null,
          csvRootUrl: null,
          csvBaseUrl: null,
          summaryPath: '.tmp/packets/summary.md',
          summaryRelativePath: 'summary.md',
          summaryUrl: null,
          publishGateSummary: null,
          publishGateHotspots: [],
          segmentPackets: [],
          reasonPackets: [],
          csvExports: [],
        },
        'packetManifest',
      ),
    ).toThrow(
      'packetManifest.packetBaseUrl is a legacy compat alias for packetRootUrl and must be a string or null',
    )
  })

  it('labels workflow artifact-url alias type errors explicitly', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-workflow-alias-type-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as Record<string, unknown>
    parsed.packetRootUrl = null
    parsed.packetArtifactUrl = 42

    expect(() => parseIssueReportArtifactManifest(parsed, 'workflowManifest')).toThrow(
      'workflowManifest.packetArtifactUrl is a legacy compat alias for packetRootUrl and must be a string or null',
    )
  })

  it('labels manual hotspot artifact-url alias type errors explicitly', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-manual-hotspot-alias-'))
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
        summaryUrl: null,
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
        inputUrl: null,
        publishGateSummaryUrl: null,
        topCount: 3,
        indexBaseUrl: null,
      },
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(artifacts.manifestPath, 'utf8')) as Record<string, unknown>
    parsed.publishGateHotspots = [
      {
        districtId: 'xinyi',
        segmentLabel: null,
        packetPath: null,
        packetRootUrl: null,
        packetArtifactUrl: 42,
        csvRootUrl: null,
        csvArtifactUrl: null,
      },
    ]

    expect(() => parseIssueReportArtifactManifest(parsed, 'manualManifest')).toThrow(
      'manualManifest.publishGateHotspots[0].packetArtifactUrl is a legacy compat alias for packetRootUrl and must be a string or null',
    )
  })

  it('normalizes same-as-root workflow hotspot artifact-url aliases to null', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-workflow-hotspot-alias-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as Record<string, unknown>
    parsed.publishGateHotspots = [
      {
        districtId: 'xinyi',
        segmentLabel: 'C2 curb',
        packetPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        packetArtifactUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
        csvArtifactUrl: 'https://example.com/issue-csv',
      },
    ]

    const manifest = assertIssueReportArtifactManifestKind(
      parseIssueReportArtifactManifest(parsed, 'workflowManifest'),
      'workflow',
    )
    expect(manifest.publishGateHotspots).toMatchObject([
      {
        districtId: 'xinyi',
        packetRootUrl: 'https://example.com/issue-packets',
        packetArtifactUrl: null,
        csvRootUrl: 'https://example.com/issue-csv',
        csvArtifactUrl: null,
      },
    ])
  })

  it('normalizes same-as-root manual hotspot artifact-url aliases to null', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-manual-hotspot-normalize-'))
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
        summaryUrl: null,
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
        inputUrl: null,
        publishGateSummaryUrl: null,
        topCount: 3,
        indexBaseUrl: null,
      },
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(artifacts.manifestPath, 'utf8')) as Record<string, unknown>
    parsed.publishGateHotspots = [
      {
        districtId: 'xinyi',
        segmentLabel: 'C2 curb',
        packetPath: null,
        packetRootUrl: 'https://example.com/manual-packets',
        packetArtifactUrl: 'https://example.com/manual-packets',
        csvRootUrl: 'https://example.com/manual-csv',
        csvArtifactUrl: 'https://example.com/manual-csv',
      },
    ]

    const manifest = assertIssueReportArtifactManifestKind(
      parseIssueReportArtifactManifest(parsed, 'manualManifest'),
      'manual',
    )
    expect(manifest.publishGateHotspots).toMatchObject([
      {
        districtId: 'xinyi',
        packetRootUrl: 'https://example.com/manual-packets',
        packetArtifactUrl: null,
        csvRootUrl: 'https://example.com/manual-csv',
        csvArtifactUrl: null,
      },
    ])
  })

  it('rejects workflow manifests whose packet links drift from the nested packet manifest', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-manifest-drift-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    const publishGateSummaryPath = path.join(cwd, '.tmp', 'publish-gate-summary.json')
    await writeSyncStoreFile(syncStorePath, createStore())
    await fs.writeFile(
      publishGateSummaryPath,
      JSON.stringify(
        {
          generatedAt: '2026-04-06T00:00:00.000Z',
          mode: 'warn',
          exitCode: 0,
          allowWarn: true,
          allowFail: false,
          overrideReason: 'test',
          totals: { info: 0, warn: 1, fail: 0 },
          districts: [
            {
              districtId: 'xinyi',
              warn: 1,
              fail: 0,
              topWarnCodes: ['WARN_CODE'],
              topFailCodes: [],
              signOverrideBreakdown: {
                matchedBySegmentId: 1,
                matchedBySpatial: 0,
                unmatchedNamed: 0,
              },
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    )

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: '.tmp/publish-gate-summary.json',
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      publishGateHotspots: Array<{
        districtId: string
        segmentLabel: string | null
        packetPath: string | null
        packetArtifactUrl: string | null
        csvArtifactUrl: string | null
      }>
    }
    parsed.publishGateHotspots = parsed.publishGateHotspots.map((entry) => ({
      ...entry,
      packetPath: 'top-segments/99-bad-link.json',
    }))
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow('issue report artifact relation validation failed')
  })

  it('rejects workflow manifests whose packet portable fields drift from packet paths and URLs', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-workflow-packet-drift-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      packetSummaryRelativePath: string
      packetManifestUrl: string | null
    }
    parsed.packetSummaryRelativePath = 'bad-summary.md'
    parsed.packetManifestUrl = 'https://example.com/issue-packets/wrong-manifest.json'
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow(
      'workflow packetSummaryRelativePath must resolve to workflow packetSummaryPath',
    )
    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow(
      'workflow packetManifestUrl must align with workflow packetRootUrl and packetManifestRelativePath',
    )
  })

  it('rejects workflow manifests whose index summary path drifts outside outRoot', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-index-summary-drift-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      indexSummaryPath: string
    }
    parsed.indexSummaryPath = path.join(cwd, 'outside', 'index-summary.md')
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow('workflow indexSummaryPath must stay within workflow outRoot')
  })

  it('rejects workflow manifests whose index summary relative path does not resolve to indexSummaryPath', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-index-summary-relative-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      indexSummaryRelativePath: string
    }
    parsed.indexSummaryRelativePath = 'nested/index-summary.md'
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow('workflow indexSummaryRelativePath must resolve to workflow indexSummaryPath')
  })

  it('rejects workflow manifests whose index summary json path drifts outside outRoot', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-index-summary-json-drift-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      indexSummaryJsonPath: string
    }
    parsed.indexSummaryJsonPath = path.join(cwd, 'outside', 'index-summary.json')
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow('workflow indexSummaryJsonPath must stay within workflow outRoot')
  })

  it('rejects workflow manifests whose index summary json relative path does not resolve to indexSummaryJsonPath', async () => {
    const cwd = await fs.mkdtemp(
      path.join(tmpdir(), 'issue-artifact-index-summary-json-relative-'),
    )
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      indexSummaryJsonRelativePath: string
    }
    parsed.indexSummaryJsonRelativePath = 'nested/index-summary.json'
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow(
      'workflow indexSummaryJsonRelativePath must resolve to workflow indexSummaryJsonPath',
    )
  })

  it('rejects workflow manifests whose index surface path drifts outside outRoot', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-index-surface-drift-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      indexSurfacePath: string
    }
    parsed.indexSurfacePath = path.join(cwd, 'outside', 'index-surface.json')
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow('workflow indexSurfacePath must stay within workflow outRoot')
  })

  it('rejects workflow manifests whose index surface relative path does not resolve to indexSurfacePath', async () => {
    const cwd = await fs.mkdtemp(
      path.join(tmpdir(), 'issue-artifact-index-surface-relative-'),
    )
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      indexSurfaceRelativePath: string
    }
    parsed.indexSurfaceRelativePath = 'nested/index-surface.json'
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow(
      'workflow indexSurfaceRelativePath must resolve to workflow indexSurfacePath',
    )
  })

  it('rejects workflow manifests whose artifact index path drifts outside outRoot', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-index-drift-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      artifactIndexPath: string
    }
    parsed.artifactIndexPath = path.join(cwd, 'outside', 'artifact-index.json')
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow('workflow artifactIndexPath must stay within workflow outRoot')
  })

  it('rejects workflow manifests whose artifact index relative path does not resolve to artifactIndexPath', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-index-relative-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      artifactIndexRelativePath: string
    }
    parsed.artifactIndexRelativePath = 'nested/artifact-index.json'
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow(
      'workflow artifactIndexRelativePath must resolve to workflow artifactIndexPath',
    )
  })

  it('rejects workflow manifests whose preferred csv url drifts from csvRootUrl and preferredCsvRelativePath', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-preferred-csv-url-drift-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: 'https://example.com/issue-packets',
        csvRootUrl: 'https://example.com/issue-csv',
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      preferredCsvUrl: string | null
    }
    parsed.preferredCsvUrl = 'https://example.com/issue-csv/wrong.csv'
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow(
      'workflow preferredCsvUrl must align with workflow csvRootUrl and preferredCsvRelativePath',
    )
  })

  it('rejects workflow manifests whose summary relative path does not resolve to summaryPath', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-relative-'))
    const syncStorePath = path.join(cwd, '.tmp', 'sync-service.json')
    await writeSyncStoreFile(syncStorePath, createStore())

    const workflow = await buildIssueReportWorkflowArtifacts(
      {
        syncStorePath: '.tmp/sync-service.json',
        outRoot: '.tmp/workflow-issue-artifacts',
        limit: 5,
        packetIssueLimit: 2,
        publishGateSummaryPath: null,
        packetRootUrl: null,
        csvRootUrl: null,
      },
      {},
      cwd,
    )

    const parsed = JSON.parse(await fs.readFile(workflow.manifestPath, 'utf8')) as {
      summaryRelativePath: string
    }
    parsed.summaryRelativePath = 'nested/summary.md'
    await fs.writeFile(workflow.manifestPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')

    await expect(
      loadIssueReportArtifactManifestBundle(workflow.manifestPath).then(
        validateIssueReportArtifactManifestRelations,
      ),
    ).rejects.toThrow('workflow summaryRelativePath must resolve to workflow summaryPath')
  })
})
