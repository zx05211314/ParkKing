import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { buildIssueReportSummaryJsonOutput, loadIssueReportSummary } from './issueReportSummary'
import { buildIssueReportSummaryArtifacts } from './issueReportSummaryArtifacts'
import {
  buildIssueReportSummaryJsonSurfaceSummary,
  loadIssueReportSummaryJsonOutput,
  parseIssueReportSummaryJsonOutput,
  renderIssueReportSummaryJsonWriteResult,
  renderIssueReportSummaryJsonSurfaceSummary,
} from './issueReportSummaryJson'

describe('issueReportSummaryJson', () => {
  it('loads and summarizes a versioned issue report summary export', async () => {
    const cwd = await fs.mkdtemp(path.join(tmpdir(), 'issue-report-summary-json-'))
    const outputPath = path.join(cwd, 'issue-summary.json')
    const result = await loadIssueReportSummary({
      syncStorePath: path.join(cwd, 'missing.json'),
      scope: null,
      districtId: null,
      segmentId: null,
      reasonCode: null,
      since: null,
      limit: 10,
    })

    const summaryOutput = buildIssueReportSummaryJsonOutput({
      result,
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: outputPath,
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

    await fs.writeFile(outputPath, JSON.stringify(summaryOutput, null, 2), 'utf8')

    const loaded = await loadIssueReportSummaryJsonOutput(outputPath)
    expect(loaded.summary.artifactType).toBe('issue-report-summary-json')
    expect(loaded.summary.schemaVersion).toBe(1)
    expect(loaded.summary.artifacts.packetManifestRelativePath).toBe('manifest.json')

    const summary = buildIssueReportSummaryJsonSurfaceSummary(loaded)
    expect(summary).toMatchObject({
      artifactType: 'issue-report-summary-json',
      schemaVersion: 1,
      totalCount: 0,
      filteredCount: 0,
      csvCount: 1,
      packetCount: 1,
      summaryRelativePath: 'issue-summary.json',
      summaryUrl: 'https://example.com/issue-summary/issue-summary.json',
      artifactIndexRelativePath: 'issue-summary-index.json',
      artifactIndexUrl: 'https://example.com/issue-summary/issue-summary-index.json',
      manualManifestRelativePath: 'artifacts-manifest.json',
      manualManifestUrl: 'https://example.com/issue-summary/artifacts-manifest.json',
      rawIssuesRelativePath: 'raw-issues.json',
      rawIssuesUrl: 'https://example.com/raw-issues/raw-issues.json',
      csvRootPath: path.join(cwd, 'issue-csv'),
      csvRootUrl: 'https://example.com/issue-csv',
      csvBaseUrl: null,
      preferredCsvRelativePath: 'top-segments.csv',
      preferredCsvUrl: 'https://example.com/issue-csv/top-segments.csv',
      packetRootPath: path.join(cwd, 'issue-packets'),
      packetRootUrl: 'https://example.com/issue-packets',
      packetBaseUrl: null,
      packetArtifactUrl: null,
      packetSummaryRelativePath: 'summary.md',
      packetSummaryUrl: 'https://example.com/issue-packets/summary.md',
      packetManifestRelativePath: 'manifest.json',
      packetManifestUrl: 'https://example.com/issue-packets/manifest.json',
    })
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Input surface: issue-report-summary-json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Packet manifest entry: manifest.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Summary URL: https://example.com/issue-summary/issue-summary.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Canonical full-index handoff: issue-summary-index.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Canonical full-index URL: https://example.com/issue-summary/issue-summary-index.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Manual artifacts manifest entry: artifacts-manifest.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Preferred portable input: artifacts-manifest.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Fallback compatibility input: issue-summary-index.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Raw issues URL: https://example.com/raw-issues/raw-issues.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      `CSV exchange root: ${path.join(cwd, 'issue-csv')}`,
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Preferred CSV join file: top-segments.csv',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      `Packet root: ${path.join(cwd, 'issue-packets')}`,
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Packet root URL: https://example.com/issue-packets',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Packet preferred portable input: manifest.json',
    )
    expect(renderIssueReportSummaryJsonSurfaceSummary(summary)).toContain(
      'Packet preferred portable input URL: https://example.com/issue-packets/manifest.json',
    )
    const legacyBaseSummary = renderIssueReportSummaryJsonSurfaceSummary({
      ...summary,
      csvRootUrl: 'https://example.com/canonical-issue-csv',
      csvBaseUrl: 'https://legacy.example.com/issue-csv',
      packetRootUrl: 'https://example.com/canonical-issue-packets',
      packetBaseUrl: 'https://legacy.example.com/issue-packets',
      packetArtifactUrl: 'https://older-legacy.example.com/issue-packets',
    })
    expect(legacyBaseSummary).toContain(
      'CSV exchange root URL: https://example.com/canonical-issue-csv',
    )
    expect(legacyBaseSummary).toContain(
      'Legacy CSV base URL: https://legacy.example.com/issue-csv',
    )
    expect(legacyBaseSummary).toContain(
      'Packet root URL: https://example.com/canonical-issue-packets',
    )
    expect(legacyBaseSummary).toContain(
      'Legacy packet base URL: https://legacy.example.com/issue-packets',
    )
    expect(legacyBaseSummary).toContain(
      'Older legacy packet artifact URL: https://older-legacy.example.com/issue-packets',
    )
    const aliasOnlySummary = renderIssueReportSummaryJsonSurfaceSummary({
      ...summary,
      csvRootUrl: null,
      csvBaseUrl: 'https://legacy.example.com/issue-csv',
      preferredCsvUrl: null,
      packetRootUrl: null,
      packetBaseUrl: 'https://legacy.example.com/issue-packets',
      packetArtifactUrl: null,
      packetSummaryUrl: null,
      packetManifestUrl: null,
    })
    expect(aliasOnlySummary).toContain(
      'CSV exchange root URL: https://legacy.example.com/issue-csv',
    )
    expect(aliasOnlySummary).not.toContain('Legacy CSV base URL:')
    expect(aliasOnlySummary).toContain(
      'Preferred CSV join file URL: https://legacy.example.com/issue-csv/top-segments.csv',
    )
    expect(aliasOnlySummary).toContain(
      'Packet root URL: https://legacy.example.com/issue-packets',
    )
    expect(aliasOnlySummary).not.toContain('Legacy packet base URL:')
    expect(aliasOnlySummary).not.toContain('Older legacy packet artifact URL:')
    expect(aliasOnlySummary).toContain(
      'Packet summary URL: https://legacy.example.com/issue-packets/summary.md',
    )
    expect(aliasOnlySummary).toContain(
      'Packet preferred portable input URL: https://legacy.example.com/issue-packets/manifest.json',
    )
    expect(
      renderIssueReportSummaryJsonWriteResult(
        'C:/tmp/index-surface.json',
        summary,
      ),
    ).toContain('Wrote issue report summary validation to C:/tmp/index-surface.json')
    expect(
      renderIssueReportSummaryJsonWriteResult(
        'C:/tmp/index-surface.json',
        summary,
      ),
    ).toContain('Canonical full-index handoff: issue-summary-index.json')

    await fs.mkdir(path.dirname(summaryOutput.artifacts.packetManifestPath!), { recursive: true })
    await fs.writeFile(
      summaryOutput.artifacts.packetManifestPath!,
      JSON.stringify(
        {
          artifactType: 'issue-report-triage-packets',
          schemaVersion: 1,
          generatedAt: '2026-04-10T12:00:00.000Z',
          storageFile: path.join(cwd, 'missing.json'),
          filters: result.filters,
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
          publishGateSummary: null,
          publishGateHotspots: [],
          segmentPackets: [],
          reasonPackets: [],
          csvExports: [],
        },
        null,
        2,
      ),
      'utf8',
    )

    const artifactBundle = await buildIssueReportSummaryArtifacts(
      {
        inputPath: outputPath,
        label: 'Manual',
        inputUrl: 'https://example.com/issue-summary/issue-summary.json',
        publishGateSummaryUrl: null,
        topCount: 3,
        indexBaseUrl: 'https://example.com/issue-summary',
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

    const loadedWithManualManifest = await loadIssueReportSummaryJsonOutput(outputPath)
    expect(loadedWithManualManifest.summary.artifacts.preferredCsvUrl).toBe(
      'https://example.com/root-canonical/top-segments.csv',
    )
    expect(loadedWithManualManifest.summary.artifacts.csvRootPath).toBe(
      overriddenCsvRootPath,
    )
    expect(loadedWithManualManifest.summary.artifacts.csvBaseUrl).toBeNull()
    expect(loadedWithManualManifest.summary.artifacts.packetSummaryRelativePath).toBe(
      'manual-summary.md',
    )
    expect(loadedWithManualManifest.summary.artifacts.packetSummaryUrl).toBe(
      'https://example.com/root-canonical-issue-packets/manual-summary.md',
    )
    expect(loadedWithManualManifest.summary.artifacts.packetRootPath).toBe(
      overriddenPacketRootPath,
    )
    expect(loadedWithManualManifest.summary.artifacts.packetBaseUrl).toBeNull()
    expect(loadedWithManualManifest.summary.artifacts.packetManifestRelativePath).toBe(
      'manual-manifest.json',
    )
    expect(loadedWithManualManifest.summary.artifacts.packetManifestUrl).toBe(
      'https://example.com/root-canonical-issue-packets/manual-manifest.json',
    )
    expect(
      renderIssueReportSummaryJsonSurfaceSummary(
        buildIssueReportSummaryJsonSurfaceSummary(loadedWithManualManifest),
      ),
    ).toContain('Preferred CSV join file URL: https://example.com/root-canonical/top-segments.csv')
    expect(
      renderIssueReportSummaryJsonSurfaceSummary(
        buildIssueReportSummaryJsonSurfaceSummary(loadedWithManualManifest),
      ),
    ).toContain(
      `CSV exchange root: ${overriddenCsvRootPath}`,
    )
    expect(
      renderIssueReportSummaryJsonSurfaceSummary(
        buildIssueReportSummaryJsonSurfaceSummary(loadedWithManualManifest),
      ),
    ).toContain(
      'CSV exchange root URL: https://example.com/root-canonical-issue-csv',
    )
    expect(
      renderIssueReportSummaryJsonSurfaceSummary(
        buildIssueReportSummaryJsonSurfaceSummary(loadedWithManualManifest),
      ),
    ).toContain(
      `Packet root: ${overriddenPacketRootPath}`,
    )
    expect(
      renderIssueReportSummaryJsonSurfaceSummary(
        buildIssueReportSummaryJsonSurfaceSummary(loadedWithManualManifest),
      ),
    ).toContain(
      'Packet root URL: https://example.com/root-canonical-issue-packets',
    )
    expect(
      renderIssueReportSummaryJsonSurfaceSummary(
        buildIssueReportSummaryJsonSurfaceSummary(loadedWithManualManifest),
      ),
    ).toContain(
      'Packet summary URL: https://example.com/root-canonical-issue-packets/manual-summary.md',
    )
    expect(
      renderIssueReportSummaryJsonSurfaceSummary(
        buildIssueReportSummaryJsonSurfaceSummary(loadedWithManualManifest),
      ),
    ).toContain(
      'Packet preferred portable input URL: https://example.com/root-canonical-issue-packets/manual-manifest.json',
    )
  })

  it('rejects packet relative path drift', () => {
    const parsed = buildIssueReportSummaryJsonOutput({
      result: {
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
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: 'C:/tmp/issue-summary.json',
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: null,
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
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: null,
        packetBaseUrl: null,
        packetSummaryPath: 'C:/tmp/issue-packets/summary.md',
        packetSummaryRelativePath: 'wrong.md',
        packetSummaryUrl: null,
        packetManifestPath: 'C:/tmp/issue-packets/manifest.json',
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: null,
        packetPaths: ['C:/tmp/issue-packets/manifest.json'],
        packetRelativePaths: ['manifest.json'],
      },
    })

    expect(() => parseIssueReportSummaryJsonOutput(parsed)).toThrow(
      'artifacts.packetSummaryRelativePath must resolve from its root path',
    )
  })

  it('treats base-url fields as legacy aliases in parser errors', () => {
    const parsed = buildIssueReportSummaryJsonOutput({
      result: {
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
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: 'C:/tmp/issue-summary.json',
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: null,
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath: null,
        csvRootUrl: null,
        csvBaseUrl: 'https://legacy.example.com/issue-csv',
        preferredCsvPath: null,
        preferredCsvRelativePath: null,
        preferredCsvUrl: null,
        csvPaths: [],
        csvRelativePaths: [],
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: null,
        packetBaseUrl: null,
        packetSummaryPath: 'C:/tmp/issue-packets/summary.md',
        packetSummaryRelativePath: 'summary.md',
        packetSummaryUrl: null,
        packetManifestPath: 'C:/tmp/issue-packets/manifest.json',
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: null,
        packetPaths: ['C:/tmp/issue-packets/manifest.json'],
        packetRelativePaths: ['manifest.json'],
      },
    })

    expect(() => parseIssueReportSummaryJsonOutput(parsed)).toThrow(
      'artifacts.csvBaseUrl is a legacy alias for csvRootUrl and requires csvRootPath',
    )
  })

  it('labels legacy base-url alias type errors explicitly', () => {
    const parsed = buildIssueReportSummaryJsonOutput({
      result: {
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
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: 'C:/tmp/issue-summary.json',
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: null,
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath: 'C:/tmp/issue-csv',
        csvRootUrl: null,
        csvBaseUrl: null,
        preferredCsvPath: null,
        preferredCsvRelativePath: null,
        preferredCsvUrl: null,
        csvPaths: [],
        csvRelativePaths: [],
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: null,
        packetBaseUrl: null,
        packetSummaryPath: 'C:/tmp/issue-packets/summary.md',
        packetSummaryRelativePath: 'summary.md',
        packetSummaryUrl: null,
        packetManifestPath: 'C:/tmp/issue-packets/manifest.json',
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: null,
        packetPaths: ['C:/tmp/issue-packets/manifest.json'],
        packetRelativePaths: ['manifest.json'],
      },
    }) as ReturnType<typeof buildIssueReportSummaryJsonOutput>

    ;(parsed.artifacts as unknown as Record<string, unknown>).csvBaseUrl = 42

    expect(() => parseIssueReportSummaryJsonOutput(parsed)).toThrow(
      'artifacts.csvBaseUrl is a legacy compat alias for csvRootUrl and must be a string or null',
    )
  })

  it('normalizes legacy base-url aliases into canonical root urls when parsing', () => {
    const parsed = buildIssueReportSummaryJsonOutput({
      result: {
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
      },
      publishGateSummary: null,
      publishGateHotspots: [],
      artifacts: {
        summaryPath: 'C:/tmp/issue-summary.json',
        summaryRelativePath: 'issue-summary.json',
        summaryUrl: null,
        rawIssuesPath: null,
        rawIssuesRelativePath: null,
        rawIssuesUrl: null,
        csvRootPath: 'C:/tmp/issue-csv',
        csvRootUrl: null,
        csvBaseUrl: 'https://legacy.example.com/issue-csv',
        preferredCsvPath: null,
        preferredCsvRelativePath: null,
        preferredCsvUrl: null,
        csvPaths: [],
        csvRelativePaths: [],
        packetRootPath: 'C:/tmp/issue-packets',
        packetRootUrl: null,
        packetBaseUrl: 'https://legacy.example.com/issue-packets',
        packetSummaryPath: 'C:/tmp/issue-packets/summary.md',
        packetSummaryRelativePath: 'summary.md',
        packetSummaryUrl: null,
        packetManifestPath: 'C:/tmp/issue-packets/manifest.json',
        packetManifestRelativePath: 'manifest.json',
        packetManifestUrl: null,
        packetPaths: ['C:/tmp/issue-packets/manifest.json'],
        packetRelativePaths: ['manifest.json'],
      },
    })

    const normalized = parseIssueReportSummaryJsonOutput(parsed)
    expect(normalized.artifacts.csvRootUrl).toBe('https://legacy.example.com/issue-csv')
    expect(normalized.artifacts.csvBaseUrl).toBeNull()
    expect(normalized.artifacts.packetRootUrl).toBe('https://legacy.example.com/issue-packets')
    expect(normalized.artifacts.packetBaseUrl).toBeNull()
  })
})
