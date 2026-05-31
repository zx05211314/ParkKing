import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildIssueReportSummaryJsonOutput, loadIssueReportSummary } from './issueReportSummary'
import { buildIssueReportSummaryArtifacts } from './issueReportSummaryArtifacts'
import {
  buildIssueReportSummaryIndex,
  loadIssueReportSummaryIndex,
  loadIssueReportSummaryIndexFromSummary,
  parseIssueReportSummaryIndex,
  renderIssueReportSummaryIndex,
  renderIssueReportSummaryIndexWriteResult,
  resolveIssueReportSummaryIndexOutPath,
} from './issueReportSummaryIndex'

describe('issueReportSummaryIndex', () => {
  it('builds a normalized consumer index from issue-report-summary-json', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-summary-index-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')
    const summaryIndexPath = path.join(cwd, 'issue-summary-index.json')
    const result = await loadIssueReportSummary({
      syncStorePath: path.join(cwd, 'missing.json'),
      scope: null,
      districtId: null,
      segmentId: null,
      reasonCode: null,
      since: null,
      limit: 10,
    })

    const summaryJson = buildIssueReportSummaryJsonOutput({
      result,
      publishGateSummary: {
        generatedAt: '2026-04-10T12:00:00.000Z',
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
        summaryUrl: 'https://example.com/issue-summary/issue-summary.json',
        rawIssuesPath: path.join(cwd, 'raw-issues.json'),
        rawIssuesRelativePath: 'raw-issues.json',
        rawIssuesUrl: 'https://example.com/raw-issues/raw-issues.json',
        csvRootPath: path.join(cwd, 'issue-csv'),
        csvRootUrl: 'https://example.com/issue-csv',
        csvBaseUrl: 'https://example.com/issue-csv',
        preferredCsvPath: path.join(cwd, 'issue-csv', 'top-segments.csv'),
        preferredCsvRelativePath: 'top-segments.csv',
        preferredCsvUrl: 'https://example.com/issue-csv/top-segments.csv',
        csvPaths: [path.join(cwd, 'issue-csv', 'top-segments.csv')],
        csvRelativePaths: ['top-segments.csv'],
        packetRootPath: path.join(cwd, 'issue-packets'),
        packetRootUrl: 'https://example.com/issue-packets',
        packetBaseUrl: 'https://example.com/issue-packets',
        packetSummaryPath: path.join(cwd, 'issue-packets', 'summary.md'),
        packetSummaryRelativePath: 'summary.md',
        packetSummaryUrl: 'https://example.com/issue-packets/summary.md',
        packetManifestPath: path.join(cwd, 'issue-packets', 'manifest.json'),
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: 'https://example.com/issue-packets/manifest.json',
        packetPaths: [path.join(cwd, 'issue-packets', 'manifest.json')],
        packetRelativePaths: ['manifest.json'],
      },
    })

    const packetManifest = {
      artifactType: 'issue-report-triage-packets' as const,
      schemaVersion: 1 as const,
      generatedAt: '2026-04-10T12:00:00.000Z',
      storageFile: path.join(cwd, 'sync-service.json'),
      filters: {
        scope: null,
        districtId: null,
        segmentId: null,
        reasonCode: null,
        since: null,
      },
      totalCount: 0,
      filteredCount: 0,
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
      reasonPackets: [],
      csvExports: [
        {
          fileName: 'top-segments.csv',
          path: path.join(cwd, 'issue-csv', 'top-segments.csv'),
          url: 'https://example.com/issue-csv/top-segments.csv',
        },
      ],
    }

    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')

    const index = buildIssueReportSummaryIndex({
      summaryPath,
      summary: summaryJson,
      packetManifest,
      indexPath: summaryIndexPath,
      indexBaseUrl: 'https://example.com/issue-index',
    })

    expect(index).toMatchObject({
      artifactType: 'issue-report-summary-index',
      schemaVersion: 1,
      sourceSummaryPath: summaryPath,
      sourceSummaryArtifactType: 'issue-report-summary-json',
      sourceSummarySchemaVersion: 1,
      indexFile: {
        relativePath: 'issue-summary-index.json',
        url: 'https://example.com/issue-index/issue-summary-index.json',
      },
      manualManifestFile: {
        relativePath: 'artifacts-manifest.json',
        url: 'https://example.com/issue-index/artifacts-manifest.json',
      },
      summaryFile: {
        relativePath: 'issue-summary.json',
        url: 'https://example.com/issue-summary/issue-summary.json',
      },
      rawIssuesFile: {
        relativePath: 'raw-issues.json',
        url: 'https://example.com/raw-issues/raw-issues.json',
      },
      preferredCsvFile: {
        relativePath: 'top-segments.csv',
        url: 'https://example.com/issue-csv/top-segments.csv',
      },
      csvExports: [
        {
          relativePath: 'top-segments.csv',
          url: 'https://example.com/issue-csv/top-segments.csv',
        },
      ],
      packetSummaryFile: {
        relativePath: 'summary.md',
        url: 'https://example.com/issue-packets/summary.md',
      },
      packetManifestFile: {
        relativePath: 'manifest.json',
        url: 'https://example.com/issue-packets/manifest.json',
      },
      packetFiles: [
        {
          relativePath: 'manifest.json',
          url: 'https://example.com/issue-packets/manifest.json',
        },
      ],
      packetManifestArtifactType: 'issue-report-triage-packets',
      packetManifestSchemaVersion: 1,
      segmentPacketEntries: [
        {
          relativePath: 'top-segments/01-alpha-xinyi-seg-1.json',
        },
      ],
    })
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Input surface: issue-report-summary-json',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Source summary schema: issue-report-summary-json v1',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Canonical full-index handoff: issue-summary-index.json',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Canonical full-index URL: https://example.com/issue-index/issue-summary-index.json',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Manual manifest URL: https://example.com/issue-index/artifacts-manifest.json',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Preferred portable input: artifacts-manifest.json',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Fallback compatibility input: issue-summary-index.json',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Summary URL: https://example.com/issue-summary/issue-summary.json',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      `CSV exchange root: ${path.join(cwd, 'issue-csv')}`,
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      `Packet root: ${path.join(cwd, 'issue-packets')}`,
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Preferred CSV join file: top-segments.csv',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Preferred CSV join file URL: https://example.com/issue-csv/top-segments.csv',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Packet summary URL: https://example.com/issue-packets/summary.md',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Packet preferred portable input: manifest.json',
    )
    expect(renderIssueReportSummaryIndex(index)).toContain(
      'Packet preferred portable input URL: https://example.com/issue-packets/manifest.json',
    )
    const legacyBaseIndexSummary = renderIssueReportSummaryIndex({
      ...index,
      csvRootUrl: 'https://example.com/canonical-issue-csv',
      csvBaseUrl: 'https://legacy.example.com/issue-csv',
      packetRootUrl: 'https://example.com/canonical-issue-packets',
      packetBaseUrl: 'https://legacy.example.com/issue-packets',
    })
    expect(legacyBaseIndexSummary).toContain(
      'CSV exchange root URL: https://example.com/canonical-issue-csv',
    )
    expect(legacyBaseIndexSummary).toContain(
      'Legacy CSV base URL: https://legacy.example.com/issue-csv',
    )
    expect(legacyBaseIndexSummary).toContain(
      'Packet root URL: https://example.com/canonical-issue-packets',
    )
    expect(legacyBaseIndexSummary).toContain(
      'Legacy packet base URL: https://legacy.example.com/issue-packets',
    )
    const aliasOnlyIndexSummary = renderIssueReportSummaryIndex({
      ...index,
      csvRootUrl: null,
      csvBaseUrl: 'https://legacy.example.com/issue-csv',
      preferredCsvFile: {
        ...index.preferredCsvFile!,
        url: null,
      },
      csvExports: index.csvExports.map((entry) => ({ ...entry, url: null })),
      packetRootUrl: null,
      packetBaseUrl: 'https://legacy.example.com/issue-packets',
      packetSummaryFile: {
        ...index.packetSummaryFile!,
        url: null,
      },
      packetManifestFile: {
        ...index.packetManifestFile!,
        url: null,
      },
      packetFiles: index.packetFiles.map((entry) => ({ ...entry, url: null })),
    })
    expect(aliasOnlyIndexSummary).toContain(
      'CSV exchange root URL: https://legacy.example.com/issue-csv',
    )
    expect(aliasOnlyIndexSummary).not.toContain('Legacy CSV base URL:')
    expect(aliasOnlyIndexSummary).toContain(
      'Preferred CSV join file URL: https://legacy.example.com/issue-csv/top-segments.csv',
    )
    expect(aliasOnlyIndexSummary).toContain(
      'Packet root URL: https://legacy.example.com/issue-packets',
    )
    expect(aliasOnlyIndexSummary).not.toContain('Legacy packet base URL:')
    expect(aliasOnlyIndexSummary).toContain(
      'Packet summary URL: https://legacy.example.com/issue-packets/summary.md',
    )
    expect(aliasOnlyIndexSummary).toContain(
      'Packet preferred portable input URL: https://legacy.example.com/issue-packets/manifest.json',
    )
    expect(
      renderIssueReportSummaryIndexWriteResult(
        'C:/tmp/issue-summary-index.json',
        index,
      ),
    ).toContain('Wrote issue report summary index to C:/tmp/issue-summary-index.json')
    expect(
      renderIssueReportSummaryIndexWriteResult(
        'C:/tmp/issue-summary-index.json',
        index,
      ),
    ).toContain('Preferred portable input: artifacts-manifest.json')
    expect(renderIssueReportSummaryIndex(index)).toContain(
      '| xinyi | 1 | 0 | 3 | 1 | 2 | C2 curb (seg-1) | https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json |',
    )
    expect(
      resolveIssueReportSummaryIndexOutPath({
        summaryPath,
        outPath: null,
        json: true,
        writeIndex: true,
      }),
    ).toBe(summaryIndexPath)

    await fs.mkdir(path.dirname(summaryJson.artifacts.packetManifestPath!), { recursive: true })
    await fs.writeFile(
      summaryJson.artifacts.packetManifestPath!,
      JSON.stringify(packetManifest, null, 2),
      'utf8',
    )
    const artifactBundle = await buildIssueReportSummaryArtifacts(
      {
        inputPath: summaryPath,
        label: 'Manual',
        inputUrl: 'https://example.com/issue-index',
        publishGateSummaryUrl: null,
        topCount: 3,
        indexBaseUrl: 'https://example.com/issue-index',
      },
      cwd,
    )
    const overriddenPacketRootPath = path.join(cwd, 'root-canonical-issue-packets')
    const overriddenPacketSummaryPath = path.join(overriddenPacketRootPath, 'manual-summary.md')
    const overriddenPacketManifestPath = path.join(
      overriddenPacketRootPath,
      'manual-manifest.json',
    )
    const overriddenCsvRootPath = path.join(cwd, 'root-canonical-issue-csv')
    const overriddenManualManifest = {
      ...JSON.parse(await fs.readFile(artifactBundle.manifestPath, 'utf8')),
      csvRootPath: overriddenCsvRootPath,
      csvRootUrl: 'https://example.com/root-canonical-issue-csv',
      csvArtifactUrl: 'https://example.com/root-canonical-issue-csv',
      preferredCsvPath: path.join(overriddenCsvRootPath, 'top-segments.csv'),
      preferredCsvRelativePath: 'top-segments.csv',
      preferredCsvUrl: 'https://example.com/root-canonical/top-segments.csv',
      packetRootUrl: 'https://example.com/root-canonical-issue-packets',
      packetArtifactUrl: 'https://example.com/root-canonical-issue-packets',
      packetRootPath: overriddenPacketRootPath,
      packetSummaryPath: overriddenPacketSummaryPath,
      packetSummaryRelativePath: 'manual-summary.md',
      packetSummaryUrl: 'https://example.com/root-canonical-issue-packets/manual-summary.md',
      packetManifestPath: overriddenPacketManifestPath,
      packetManifestRelativePath: 'manual-manifest.json',
      packetManifestUrl: 'https://example.com/root-canonical-issue-packets/manual-manifest.json',
      packetPaths: [overriddenPacketManifestPath],
    }
    await fs.writeFile(
      artifactBundle.manifestPath,
      JSON.stringify(overriddenManualManifest, null, 2),
      'utf8',
    )

    const loadedWithManualManifest = await loadIssueReportSummaryIndex(artifactBundle.indexPath)
    expect(loadedWithManualManifest.csvRootPath).toBe(overriddenCsvRootPath)
    expect(loadedWithManualManifest.csvBaseUrl).toBeNull()
    expect(loadedWithManualManifest.preferredCsvFile?.url).toBe(
      'https://example.com/root-canonical/top-segments.csv',
    )
    expect(loadedWithManualManifest.packetSummaryFile?.relativePath).toBe('manual-summary.md')
    expect(loadedWithManualManifest.packetSummaryFile?.url).toBe(
      'https://example.com/root-canonical-issue-packets/manual-summary.md',
    )
    expect(loadedWithManualManifest.packetBaseUrl).toBeNull()
    expect(loadedWithManualManifest.packetManifestFile?.relativePath).toBe(
      'manual-manifest.json',
    )
    expect(loadedWithManualManifest.packetManifestFile?.url).toBe(
      'https://example.com/root-canonical-issue-packets/manual-manifest.json',
    )
    expect(renderIssueReportSummaryIndex(loadedWithManualManifest)).toContain(
      'Preferred CSV join file URL: https://example.com/root-canonical/top-segments.csv',
    )
    expect(renderIssueReportSummaryIndex(loadedWithManualManifest)).toContain(
      `CSV exchange root: ${overriddenCsvRootPath}`,
    )
    expect(renderIssueReportSummaryIndex(loadedWithManualManifest)).toContain(
      'CSV exchange root URL: https://example.com/root-canonical-issue-csv',
    )
    expect(renderIssueReportSummaryIndex(loadedWithManualManifest)).toContain(
      'Packet summary URL: https://example.com/root-canonical-issue-packets/manual-summary.md',
    )
    expect(renderIssueReportSummaryIndex(loadedWithManualManifest)).toContain(
      `Packet root: ${overriddenPacketRootPath}`,
    )
    expect(renderIssueReportSummaryIndex(loadedWithManualManifest)).toContain(
      'Packet root URL: https://example.com/root-canonical-issue-packets',
    )
    expect(renderIssueReportSummaryIndex(loadedWithManualManifest)).toContain(
      'Packet preferred portable input URL: https://example.com/root-canonical-issue-packets/manual-manifest.json',
    )

    const loadedFromRawSummaryWithManualManifest = await loadIssueReportSummaryIndexFromSummary(
      summaryPath,
      {
        indexPath: artifactBundle.indexPath,
        indexBaseUrl: 'https://example.com/manual-index',
      },
    )
    expect(loadedFromRawSummaryWithManualManifest.csvRootPath).toBe(overriddenCsvRootPath)
    expect(loadedFromRawSummaryWithManualManifest.csvBaseUrl).toBeNull()
    expect(loadedFromRawSummaryWithManualManifest.packetSummaryFile?.relativePath).toBe(
      'manual-summary.md',
    )
    expect(loadedFromRawSummaryWithManualManifest.packetSummaryFile?.url).toBe(
      'https://example.com/root-canonical-issue-packets/manual-summary.md',
    )
    expect(loadedFromRawSummaryWithManualManifest.packetManifestFile?.relativePath).toBe(
      'manual-manifest.json',
    )
    expect(loadedFromRawSummaryWithManualManifest.packetManifestFile?.url).toBe(
      'https://example.com/root-canonical-issue-packets/manual-manifest.json',
    )
  })

  it('loads and validates a saved summary index', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-summary-index-load-'))
    const indexPath = path.join(cwd, 'issue-summary-index.json')

    await fs.writeFile(
      indexPath,
      JSON.stringify(
        {
          artifactType: 'issue-report-summary-index',
          schemaVersion: 1,
          generatedAt: '2026-04-10T12:00:00.000Z',
          sourceSummaryPath: path.join(cwd, 'issue-summary.json'),
          sourceSummaryArtifactType: 'issue-report-summary-json',
          sourceSummarySchemaVersion: 1,
          storageFile: path.join(cwd, 'sync-service.json'),
          totalCount: 0,
          filteredCount: 0,
          filters: {
            scope: null,
            districtId: null,
            segmentId: null,
            reasonCode: null,
            since: null,
          },
          publishGateSummary: null,
          publishGateHotspots: [],
          topDistricts: [],
          topSegments: [],
          topReasons: [],
          indexFile: null,
          summaryFile: null,
          rawIssuesFile: null,
          csvRootPath: null,
          csvRootUrl: null,
          csvBaseUrl: null,
          csvExports: [],
          packetRootPath: null,
          packetRootUrl: null,
          packetBaseUrl: null,
          packetSummaryFile: null,
          packetManifestFile: null,
          packetFiles: [],
        },
        null,
        2,
      ),
      'utf8',
    )

    const loaded = await loadIssueReportSummaryIndex(indexPath)
    expect(loaded.artifactType).toBe('issue-report-summary-index')
    expect(loaded.schemaVersion).toBe(1)
    expect(() =>
      parseIssueReportSummaryIndex({
        artifactType: 'issue-report-summary-index',
        schemaVersion: 2,
      }),
    ).toThrow('issue report summary index schemaVersion must be 1')

    const normalized = parseIssueReportSummaryIndex({
      artifactType: 'issue-report-summary-index',
      schemaVersion: 1,
      generatedAt: '2026-04-10T12:00:00.000Z',
      sourceSummaryPath: path.join(cwd, 'issue-summary.json'),
      sourceSummaryArtifactType: 'issue-report-summary-json',
      sourceSummarySchemaVersion: 1,
      storageFile: path.join(cwd, 'sync-service.json'),
      totalCount: 0,
      filteredCount: 0,
      filters: {
        scope: null,
        districtId: null,
        segmentId: null,
        reasonCode: null,
        since: null,
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      topDistricts: [],
      topSegments: [],
      topReasons: [],
      indexFile: null,
      summaryFile: null,
      rawIssuesFile: null,
      csvRootPath: 'C:/tmp/issue-csv',
      csvRootUrl: null,
      csvBaseUrl: 'https://legacy.example.com/issue-csv',
      preferredCsvFile: null,
      csvExports: [],
      packetRootPath: 'C:/tmp/issue-packets',
      packetRootUrl: null,
      packetBaseUrl: 'https://legacy.example.com/issue-packets',
      packetSummaryFile: null,
      packetManifestFile: null,
      packetFiles: [],
      packetManifestArtifactType: null,
      packetManifestSchemaVersion: null,
      segmentPacketEntries: [],
      reasonPacketEntries: [],
      manualManifestFile: null,
    })
    expect(normalized.csvRootUrl).toBe('https://legacy.example.com/issue-csv')
    expect(normalized.csvBaseUrl).toBeNull()
    expect(normalized.packetRootUrl).toBe('https://legacy.example.com/issue-packets')
    expect(normalized.packetBaseUrl).toBeNull()
  })

  it('treats base-url fields as legacy compat aliases in parser validation', () => {
    expect(() =>
      parseIssueReportSummaryIndex({
        artifactType: 'issue-report-summary-index',
        schemaVersion: 1,
        generatedAt: '2026-04-10T12:00:00.000Z',
        sourceSummaryPath: 'C:/tmp/issue-summary.json',
        sourceSummaryArtifactType: 'issue-report-summary-json',
        sourceSummarySchemaVersion: 1,
        storageFile: 'C:/tmp/sync-service.json',
        totalCount: 0,
        filteredCount: 0,
        filters: {
          scope: null,
          districtId: null,
          segmentId: null,
          reasonCode: null,
          since: null,
        },
        publishGateSummary: null,
        publishGateHotspots: [],
        topDistricts: [],
        topSegments: [],
        topReasons: [],
        indexFile: null,
        summaryFile: null,
        rawIssuesFile: null,
        csvRootPath: null,
        csvRootUrl: null,
        csvBaseUrl: 'https://legacy.example.com/issue-csv',
        preferredCsvFile: null,
        csvExports: [],
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: null,
        packetBaseUrl: null,
        packetSummaryFile: null,
        packetManifestFile: null,
        packetFiles: [],
        packetManifestArtifactType: null,
        packetManifestSchemaVersion: null,
        segmentPacketEntries: [],
        reasonPacketEntries: [],
        manualManifestFile: null,
      }),
    ).toThrow(
      'issue report summary index csvBaseUrl is a legacy compat alias for csvRootUrl and requires csvRootPath',
    )

    expect(() =>
      parseIssueReportSummaryIndex({
        artifactType: 'issue-report-summary-index',
        schemaVersion: 1,
        generatedAt: '2026-04-10T12:00:00.000Z',
        sourceSummaryPath: 'C:/tmp/issue-summary.json',
        sourceSummaryArtifactType: 'issue-report-summary-json',
        sourceSummarySchemaVersion: 1,
        storageFile: 'C:/tmp/sync-service.json',
        totalCount: 0,
        filteredCount: 0,
        filters: {
          scope: null,
          districtId: null,
          segmentId: null,
          reasonCode: null,
          since: null,
        },
        publishGateSummary: null,
        publishGateHotspots: [],
        topDistricts: [],
        topSegments: [],
        topReasons: [],
        indexFile: null,
        summaryFile: null,
        rawIssuesFile: null,
        csvRootPath: 'C:/tmp/issue-csv',
        csvRootUrl: null,
        csvBaseUrl: null,
        preferredCsvFile: null,
        csvExports: [],
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: null,
        packetBaseUrl: 42,
        packetSummaryFile: null,
        packetManifestFile: null,
        packetFiles: [],
        packetManifestArtifactType: null,
        packetManifestSchemaVersion: null,
        segmentPacketEntries: [],
        reasonPacketEntries: [],
        manualManifestFile: null,
      }),
    ).toThrow(
      'issue report summary index packetBaseUrl is a legacy compat alias for packetRootUrl and must be a string or null',
    )
  })

  it('can build a normalized index directly from a saved summary export with packet manifest follow', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-summary-index-follow-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')
    const packetRootPath = path.join(cwd, 'issue-packets')
    const packetManifestPath = path.join(packetRootPath, 'manifest.json')

    await fs.mkdir(packetRootPath, { recursive: true })
    await fs.writeFile(
      packetManifestPath,
      JSON.stringify(
        {
          artifactType: 'issue-report-triage-packets',
          schemaVersion: 1,
          generatedAt: '2026-04-10T12:00:00.000Z',
          storageFile: path.join(cwd, 'sync-service.json'),
          filters: {
            scope: null,
            districtId: null,
            segmentId: null,
            reasonCode: null,
            since: null,
          },
          totalCount: 0,
          filteredCount: 0,
          packetRootPath,
          packetRootUrl: 'https://example.com/issue-packets',
          packetBaseUrl: 'https://example.com/issue-packets',
          csvRootPath: null,
          csvRootUrl: null,
          csvBaseUrl: null,
          summaryPath: path.join(packetRootPath, 'summary.md'),
          summaryRelativePath: 'summary.md',
          summaryUrl: 'https://example.com/issue-packets/summary.md',
          publishGateSummary: null,
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
              packetKind: 'segment',
              label: 'C2 curb (seg-1)',
              relativePath: 'top-segments/01-alpha-xinyi-seg-1.json',
              url: 'https://example.com/issue-packets/top-segments/01-alpha-xinyi-seg-1.json',
            },
          ],
          reasonPackets: [],
          csvExports: [],
        },
        null,
        2,
      ),
      'utf8',
    )

    await fs.writeFile(
      summaryPath,
      JSON.stringify(
        {
          artifactType: 'issue-report-summary-json',
          schemaVersion: 1,
          storageFile: path.join(cwd, 'sync-service.json'),
          storeExists: true,
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
          publishGateSummary: null,
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
            summaryUrl: 'https://example.com/issue-summary/issue-summary.json',
            rawIssuesPath: null,
            rawIssuesRelativePath: null,
            rawIssuesUrl: null,
            csvRootPath: null,
            csvRootUrl: null,
            csvBaseUrl: null,
            csvPaths: [],
            csvRelativePaths: [],
            packetRootPath,
            packetRootUrl: 'https://example.com/issue-packets',
            packetBaseUrl: 'https://example.com/issue-packets',
            packetSummaryPath: path.join(packetRootPath, 'summary.md'),
            packetSummaryRelativePath: 'summary.md',
            packetManifestPath,
            packetManifestRelativePath: 'manifest.json',
            packetPaths: [packetManifestPath],
            packetRelativePaths: ['manifest.json'],
          },
        },
        null,
        2,
      ),
      'utf8',
    )

    const index = await loadIssueReportSummaryIndexFromSummary(
      summaryPath,
      {
        indexPath: path.join(cwd, 'issue-summary-index.json'),
        indexBaseUrl: 'https://example.com/manual-index',
      },
    )
    expect(index.publishGateHotspots[0]?.issueHotspotPacketPath).toBe(
      'top-segments/01-alpha-xinyi-seg-1.json',
    )
    expect(index.indexFile).toEqual({
      path: path.join(cwd, 'issue-summary-index.json'),
      relativePath: 'issue-summary-index.json',
      url: 'https://example.com/manual-index/issue-summary-index.json',
    })
    expect(index.segmentPacketEntries).toHaveLength(1)
  })

  it('falls back cleanly when a saved summary references a missing packet manifest', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-summary-index-missing-packet-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')

    await fs.writeFile(
      summaryPath,
      JSON.stringify(
        {
          artifactType: 'issue-report-summary-json',
          schemaVersion: 1,
          storageFile: path.join(cwd, 'sync-service.json'),
          storeExists: true,
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
            csvRootUrl: null,
            csvBaseUrl: null,
            csvPaths: [],
            csvRelativePaths: [],
            packetRootPath: path.join(cwd, 'issue-packets'),
            packetRootUrl: 'https://example.com/issue-packets',
            packetBaseUrl: 'https://example.com/issue-packets',
            packetSummaryPath: path.join(cwd, 'issue-packets', 'summary.md'),
            packetSummaryRelativePath: 'summary.md',
            packetManifestPath: path.join(cwd, 'issue-packets', 'manifest.json'),
            packetManifestRelativePath: 'manifest.json',
            packetPaths: [path.join(cwd, 'issue-packets', 'manifest.json')],
            packetRelativePaths: ['manifest.json'],
          },
        },
        null,
        2,
      ),
      'utf8',
    )

    const index = await loadIssueReportSummaryIndexFromSummary(summaryPath)
    expect(index.packetManifestArtifactType).toBeNull()
    expect(index.packetManifestSchemaVersion).toBeNull()
    expect(index.segmentPacketEntries).toHaveLength(0)
    expect(index.reasonPacketEntries).toHaveLength(0)
  })
})
