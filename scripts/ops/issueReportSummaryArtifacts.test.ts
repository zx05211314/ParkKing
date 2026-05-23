import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  assertIssueReportArtifactManifestKind,
  loadIssueReportArtifactManifest,
} from './issueReportArtifactManifest'
import { buildIssueReportSummaryJsonOutput as buildIssueReportSummaryExportJsonOutput } from './issueReportSummary'
import {
  buildIssueReportSummaryArtifacts,
  renderIssueReportSummaryArtifactsResult,
} from './issueReportSummaryArtifacts'
import { loadIssueReportArtifactSummarySurfaceInput } from './issueReportArtifactSummaryJson'
import { parseIssueReportSummaryIndex } from './issueReportSummaryIndex'

describe('issueReportSummaryArtifacts', () => {
  it('writes the canonical manual artifact sidecar family next to a saved summary', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-summary-artifacts-'))
    const summaryPath = path.join(cwd, 'issue-summary.json')
    const csvRootPath = path.join(cwd, 'issue-csv')
    const preferredCsvPath = path.join(csvRootPath, 'publish-gate-districts.csv')
    const packetRootPath = path.join(cwd, 'issue-packets')
    const packetSummaryPath = path.join(packetRootPath, 'summary.md')
    const packetManifestPath = path.join(packetRootPath, 'manifest.json')

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
      publishGateHotspots: [
        {
          districtId: 'xinyi',
          warn: 1,
          fail: 0,
          topWarnCodes: ['TIME_WINDOW'],
          topFailCodes: [],
          directOverrideMatches: 1,
          spatialOverrideMatches: 0,
          unmatchedNamedOverrides: 0,
          issueHotspotSegmentId: 'seg-1',
          issueHotspotSegmentName: 'C2 curb',
          issueHotspotSegmentLabel: 'C2 curb (seg-1)',
          issueHotspotPacketPath: 'segment-packets/seg-1.json',
          issueHotspotPacketUrl: 'https://example.com/manual-packets/segment-packets/seg-1.json',
        },
      ],
      artifacts: {
        summaryPath,
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: 'https://example.com/manual-summary/issue-summary.json',
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath,
        csvRootUrl: 'https://example.com/manual-csv',
        csvBaseUrl: 'https://example.com/manual-csv',
        csvPaths: [preferredCsvPath],
        csvRelativePaths: ['publish-gate-districts.csv'],
        packetRootPath,
        packetRootUrl: 'https://example.com/manual-packets',
        packetBaseUrl: 'https://example.com/manual-packets',
        packetSummaryPath,
        packetSummaryRelativePath: 'summary.md',
        packetSummaryUrl: 'https://example.com/manual-packets/summary.md',
        packetManifestPath,
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: 'https://example.com/manual-packets/manifest.json',
        packetPaths: [packetManifestPath],
        packetRelativePaths: ['manifest.json'],
      },
    })

    await fs.mkdir(csvRootPath, { recursive: true })
    await fs.writeFile(preferredCsvPath, 'districtId,count\nxinyi,1\n', 'utf8')
    await fs.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8')

    const result = await buildIssueReportSummaryArtifacts(
      {
        inputPath: summaryPath,
        label: 'Manual',
        inputUrl: 'https://example.com/manual-input',
        publishGateSummaryUrl: null,
        topCount: 3,
        indexBaseUrl: 'https://example.com/manual-index-base',
      },
      cwd,
    )
    expect(result.inputPath).toBe(summaryPath)
    expect(result.inputArtifactType).toBe('issue-report-summary-json')
    expect(result.preferredPortableInputPath).toBe(result.manifestPath)
    expect(result.preferredPortableInputUrl).toBe(
      'https://example.com/manual-index-base/artifacts-manifest.json',
    )
    expect(result.manifestUrl).toBe('https://example.com/manual-index-base/artifacts-manifest.json')
    expect(result.indexSummaryUrl).toBe('https://example.com/manual-index-base/index-summary.md')
    expect(result.indexSummaryJsonUrl).toBe('https://example.com/manual-index-base/index-summary.json')
    expect(result.indexSurfaceUrl).toBe('https://example.com/manual-index-base/index-surface.json')
    expect(result.csvRootPath).toBe(csvRootPath)
    expect(result.csvRootUrl).toBe('https://example.com/manual-csv')
    expect(result.csvBaseUrl).toBeNull()
    expect(result.preferredCsvPath).toBe(preferredCsvPath)
    expect(result.preferredCsvRelativePath).toBe('publish-gate-districts.csv')
    expect(result.preferredCsvUrl).toBe(
      'https://example.com/manual-csv/publish-gate-districts.csv',
    )
    expect(result.packetRootPath).toBe(packetRootPath)
    expect(result.packetRootUrl).toBe('https://example.com/manual-packets')
    expect(result.packetBaseUrl).toBeNull()
    expect(result.packetArtifactUrl).toBeNull()
    expect(result.packetSummaryPath).toBe(packetSummaryPath)
    expect(result.packetSummaryRelativePath).toBe('summary.md')
    expect(result.packetSummaryUrl).toBe('https://example.com/manual-packets/summary.md')
    expect(result.packetManifestPath).toBe(packetManifestPath)
    expect(result.packetManifestRelativePath).toBe('manifest.json')
    expect(result.packetManifestUrl).toBe('https://example.com/manual-packets/manifest.json')

    const savedIndex = parseIssueReportSummaryIndex(
      JSON.parse(await fs.readFile(result.indexPath, 'utf8')),
    )
    expect(savedIndex.indexFile?.relativePath).toBe('issue-summary-index.json')
    expect(savedIndex.indexFile?.url).toBe(
      'https://example.com/manual-index-base/issue-summary-index.json',
    )
    await expect(fs.readFile(result.manifestPath, 'utf8')).resolves.toContain(
      '"artifactType": "issue-report-summary-artifacts"',
    )

    await expect(fs.readFile(result.indexSummaryPath, 'utf8')).resolves.toContain(
      '# Manual Issue Artifact Summary',
    )
    await expect(fs.readFile(result.indexSummaryJsonPath, 'utf8')).resolves.toContain(
      '"artifactType": "issue-report-artifact-summary-json"',
    )
    await expect(fs.readFile(result.indexSurfacePath, 'utf8')).resolves.toContain(
      '"artifactType": "issue-report-artifact-summary-surface"',
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      'Input surface: issue-report-summary-json',
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      `Preferred portable input: ${result.manifestPath}`,
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      `Fallback compatibility input: ${result.indexPath}`,
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      `CSV exchange root: ${csvRootPath}`,
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      'Preferred CSV join file entry: publish-gate-districts.csv',
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      `Packet root: ${packetRootPath}`,
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      `Packet summary: ${packetSummaryPath}`,
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      'Packet summary entry: summary.md',
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      `Packet preferred portable input: ${packetManifestPath}`,
    )
    expect(renderIssueReportSummaryArtifactsResult(result)).toContain(
      'Packet preferred portable input entry: manifest.json',
    )

    const loaded = await loadIssueReportArtifactSummarySurfaceInput(result.indexPath)
    expect(loaded.inputArtifactType).toBe('issue-report-summary-index')
    expect(loaded.summary?.summaryPath).toBe(result.indexSummaryJsonPath)
    expect(loaded.surface).toBeNull()

    const loadedManifest = await loadIssueReportArtifactManifest(result.manifestPath)
    const manifest = assertIssueReportArtifactManifestKind(loadedManifest.manifest, 'manual')
    expect(manifest.indexSummaryJsonPath).toBe(result.indexSummaryJsonPath)
    expect(manifest.indexSurfacePath).toBe(result.indexSurfacePath)
    expect(manifest.artifactIndexPath).toBe(result.indexPath)
    expect(manifest.packetArtifactUrl).toBeNull()
    expect(manifest.csvArtifactUrl).toBeNull()
    expect(manifest.publishGateHotspots).toMatchObject([
      {
        districtId: 'xinyi',
        packetRootUrl: 'https://example.com/manual-packets',
        packetArtifactUrl: null,
        csvRootUrl: 'https://example.com/manual-csv',
        csvArtifactUrl: null,
      },
    ])
    expect(manifest.preferredCsvRelativePath).toBe('publish-gate-districts.csv')
    expect(manifest.preferredCsvUrl).toBe(
      'https://example.com/manual-csv/publish-gate-districts.csv',
    )
    expect(manifest.packetSummaryRelativePath).toBe('summary.md')
    expect(manifest.packetSummaryUrl).toBe('https://example.com/manual-packets/summary.md')
    expect(manifest.packetManifestRelativePath).toBe('manifest.json')
    expect(manifest.packetManifestUrl).toBe('https://example.com/manual-packets/manifest.json')

    const loadedFromManifest = await loadIssueReportArtifactSummarySurfaceInput(
      result.manifestPath,
    )
    expect(loadedFromManifest.inputArtifactType).toBe('issue-report-summary-artifacts')
    expect(loadedFromManifest.summary?.summaryPath).toBe(result.indexSummaryJsonPath)

    await fs.unlink(summaryPath)

    const refreshedFromIndex = await buildIssueReportSummaryArtifacts(
      {
        inputPath: result.indexPath,
        label: 'Manual Refresh',
        inputUrl: 'https://example.com/manual-refresh',
        publishGateSummaryUrl: null,
        topCount: 2,
        indexBaseUrl: 'https://example.com/manual-index-refresh',
      },
      cwd,
    )
    expect(refreshedFromIndex.inputPath).toBe(result.indexPath)
    expect(refreshedFromIndex.inputArtifactType).toBe('issue-report-summary-index')
    expect(refreshedFromIndex.preferredPortableInputPath).toBe(refreshedFromIndex.manifestPath)
    expect(refreshedFromIndex.indexPath).toBe(result.indexPath)
    expect(refreshedFromIndex.manifestUrl).toBe(
      'https://example.com/manual-index-refresh/artifacts-manifest.json',
    )
    expect(
      parseIssueReportSummaryIndex(
        JSON.parse(await fs.readFile(refreshedFromIndex.indexPath, 'utf8')),
      ).manualManifestFile?.url,
    ).toBe('https://example.com/manual-index-refresh/artifacts-manifest.json')
    expect(
      parseIssueReportSummaryIndex(
        JSON.parse(await fs.readFile(refreshedFromIndex.indexPath, 'utf8')),
      ).indexFile?.url,
    ).toBe('https://example.com/manual-index-refresh/issue-summary-index.json')

    const overriddenPacketRootPath = path.join(cwd, 'root-canonical-packets')
    const overriddenPacketSummaryPath = path.join(
      overriddenPacketRootPath,
      'manual-summary.md',
    )
    const overriddenPacketManifestPath = path.join(
      overriddenPacketRootPath,
      'manual-manifest.json',
    )
    const manifestOverride = {
      ...manifest,
      preferredCsvUrl: 'https://example.com/root-canonical/publish-gate-districts.csv',
      packetRootUrl: 'https://example.com/root-canonical-packets',
      packetArtifactUrl: 'https://example.com/root-canonical-packets',
      packetRootPath: overriddenPacketRootPath,
      packetSummaryPath: overriddenPacketSummaryPath,
      packetSummaryRelativePath: 'manual-summary.md',
      packetSummaryUrl: 'https://example.com/root-canonical-packets/manual-summary.md',
      packetManifestPath: overriddenPacketManifestPath,
      packetManifestRelativePath: 'manual-manifest.json',
      packetManifestUrl: 'https://example.com/root-canonical-packets/manual-manifest.json',
      packetPaths: [overriddenPacketManifestPath],
    }
    await fs.writeFile(result.manifestPath, JSON.stringify(manifestOverride, null, 2), 'utf8')

    const refreshedFromManifest = await buildIssueReportSummaryArtifacts(
      {
        inputPath: result.manifestPath,
        label: 'Manual Manifest Refresh',
        inputUrl: 'https://example.com/manual-manifest-refresh',
        publishGateSummaryUrl: null,
        topCount: 2,
        indexBaseUrl: 'https://example.com/manual-index-manifest',
      },
      cwd,
    )
    expect(refreshedFromManifest.inputPath).toBe(result.manifestPath)
    expect(refreshedFromManifest.inputArtifactType).toBe('issue-report-summary-artifacts')
    expect(refreshedFromManifest.preferredPortableInputPath).toBe(
      refreshedFromManifest.manifestPath,
    )
    expect(refreshedFromManifest.indexPath).toBe(result.indexPath)
    expect(refreshedFromManifest.manifestUrl).toBe(
      'https://example.com/manual-index-manifest/artifacts-manifest.json',
    )
    expect(
      parseIssueReportSummaryIndex(
        JSON.parse(await fs.readFile(refreshedFromManifest.indexPath, 'utf8')),
      ).manualManifestFile?.url,
    ).toBe('https://example.com/manual-index-manifest/artifacts-manifest.json')
    expect(
      parseIssueReportSummaryIndex(
        JSON.parse(await fs.readFile(refreshedFromManifest.indexPath, 'utf8')),
      ).indexFile?.url,
    ).toBe('https://example.com/manual-index-manifest/issue-summary-index.json')
    expect(
      parseIssueReportSummaryIndex(
        JSON.parse(await fs.readFile(refreshedFromManifest.indexPath, 'utf8')),
      ).preferredCsvFile?.url,
    ).toBe('https://example.com/root-canonical/publish-gate-districts.csv')
    expect(
      parseIssueReportSummaryIndex(
        JSON.parse(await fs.readFile(refreshedFromManifest.indexPath, 'utf8')),
      ).packetSummaryFile?.url,
    ).toBe('https://example.com/root-canonical-packets/manual-summary.md')
    expect(
      parseIssueReportSummaryIndex(
        JSON.parse(await fs.readFile(refreshedFromManifest.indexPath, 'utf8')),
      ).packetManifestFile?.url,
    ).toBe('https://example.com/root-canonical-packets/manual-manifest.json')
    expect(
      JSON.parse(await fs.readFile(refreshedFromManifest.indexSummaryJsonPath, 'utf8'))
        .artifactLinks.preferredCsvUrl,
    ).toBe('https://example.com/root-canonical/publish-gate-districts.csv')
    expect(
      JSON.parse(await fs.readFile(refreshedFromManifest.indexSummaryJsonPath, 'utf8'))
        .artifactLinks.packetSummaryUrl,
    ).toBe('https://example.com/root-canonical-packets/manual-summary.md')
    expect(
      JSON.parse(await fs.readFile(refreshedFromManifest.indexSummaryJsonPath, 'utf8'))
        .artifactLinks.packetManifestUrl,
    ).toBe('https://example.com/root-canonical-packets/manual-manifest.json')
    expect(
      JSON.parse(await fs.readFile(refreshedFromManifest.indexSurfacePath, 'utf8'))
        .preferredCsvUrl,
    ).toBe('https://example.com/root-canonical/publish-gate-districts.csv')
    expect(
      JSON.parse(await fs.readFile(refreshedFromManifest.indexSurfacePath, 'utf8'))
        .packetSummaryUrl,
    ).toBe('https://example.com/root-canonical-packets/manual-summary.md')
    expect(
      JSON.parse(await fs.readFile(refreshedFromManifest.indexSurfacePath, 'utf8'))
        .packetManifestUrl,
    ).toBe('https://example.com/root-canonical-packets/manual-manifest.json')
    expect(refreshedFromManifest.preferredCsvUrl).toBe(
      'https://example.com/root-canonical/publish-gate-districts.csv',
    )
    expect(refreshedFromManifest.packetRootUrl).toBe(
      'https://example.com/root-canonical-packets',
    )
    expect(refreshedFromManifest.packetBaseUrl).toBeNull()
    expect(refreshedFromManifest.packetArtifactUrl).toBeNull()
    expect(refreshedFromManifest.packetSummaryPath).toBe(overriddenPacketSummaryPath)
    expect(refreshedFromManifest.packetSummaryRelativePath).toBe('manual-summary.md')
    expect(refreshedFromManifest.packetSummaryUrl).toBe(
      'https://example.com/root-canonical-packets/manual-summary.md',
    )
    expect(refreshedFromManifest.packetManifestPath).toBe(overriddenPacketManifestPath)
    expect(refreshedFromManifest.packetManifestRelativePath).toBe('manual-manifest.json')
    expect(refreshedFromManifest.packetManifestUrl).toBe(
      'https://example.com/root-canonical-packets/manual-manifest.json',
    )
    expect(renderIssueReportSummaryArtifactsResult(refreshedFromManifest)).toContain(
      'Preferred CSV join file URL: https://example.com/root-canonical/publish-gate-districts.csv',
    )
    expect(renderIssueReportSummaryArtifactsResult(refreshedFromManifest)).toContain(
      `Packet summary: ${overriddenPacketSummaryPath}`,
    )
    expect(renderIssueReportSummaryArtifactsResult(refreshedFromManifest)).toContain(
      'Packet summary entry: manual-summary.md',
    )
    expect(renderIssueReportSummaryArtifactsResult(refreshedFromManifest)).toContain(
      `Packet preferred portable input: ${overriddenPacketManifestPath}`,
    )
    expect(renderIssueReportSummaryArtifactsResult(refreshedFromManifest)).toContain(
      'Packet preferred portable input entry: manual-manifest.json',
    )
    expect(renderIssueReportSummaryArtifactsResult(refreshedFromManifest)).toContain(
      'Packet preferred portable input URL: https://example.com/root-canonical-packets/manual-manifest.json',
    )
  })
})
