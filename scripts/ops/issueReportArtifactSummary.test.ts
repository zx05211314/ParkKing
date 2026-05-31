import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildIssueReportArtifactIndex } from './issueReportArtifactIndex'
import { buildIssueReportSummaryJsonOutput } from './issueReportSummary'
import {
  buildIssueReportArtifactSummaryJsonOutput,
  loadIssueReportArtifactSummaryInput,
  loadIssueReportArtifactSummaryInputDetails,
  parseIssueReportArtifactSummaryJsonOutput,
  parseIssueReportArtifactSummarySurfaceSummary,
  renderIssueReportArtifactSummary,
  renderIssueReportArtifactSummaryWriteResult,
  resolveIssueReportArtifactSummaryOutPath,
} from './issueReportArtifactSummary'
import {
  buildIssueReportArtifactSummaryJsonSurfaceSummary,
  loadIssueReportArtifactSummaryJsonOutput,
} from './issueReportArtifactSummaryJson'
import { buildIssueReportSummaryArtifacts } from './issueReportSummaryArtifacts'
import { buildIssueReportSummaryIndex } from './issueReportSummaryIndex'
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

describe('issueReportArtifactSummary', () => {
  it('renders a workflow summary from artifact-index.json', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-'))
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
          allowFail: false,
          allowFailRequested: false,
          allowBaselineAdopt: false,
          overrideReason: null,
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
            fail: 0,
          },
          districts: [
            {
              districtId: 'xinyi',
              info: 0,
              warn: 1,
              fail: 0,
              topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
              topFailCodes: [],
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
    const content = renderIssueReportArtifactSummary(index, {
      label: 'Publish',
      inputUrl: 'https://example.com/issue-index',
      publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      topCount: 3,
    })

    expect(content).toContain('# Publish Issue Artifact Summary')
    expect(content).toContain('Input surface: issue-report-artifact-index')
    expect(content).toContain('Issue input: [download artifact](https://example.com/issue-index)')
    expect(content).toContain('Workflow summary entry: summary.md')
    expect(content).toContain(
      'Workflow summary URL: [download artifact](https://example.com/issue-index-base/summary.md)',
    )
    expect(content).toContain('Issue index summary entry: index-summary.md')
    expect(content).toContain(
      'Issue index summary URL: [download artifact](https://example.com/issue-index-base/index-summary.md)',
    )
    expect(content).toContain('Issue index summary json entry: index-summary.json')
    expect(content).toContain(
      'Issue index summary json URL: [download artifact](https://example.com/issue-index-base/index-summary.json)',
    )
    expect(content).toContain('Issue index surface entry: index-surface.json')
    expect(content).toContain(
      'Issue index surface URL: [download artifact](https://example.com/issue-index-base/index-surface.json)',
    )
    expect(content).toContain('Issue artifact index entry: artifact-index.json')
    expect(content).toContain(
      'Issue artifact index URL: [download artifact](https://example.com/issue-index-base/artifact-index.json)',
    )
    expect(content).toContain('Packet summary entry: summary.md')
    expect(content).toContain(
      'Packet summary URL: [download artifact](https://example.com/issue-packets/summary.md)',
    )
    expect(content).toContain(
      'Packet manifest entry: manifest.json',
    )
    expect(content).toContain(
      'Packet manifest URL: [download artifact](https://example.com/issue-packets/manifest.json)',
    )
    expect(content).toContain(
      'Publish gate summary: [download artifact](https://example.com/publish-gate-summary)',
    )
    expect(content).toContain('Preferred CSV join file: publish-gate-districts.csv')
    expect(content).toContain(
      'Preferred CSV join file URL: [download artifact](https://example.com/issue-csv/publish-gate-districts.csv)',
    )
    expect(content).toContain('## Publish Gate Hotspots')
    expect(content).toContain(
      '| xinyi | 1 | 0 | 3 | 1 | 2 | C2 curb (seg-1) | https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json |',
    )
    expect(content).toContain('## Top Issue Segments')
    expect(content).toContain('## Top Issue Reasons')
    expect(content).toContain('| publish-gate-districts.csv | https://example.com/issue-csv/publish-gate-districts.csv |')
    expect(
      renderIssueReportArtifactSummaryWriteResult(
        path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'),
        index,
        {
          label: 'Publish',
          inputUrl: 'https://example.com/issue-index',
          publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
          topCount: 3,
          inputArtifactType: 'issue-report-artifact-index',
        },
      ),
    ).toContain(
      `Wrote issue report artifact summary to ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md')}`,
    )
    expect(
      renderIssueReportArtifactSummaryWriteResult(
        path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'),
        index,
        {
          label: 'Publish',
          inputUrl: 'https://example.com/issue-index',
          publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
          topCount: 3,
          inputArtifactType: 'issue-report-artifact-index',
        },
      ),
    ).toContain('Input surface: issue-report-artifact-index')
    expect(
      resolveIssueReportArtifactSummaryOutPath(index, {
        outPath: null,
        json: false,
        writeIndexSummary: true,
      }),
    ).toBe(path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'))
    expect(
      resolveIssueReportArtifactSummaryOutPath(index, {
        outPath: null,
        json: true,
        writeIndexSummary: true,
      }),
    ).toBe(path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.json'))
    expect(
      resolveIssueReportArtifactSummaryOutPath(index, {
        outPath: '.tmp/custom-summary.md',
        json: false,
        writeIndexSummary: true,
      }),
    ).toBe('.tmp/custom-summary.md')

    const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index,
      options: {
        label: 'Publish',
        inputUrl: 'https://example.com/issue-index',
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
        topCount: 3,
        inputArtifactType: 'issue-report-artifact-index',
      },
    })
    expect(summaryJson.artifactType).toBe('issue-report-artifact-summary-json')
    expect(summaryJson.schemaVersion).toBe(1)
    expect(summaryJson.inputArtifactType).toBe('issue-report-artifact-index')
    expect(summaryJson.summaryEntries.workflowSummaryRelativePath).toBe('summary.md')
    expect(summaryJson.summaryEntries.indexSummaryRelativePath).toBe('index-summary.md')
    expect(summaryJson.summaryEntries.indexSummaryJsonRelativePath).toBe('index-summary.json')
    expect(summaryJson.summaryEntries.indexSurfaceRelativePath).toBe('index-surface.json')
    expect(summaryJson.summaryEntries.artifactIndexRelativePath).toBe('artifact-index.json')
    expect(summaryJson.summaryEntries.preferredCsvRelativePath).toBe(
      'publish-gate-districts.csv',
    )
    expect(summaryJson.artifactLinks.summaryUrl).toBe(
      'https://example.com/issue-index-base/summary.md',
    )
    expect(summaryJson.artifactLinks.indexSummaryUrl).toBe(
      'https://example.com/issue-index-base/index-summary.md',
    )
    expect(summaryJson.artifactLinks.indexSummaryJsonUrl).toBe(
      'https://example.com/issue-index-base/index-summary.json',
    )
    expect(summaryJson.artifactLinks.indexSurfaceUrl).toBe(
      'https://example.com/issue-index-base/index-surface.json',
    )
    expect(summaryJson.artifactLinks.artifactIndexUrl).toBe(
      'https://example.com/issue-index-base/artifact-index.json',
    )
    expect(summaryJson.summaryEntries.packetRootRelativePath).toBe('packets')
    expect(summaryJson.summaryEntries.csvRootRelativePath).toBe('csv')
    expect(summaryJson.summaryEntries.packetManifestRelativePath).toBe('manifest.json')
    expect(summaryJson.artifactLinks.packetSummaryUrl).toBe(
      'https://example.com/issue-packets/summary.md',
    )
    expect(summaryJson.artifactLinks.packetManifestUrl).toBe(
      'https://example.com/issue-packets/manifest.json',
    )
    expect(summaryJson.artifactLinks.preferredCsvUrl).toBe(
      'https://example.com/issue-csv/publish-gate-districts.csv',
    )
    const canonicalPreferredCsvSummaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index: {
        ...index,
        rootManifest: {
          ...index.rootManifest,
          preferredCsvUrl: 'https://example.com/issue-csv/root-canonical-publish-gate-districts.csv',
          packetSummaryRelativePath: 'root-summary.md',
          packetSummaryUrl: 'https://example.com/issue-packets/root-summary.md',
          packetManifestRelativePath: 'root-manifest.json',
          packetManifestUrl: 'https://example.com/issue-packets/root-manifest.json',
        },
        preferredCsvFile: index.preferredCsvFile
          ? {
            ...index.preferredCsvFile,
            url: 'https://example.com/issue-csv/packet-canonical-publish-gate-districts.csv',
            }
          : null,
      },
      options: {
        inputArtifactType: 'issue-report-artifact-index',
      },
    })
    expect(canonicalPreferredCsvSummaryJson.artifactLinks.preferredCsvUrl).toBe(
      'https://example.com/issue-csv/root-canonical-publish-gate-districts.csv',
    )
    expect(canonicalPreferredCsvSummaryJson.summaryEntries.packetSummaryRelativePath).toBe(
      'root-summary.md',
    )
    expect(canonicalPreferredCsvSummaryJson.summaryEntries.packetManifestRelativePath).toBe(
      'root-manifest.json',
    )
    expect(canonicalPreferredCsvSummaryJson.artifactLinks.packetSummaryUrl).toBe(
      'https://example.com/issue-packets/root-summary.md',
    )
    expect(canonicalPreferredCsvSummaryJson.artifactLinks.packetManifestUrl).toBe(
      'https://example.com/issue-packets/root-manifest.json',
    )
    expect(summaryJson.artifactLinks.packetArtifactUrl).toBe(
      null,
    )
    expect(summaryJson.artifactLinks.packetRootUrl).toBe(
      'https://example.com/issue-packets',
    )
    expect(summaryJson.artifactLinks.csvRootUrl).toBe(
      'https://example.com/issue-csv',
    )
    const legacyRootSummary = renderIssueReportArtifactSummary(
      {
        ...summaryJson,
        artifactLinks: {
          ...summaryJson.artifactLinks,
          packetRootUrl: 'https://example.com/canonical-issue-packets',
          packetArtifactUrl: 'https://legacy.example.com/issue-packets',
          csvRootUrl: 'https://example.com/canonical-issue-csv',
          csvArtifactUrl: 'https://legacy.example.com/issue-csv',
        },
      },
      {
        inputArtifactType: 'issue-report-artifact-summary-json',
      },
    )
    expect(legacyRootSummary).toContain(
      'Packet root URL: [download artifact](https://example.com/canonical-issue-packets)',
    )
    expect(legacyRootSummary).toContain(
      'CSV exchange root URL: [download artifact](https://example.com/canonical-issue-csv)',
    )
    expect(legacyRootSummary).toContain(
      'Legacy packet artifact URL: [download artifact](https://legacy.example.com/issue-packets)',
    )
    expect(legacyRootSummary).toContain(
      'Legacy CSV artifact URL: [download artifact](https://legacy.example.com/issue-csv)',
    )
    expect(
      parseIssueReportArtifactSummaryJsonOutput(summaryJson).summaryEntries
        .indexSummaryJsonRelativePath,
    ).toBe('index-summary.json')
    const parsedAliasOnlySummaryJson = parseIssueReportArtifactSummaryJsonOutput({
      ...summaryJson,
      artifactLinks: {
        ...summaryJson.artifactLinks,
        packetRootUrl: null,
        packetArtifactUrl: 'https://legacy.example.com/issue-packets',
        csvRootUrl: null,
        csvArtifactUrl: 'https://legacy.example.com/issue-csv',
        preferredCsvUrl: null,
        packetSummaryUrl: null,
        packetManifestUrl: null,
      },
    })
    expect(parsedAliasOnlySummaryJson.artifactLinks.packetRootUrl).toBe(
      'https://legacy.example.com/issue-packets',
    )
    expect(parsedAliasOnlySummaryJson.artifactLinks.csvRootUrl).toBe(
      'https://legacy.example.com/issue-csv',
    )
    expect(parsedAliasOnlySummaryJson.artifactLinks.preferredCsvUrl).toBe(
      'https://legacy.example.com/issue-csv/publish-gate-districts.csv',
    )
    expect(parsedAliasOnlySummaryJson.artifactLinks.packetSummaryUrl).toBe(
      'https://legacy.example.com/issue-packets/summary.md',
    )
    expect(parsedAliasOnlySummaryJson.artifactLinks.packetManifestUrl).toBe(
      'https://legacy.example.com/issue-packets/manifest.json',
    )
    const aliasOnlySurfaceFromSummaryJson = buildIssueReportArtifactSummaryJsonSurfaceSummary({
      summaryPath: path.join(
        cwd,
        '.tmp',
        'workflow-issue-artifacts',
        'index-summary.json',
      ),
      summary: parsedAliasOnlySummaryJson,
    })
    expect(aliasOnlySurfaceFromSummaryJson.packetRootUrl).toBe(
      'https://legacy.example.com/issue-packets',
    )
    expect(aliasOnlySurfaceFromSummaryJson.csvRootUrl).toBe(
      'https://legacy.example.com/issue-csv',
    )
    expect(aliasOnlySurfaceFromSummaryJson.packetSummaryUrl).toBe(
      'https://legacy.example.com/issue-packets/summary.md',
    )
    expect(aliasOnlySurfaceFromSummaryJson.packetManifestUrl).toBe(
      'https://legacy.example.com/issue-packets/manifest.json',
    )
    expect(
      renderIssueReportArtifactSummary(parsedAliasOnlySummaryJson, {
        inputArtifactType: 'issue-report-artifact-summary-json',
      }),
    ).toContain(
      'Packet root URL: [download artifact](https://legacy.example.com/issue-packets)',
    )
    expect(
      renderIssueReportArtifactSummary(parsedAliasOnlySummaryJson, {
        inputArtifactType: 'issue-report-artifact-summary-json',
      }),
    ).not.toContain('Legacy packet artifact URL:')

    const indexSummaryJsonPath = path.join(
      cwd,
      '.tmp',
      'workflow-issue-artifacts',
      'index-summary.json',
    )
    await fs.writeFile(indexSummaryJsonPath, JSON.stringify(summaryJson, null, 2), 'utf8')

    const loadedSummaryJson = await loadIssueReportArtifactSummaryInputDetails(
      indexSummaryJsonPath,
    )
    expect(loadedSummaryJson.inputArtifactType).toBe(
      'issue-report-artifact-summary-json',
    )
    expect(loadedSummaryJson.index.artifactType).toBe(
      'issue-report-artifact-summary-json',
    )
    expect(
      renderIssueReportArtifactSummary(loadedSummaryJson.index, {
        inputArtifactType: loadedSummaryJson.inputArtifactType,
      }),
    ).toContain('Input surface: issue-report-artifact-summary-json')
    expect(
      buildIssueReportArtifactSummaryJsonOutput({
        index: loadedSummaryJson.index,
        options: {
          inputArtifactType: loadedSummaryJson.inputArtifactType,
        },
      }),
    ).toEqual(summaryJson)
    expect(
      resolveIssueReportArtifactSummaryOutPath(loadedSummaryJson.index, {
        outPath: null,
        json: true,
        writeIndexSummary: true,
      }),
    ).toBeNull()

    const indexSurfacePath = path.join(
      cwd,
      '.tmp',
      'workflow-issue-artifacts',
      'index-surface.json',
    )
    const surfaceSummary = buildIssueReportArtifactSummaryJsonSurfaceSummary(
      await loadIssueReportArtifactSummaryJsonOutput(indexSummaryJsonPath),
    )
    await fs.writeFile(indexSurfacePath, JSON.stringify(surfaceSummary, null, 2), 'utf8')

    const loadedSurface = await loadIssueReportArtifactSummaryInputDetails(indexSurfacePath)
    expect(loadedSurface.inputArtifactType).toBe(
      'issue-report-artifact-summary-surface',
    )
    expect(loadedSurface.index.artifactType).toBe(
      'issue-report-artifact-summary-surface',
    )
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain('Input surface: issue-report-artifact-summary-surface')
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain('Source summary surface: issue-report-artifact-summary-json v1')
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(`Packet root: ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'packets')}`)
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain('Packet root entry: packets')
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(`CSV exchange root: ${path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'csv')}`)
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain('Index surface entry: index-surface.json')
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(
      'Workflow summary URL: [download artifact](https://example.com/issue-index-base/summary.md)',
    )
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(
      'Index summary URL: [download artifact](https://example.com/issue-index-base/index-summary.md)',
    )
    const parsedAliasOnlySurface = parseIssueReportArtifactSummarySurfaceSummary({
      ...surfaceSummary,
      packetRootUrl: null,
      packetArtifactUrl: 'https://legacy.example.com/issue-packets',
      csvRootUrl: null,
      csvArtifactUrl: 'https://legacy.example.com/issue-csv',
      preferredCsvUrl: null,
      packetSummaryUrl: null,
      packetManifestUrl: null,
    })
    expect(parsedAliasOnlySurface.packetRootUrl).toBe(
      'https://legacy.example.com/issue-packets',
    )
    expect(parsedAliasOnlySurface.csvRootUrl).toBe(
      'https://legacy.example.com/issue-csv',
    )
    expect(parsedAliasOnlySurface.preferredCsvUrl).toBe(
      'https://legacy.example.com/issue-csv/publish-gate-districts.csv',
    )
    expect(parsedAliasOnlySurface.packetSummaryUrl).toBe(
      'https://legacy.example.com/issue-packets/summary.md',
    )
    expect(parsedAliasOnlySurface.packetManifestUrl).toBe(
      'https://legacy.example.com/issue-packets/manifest.json',
    )
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(
      'Index summary json URL: [download artifact](https://example.com/issue-index-base/index-summary.json)',
    )
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(
      'Index surface URL: [download artifact](https://example.com/issue-index-base/index-surface.json)',
    )
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain('Artifact index entry: artifact-index.json')
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(
      'Fallback compatibility input URL: [download artifact](https://example.com/issue-index-base/artifact-index.json)',
    )
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(
      '| xinyi | 1 | 0 | 3 | 1 | 2 | C2 curb (seg-1) | https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json |',
    )
    expect(
      renderIssueReportArtifactSummary(loadedSurface.index, {
        inputArtifactType: loadedSurface.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain(
      'Publish gate summary: [download artifact](https://example.com/publish-gate-summary)',
    )
    expect(
      resolveIssueReportArtifactSummaryOutPath(loadedSurface.index, {
        outPath: null,
        json: false,
        writeIndexSummary: true,
      }),
    ).toBe(path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'))
    expect(
      resolveIssueReportArtifactSummaryOutPath(loadedSurface.index, {
        outPath: null,
        json: true,
        writeIndexSummary: true,
      }),
    ).toBe(path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-surface.json'))
    expect(loadedSurface.index).toEqual(surfaceSummary)

    const loadedManifest = await loadIssueReportArtifactSummaryInputDetails(
      workflow.manifestPath,
    )
    expect(loadedManifest.inputArtifactType).toBe('issue-report-workflow-artifacts')
    expect(loadedManifest.index.artifactType).toBe(
      'issue-report-artifact-summary-surface',
    )
    expect(
      renderIssueReportArtifactSummary(loadedManifest.index, {
        inputArtifactType: loadedManifest.inputArtifactType,
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      }),
    ).toContain('Input surface: issue-report-workflow-artifacts')
  })

  it('renders the same summary surface from issue-report-summary-index.json', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-summary-artifact-summary-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')
    const summaryIndexPath = path.join(cwd, 'issue-summary-index.json')
    const packetManifestPath = path.join(cwd, 'issue-packets', 'manifest.json')

    const summaryJson = buildIssueReportSummaryJsonOutput({
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
      publishGateSummary: {
        generatedAt: '2026-04-02T12:30:00.000Z',
        summaryPath: null,
        summaryUrl: null,
        mode: 'strict',
        allowWarn: false,
        allowFail: false,
        overrideReason: null,
        totals: {
          info: 0,
          warn: 1,
          fail: 0,
        },
        topDistricts: [],
        exitCode: 0,
      },
      publishGateHotspots: [
        {
          districtId: 'xinyi',
          warn: 1,
          fail: 0,
          topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
          topFailCodes: [],
          directOverrideMatches: 3,
          spatialOverrideMatches: 1,
          unmatchedNamedOverrides: 2,
          issueHotspotSegmentId: 'seg-1',
          issueHotspotSegmentName: 'C2 curb',
          issueHotspotSegmentLabel: 'C2 curb (seg-1)',
        },
      ],
      artifacts: {
        summaryPath,
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: 'https://example.com/manual-summary/issue-summary.json',
        rawIssuesPath: path.join(cwd, 'raw-issues.json'),
        rawIssuesRelativePath: 'raw-issues.json',
        rawIssuesUrl: 'https://example.com/manual-raw/raw-issues.json',
        csvRootPath: path.join(cwd, 'issue-csv'),
        csvRootUrl: 'https://example.com/issue-csv',
        csvBaseUrl: 'https://example.com/issue-csv',
        csvPaths: [path.join(cwd, 'issue-csv', 'publish-gate-districts.csv')],
        csvRelativePaths: ['publish-gate-districts.csv'],
        packetRootPath: path.join(cwd, 'issue-packets'),
        packetRootUrl: 'https://example.com/issue-packets',
        packetBaseUrl: 'https://example.com/issue-packets',
        packetSummaryPath: path.join(cwd, 'issue-packets', 'summary.md'),
        packetSummaryRelativePath: 'summary.md',
        packetManifestPath: path.join(cwd, 'issue-packets', 'manifest.json'),
        packetManifestRelativePath: 'manifest.json',
        packetPaths: [
          path.join(cwd, 'issue-packets', 'top-segments', '01-alpha-xinyi-seg-1.json'),
          path.join(cwd, 'issue-packets', 'top-reasons', '01-time-window.json'),
        ],
        packetRelativePaths: [
          'top-segments/01-alpha-xinyi-seg-1.json',
          'top-reasons/01-time-window.json',
        ],
      },
    })

    const packetManifest = {
      artifactType: 'issue-report-triage-packets' as const,
      schemaVersion: 1 as const,
      generatedAt: '2026-04-02T12:31:00.000Z',
      storageFile: path.join(cwd, 'sync-service.json'),
      filters: {
        scope: 'alpha',
        districtId: 'xinyi',
        segmentId: null,
        reasonCode: null,
        since: null,
      },
      totalCount: 1,
      filteredCount: 1,
      packetRootPath: path.join(cwd, 'issue-packets'),
      packetRootUrl: 'https://example.com/issue-packets',
      packetBaseUrl: 'https://example.com/issue-packets',
      csvRootPath: path.join(cwd, 'issue-csv'),
      csvRootUrl: 'https://example.com/issue-csv',
      csvBaseUrl: 'https://example.com/issue-csv',
      summaryPath: path.join(cwd, 'issue-packets', 'summary.md'),
      summaryRelativePath: 'summary.md',
      summaryUrl: 'https://example.com/issue-packets/summary.md',
      publishGateSummary: summaryJson.publishGateSummary,
      publishGateHotspots: [
        {
          districtId: 'xinyi',
          warn: 1,
          fail: 0,
          topWarnCodes: ['METRIC_SIGN_OVERRIDE_UNMATCHED'],
          topFailCodes: [],
          directOverrideMatches: 3,
          spatialOverrideMatches: 1,
          unmatchedNamedOverrides: 2,
          issueHotspotSegmentId: 'seg-1',
          issueHotspotSegmentName: 'C2 curb',
          issueHotspotSegmentLabel: 'C2 curb (seg-1)',
          issueHotspotPacketPath: 'top-segments/01-alpha-xinyi-seg-1.json',
          issueHotspotPacketUrl:
            'https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json',
        },
      ],
      segmentPackets: [
        {
          rank: 1,
          packetId: 'segment-1',
          packetKind: 'segment' as const,
          label: 'C2 curb (seg-1)',
          relativePath: 'top-segments/01-alpha-xinyi-seg-1.json',
          url: 'https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json',
        },
      ],
      reasonPackets: [
        {
          rank: 1,
          packetId: 'reason-1',
          packetKind: 'reason' as const,
          label: 'TIME_WINDOW',
          relativePath: 'top-reasons/01-time-window.json',
          url: 'https://example.com/issue-packets/top-reasons/01-time-window.json',
        },
      ],
      csvExports: [
        {
          fileName: 'publish-gate-districts.csv',
          path: path.join(cwd, 'issue-csv', 'publish-gate-districts.csv'),
          url: 'https://example.com/issue-csv/publish-gate-districts.csv',
        },
      ],
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

    const loaded = await loadIssueReportArtifactSummaryInput(summaryIndexPath)
    const content = renderIssueReportArtifactSummary(loaded, {
      label: 'Manual',
      inputUrl: 'https://example.com/manual-index',
      publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
      topCount: 3,
    })

    expect(content).toContain('# Manual Issue Artifact Summary')
    expect(content).toContain('Input surface: issue-report-summary-index')
    expect(content).toContain('Issue input: [download artifact](https://example.com/manual-index)')
    expect(content).toContain('Issue index summary entry: index-summary.md')
    expect(content).toContain(
      'Issue index summary URL: [download artifact](https://example.com/manual-index-base/index-summary.md)',
    )
    expect(content).toContain('Issue index summary json entry: index-summary.json')
    expect(content).toContain(
      'Issue index summary json URL: [download artifact](https://example.com/manual-index-base/index-summary.json)',
    )
    expect(content).toContain('Issue index surface entry: index-surface.json')
    expect(content).toContain(
      'Issue index surface URL: [download artifact](https://example.com/manual-index-base/index-surface.json)',
    )
    expect(content).toContain('Issue artifact index entry: issue-summary-index.json')
    expect(content).toContain(
      'Issue artifact index URL: [download artifact](https://example.com/manual-index-base/issue-summary-index.json)',
    )
    expect(content).toContain('Manual artifacts manifest entry: artifacts-manifest.json')
    expect(content).toContain(
      'Manual artifacts manifest URL: [download artifact](https://example.com/manual-index-base/artifacts-manifest.json)',
    )
    expect(content).toContain('Preferred portable input: artifacts-manifest.json')
    expect(content).toContain(
      'Preferred portable input URL: [download artifact](https://example.com/manual-index-base/artifacts-manifest.json)',
    )
    expect(content).toContain('Fallback compatibility input: issue-summary-index.json')
    expect(content).toContain(
      'Fallback compatibility input URL: [download artifact](https://example.com/manual-index-base/issue-summary-index.json)',
    )
    expect(content).toContain('Source summary entry: issue-summary.json')
    expect(content).toContain(
      'Source summary URL: [download artifact](https://example.com/manual-summary/issue-summary.json)',
    )
    expect(content).toContain('Raw issues entry: raw-issues.json')
    expect(content).toContain(
      'Raw issues URL: [download artifact](https://example.com/manual-raw/raw-issues.json)',
    )
    expect(content).toContain('Packet summary entry: summary.md')
    expect(content).toContain('Packet manifest entry: manifest.json')
    expect(content).toContain(
      'Packet summary URL: [download artifact](https://example.com/issue-packets/summary.md)',
    )
    expect(content).toContain(
      'Packet manifest URL: [download artifact](https://example.com/issue-packets/manifest.json)',
    )
    expect(content).toContain('Preferred CSV join file: publish-gate-districts.csv')
    expect(content).toContain(
      'Preferred CSV join file URL: [download artifact](https://example.com/issue-csv/publish-gate-districts.csv)',
    )
    expect(content).toContain('Packet root URL: [download artifact](https://example.com/issue-packets)')
    expect(content).toContain('CSV exchange root URL: [download artifact](https://example.com/issue-csv)')
    expect(content).toContain(
      '| xinyi | 1 | 0 | 3 | 1 | 2 | C2 curb (seg-1) | https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json |',
    )
    expect(content).toContain(
      '| xinyi | C2 curb | 1 | GREEN | 2026-04-02T12:00:00.000Z | Driver could not interpret curb hours | https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json |',
    )
    expect(content).toContain(
      '| TIME_WINDOW | 1 | 1 | 1 | C2 curb | 2026-04-02T12:00:00.000Z | https://example.com/issue-packets/top-reasons/01-time-window.json |',
    )
    expect(content).toContain(
      '| publish-gate-districts.csv | https://example.com/issue-csv/publish-gate-districts.csv |',
    )
    expect(
      resolveIssueReportArtifactSummaryOutPath(loaded, {
        outPath: null,
        json: false,
        writeIndexSummary: true,
      }),
    ).toBe(path.join(cwd, 'index-summary.md'))
    expect(
      resolveIssueReportArtifactSummaryOutPath(loaded, {
        outPath: null,
        json: true,
        writeIndexSummary: true,
      }),
    ).toBe(path.join(cwd, 'index-summary.json'))

    const loadedFromSummaryJson = await loadIssueReportArtifactSummaryInput(summaryPath)
    expect(loadedFromSummaryJson.artifactType).toBe('issue-report-summary-index')
    expect(renderIssueReportArtifactSummary(loadedFromSummaryJson)).toContain(
      'https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json',
    )

    const loadedDetails = await loadIssueReportArtifactSummaryInputDetails(summaryPath)
    expect(loadedDetails.inputArtifactType).toBe('issue-report-summary-json')
    expect(
      renderIssueReportArtifactSummary(loadedDetails.index, {
        inputArtifactType: loadedDetails.inputArtifactType,
      }),
    ).toContain('Input surface: issue-report-summary-json')

    const summaryJsonOutput = buildIssueReportArtifactSummaryJsonOutput({
      index: loaded,
      options: {
        label: 'Manual',
        inputUrl: 'https://example.com/manual-index',
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
        topCount: 3,
        inputArtifactType: 'issue-report-summary-index',
      },
    })
    expect(summaryJsonOutput.inputArtifactType).toBe('issue-report-summary-index')
    expect(summaryJsonOutput.summaryEntries.indexSummaryRelativePath).toBe(
      'index-summary.md',
    )
    expect(summaryJsonOutput.summaryEntries.indexSummaryJsonRelativePath).toBe(
      'index-summary.json',
    )
    expect(summaryJsonOutput.summaryEntries.indexSurfaceRelativePath).toBe(
      'index-surface.json',
    )
    expect(summaryJsonOutput.artifactLinks.indexSummaryUrl).toBe(
      'https://example.com/manual-index-base/index-summary.md',
    )
    expect(summaryJsonOutput.artifactLinks.indexSummaryJsonUrl).toBe(
      'https://example.com/manual-index-base/index-summary.json',
    )
    expect(summaryJsonOutput.artifactLinks.indexSurfaceUrl).toBe(
      'https://example.com/manual-index-base/index-surface.json',
    )
    expect(summaryJsonOutput.summaryEntries.artifactIndexRelativePath).toBe(
      'issue-summary-index.json',
    )
    expect(summaryJsonOutput.artifactLinks.artifactIndexUrl).toBe(
      'https://example.com/manual-index-base/issue-summary-index.json',
    )
    expect(summaryJsonOutput.summaryEntries.manualManifestRelativePath).toBe(
      'artifacts-manifest.json',
    )
    expect(summaryJsonOutput.artifactLinks.manualManifestUrl).toBe(
      'https://example.com/manual-index-base/artifacts-manifest.json',
    )
    expect(summaryJsonOutput.summaryEntries.sourceSummaryRelativePath).toBe(
      'issue-summary.json',
    )
    expect(summaryJsonOutput.artifactLinks.sourceSummaryUrl).toBe(
      'https://example.com/manual-summary/issue-summary.json',
    )
    expect(summaryJsonOutput.artifactLinks.rawIssuesUrl).toBe(
      'https://example.com/manual-raw/raw-issues.json',
    )
    expect(summaryJsonOutput.summaryEntries.packetManifestRelativePath).toBe(
      'manifest.json',
    )
    expect(summaryJsonOutput.artifactLinks.packetSummaryUrl).toBe(
      'https://example.com/issue-packets/summary.md',
    )
    expect(summaryJsonOutput.artifactLinks.packetManifestUrl).toBe(
      'https://example.com/issue-packets/manifest.json',
    )
    expect(summaryJsonOutput.artifactLinks.preferredCsvUrl).toBe(
      'https://example.com/issue-csv/publish-gate-districts.csv',
    )
    expect(summaryJsonOutput.summaryEntries.preferredCsvRelativePath).toBe(
      'publish-gate-districts.csv',
    )
    expect(summaryJsonOutput.topSegments[0]?.packetPath).toBe(
      'top-segments/01-alpha-xinyi-seg-1.json',
    )
    expect(
      parseIssueReportArtifactSummaryJsonOutput(summaryJsonOutput).topReasons[0]?.packetPath,
    ).toBe('top-reasons/01-time-window.json')

    const manualSummaryJsonPath = path.join(cwd, 'index-summary.json')
    const manualSurfacePath = path.join(cwd, 'index-surface.json')
    await fs.writeFile(
      manualSummaryJsonPath,
      JSON.stringify(summaryJsonOutput, null, 2),
      'utf8',
    )
    await fs.writeFile(
      manualSurfacePath,
      JSON.stringify(
        buildIssueReportArtifactSummaryJsonSurfaceSummary({
          summaryPath: manualSummaryJsonPath,
          summary: summaryJsonOutput,
        }),
        null,
        2,
      ),
      'utf8',
    )

    const loadedFromManualIndex = await loadIssueReportArtifactSummaryInputDetails(
      summaryIndexPath,
    )
    expect(loadedFromManualIndex.inputArtifactType).toBe(
      'issue-report-summary-index',
    )
    expect(loadedFromManualIndex.index.artifactType).toBe(
      'issue-report-artifact-summary-surface',
    )

    const loadedFromCanonicalSummary = await loadIssueReportArtifactSummaryInputDetails(
      summaryPath,
    )
    expect(loadedFromCanonicalSummary.inputArtifactType).toBe(
      'issue-report-summary-json',
    )
    expect(loadedFromCanonicalSummary.index.artifactType).toBe(
      'issue-report-artifact-summary-surface',
    )

    const artifactBundle = await buildIssueReportSummaryArtifacts(
      {
        summaryPath,
        label: 'Manual',
        inputUrl: 'https://example.com/manual-index',
        publishGateSummaryUrl: 'https://example.com/publish-gate-summary',
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
    const overriddenManualManifest = {
      ...JSON.parse(await fs.readFile(artifactBundle.manifestPath, 'utf8')),
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
    const loadedFromManualManifest = await loadIssueReportArtifactSummaryInputDetails(
      artifactBundle.manifestPath,
    )
    expect(loadedFromManualManifest.inputArtifactType).toBe(
      'issue-report-summary-artifacts',
    )
    expect(loadedFromManualManifest.index.artifactType).toBe(
      'issue-report-artifact-summary-surface',
    )
    expect(
      renderIssueReportArtifactSummary(loadedFromManualManifest.index, {
        inputArtifactType: loadedFromManualManifest.inputArtifactType,
      }),
    ).toContain('Input surface: issue-report-summary-artifacts')
    expect(
      renderIssueReportArtifactSummary(loadedFromManualManifest.index, {
        inputArtifactType: loadedFromManualManifest.inputArtifactType,
      }),
    ).toContain(
      'Preferred CSV join file URL: [download artifact](https://example.com/manual-root-canonical/publish-gate-districts.csv)',
    )
    expect(
      renderIssueReportArtifactSummary(loadedFromManualManifest.index, {
        inputArtifactType: loadedFromManualManifest.inputArtifactType,
      }),
    ).toContain(
      'Packet summary URL: [download artifact](https://example.com/manual-root-canonical/issue-packets/manual-summary.md)',
    )
    expect(
      renderIssueReportArtifactSummary(loadedFromManualManifest.index, {
        inputArtifactType: loadedFromManualManifest.inputArtifactType,
      }),
    ).toContain(
      'Packet manifest URL: [download artifact](https://example.com/manual-root-canonical/issue-packets/manual-manifest.json)',
    )

    const loadedFromManualIndexAfterManifest = await loadIssueReportArtifactSummaryInputDetails(
      summaryIndexPath,
    )
    expect(
      renderIssueReportArtifactSummary(loadedFromManualIndexAfterManifest.index, {
        inputArtifactType: loadedFromManualIndexAfterManifest.inputArtifactType,
      }),
    ).toContain(
      'Preferred CSV join file URL: [download artifact](https://example.com/manual-root-canonical/publish-gate-districts.csv)',
    )
    expect(
      renderIssueReportArtifactSummary(loadedFromManualIndexAfterManifest.index, {
        inputArtifactType: loadedFromManualIndexAfterManifest.inputArtifactType,
      }),
    ).toContain(
      'Packet summary URL: [download artifact](https://example.com/manual-root-canonical/issue-packets/manual-summary.md)',
    )
    expect(
      renderIssueReportArtifactSummary(loadedFromManualIndexAfterManifest.index, {
        inputArtifactType: loadedFromManualIndexAfterManifest.inputArtifactType,
      }),
    ).toContain(
      'Packet manifest URL: [download artifact](https://example.com/manual-root-canonical/issue-packets/manual-manifest.json)',
    )
  })

  it('falls back to artifact-index resolution when a workflow manifest has no compact surface sidecar', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-manifest-'))
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
    const persistedArtifactIndex = {
      ...artifactIndex,
      generatedAt: '2026-04-11T00:00:00.000Z',
    }
    await fs.writeFile(
      workflow.artifactIndexPath,
      JSON.stringify(persistedArtifactIndex, null, 2),
      'utf8',
    )

    const loaded = await loadIssueReportArtifactSummaryInputDetails(workflow.manifestPath)
    expect(loaded.inputArtifactType).toBe('issue-report-workflow-artifacts')
    expect(loaded.index.artifactType).toBe('issue-report-artifact-index')
    if (loaded.index.artifactType !== 'issue-report-artifact-index') {
      throw new Error('expected artifact index')
    }
    expect(loaded.index.generatedAt).toBe('2026-04-11T00:00:00.000Z')
    expect(
      buildIssueReportArtifactSummaryJsonOutput({
        index: loaded.index,
        options: {
          inputArtifactType: loaded.inputArtifactType,
        },
      }).inputArtifactType,
    ).toBe('issue-report-workflow-artifacts')
    expect(
      resolveIssueReportArtifactSummaryOutPath(loaded.index, {
        outPath: null,
        json: true,
        writeIndexSummary: true,
      }),
    ).toBe(path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.json'))
    expect(
      renderIssueReportArtifactSummary(loaded.index, {
        inputArtifactType: loaded.inputArtifactType,
      }),
    ).toContain('Input surface: issue-report-workflow-artifacts')
  })

  it('rewrites canonical markdown from workflow manifest after the compact surface exists', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-manifest-surface-'))
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

    const index = await buildIssueReportArtifactIndex(workflow.manifestPath)
    const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
      index,
      options: {
        inputArtifactType: 'issue-report-workflow-artifacts',
      },
    })
    const indexSummaryJsonPath = path.join(
      cwd,
      '.tmp',
      'workflow-issue-artifacts',
      'index-summary.json',
    )
    await fs.writeFile(indexSummaryJsonPath, JSON.stringify(summaryJson, null, 2), 'utf8')

    const indexSurfacePath = path.join(
      cwd,
      '.tmp',
      'workflow-issue-artifacts',
      'index-surface.json',
    )
    const surfaceSummary = buildIssueReportArtifactSummaryJsonSurfaceSummary(
      await loadIssueReportArtifactSummaryJsonOutput(indexSummaryJsonPath),
    )
    await fs.writeFile(indexSurfacePath, JSON.stringify(surfaceSummary, null, 2), 'utf8')

    const loaded = await loadIssueReportArtifactSummaryInputDetails(workflow.manifestPath)
    expect(loaded.inputArtifactType).toBe('issue-report-workflow-artifacts')
    expect(loaded.index.artifactType).toBe('issue-report-artifact-summary-surface')
    expect(
      resolveIssueReportArtifactSummaryOutPath(loaded.index, {
        outPath: null,
        json: false,
        writeIndexSummary: true,
      }),
    ).toBe(path.join(cwd, '.tmp', 'workflow-issue-artifacts', 'index-summary.md'))
    expect(
      renderIssueReportArtifactSummary(loaded.index, {
        inputArtifactType: loaded.inputArtifactType,
      }),
    ).toContain('Input surface: issue-report-workflow-artifacts')
  })

  it('does not re-label manual base-url aliases as legacy artifact URLs in summary json output', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-artifact-summary-manual-base-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')
    const summaryIndexPath = path.join(cwd, 'issue-summary-index.json')

    const summaryJson = buildIssueReportSummaryJsonOutput({
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

    expect(summaryIndex.packetBaseUrl).toBe('https://legacy.example.com/issue-packets-base')
    expect(summaryIndex.csvBaseUrl).toBe('https://legacy.example.com/issue-csv-base')

    const summaryJsonOutput = buildIssueReportArtifactSummaryJsonOutput({
      index: summaryIndex,
      options: {
        inputArtifactType: 'issue-report-summary-index',
      },
    })

    expect(summaryJsonOutput.artifactLinks.packetRootUrl).toBe(
      'https://example.com/issue-packets',
    )
    expect(summaryJsonOutput.artifactLinks.packetBaseUrl).toBe(
      'https://legacy.example.com/issue-packets-base',
    )
    expect(summaryJsonOutput.artifactLinks.packetArtifactUrl).toBeNull()
    expect(summaryJsonOutput.artifactLinks.csvRootUrl).toBe(
      'https://example.com/issue-csv',
    )
    expect(summaryJsonOutput.artifactLinks.csvBaseUrl).toBe(
      'https://legacy.example.com/issue-csv-base',
    )
    expect(summaryJsonOutput.artifactLinks.csvArtifactUrl).toBeNull()
    expect(
      renderIssueReportArtifactSummary(summaryJsonOutput, {
        inputArtifactType: 'issue-report-artifact-summary-json',
      }),
    ).toContain(
      'Legacy packet base URL: [download artifact](https://legacy.example.com/issue-packets-base)',
    )
    expect(
      renderIssueReportArtifactSummary(summaryJsonOutput, {
        inputArtifactType: 'issue-report-artifact-summary-json',
      }),
    ).toContain(
      'Legacy CSV base URL: [download artifact](https://legacy.example.com/issue-csv-base)',
    )
    expect(
      renderIssueReportArtifactSummary(summaryJsonOutput, {
        inputArtifactType: 'issue-report-artifact-summary-json',
      }),
    ).not.toContain('Legacy packet artifact URL:')
    expect(
      renderIssueReportArtifactSummary(summaryJsonOutput, {
        inputArtifactType: 'issue-report-artifact-summary-json',
      }),
    ).not.toContain('Legacy CSV artifact URL:')
  })
})
