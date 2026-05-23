import { access, readFile } from 'node:fs/promises'
import { dirname, parse, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveIssueReportManualArtifactsManifestPath,
  resolveIssueReportManualArtifactsManifestRelativePath,
  resolveIssueReportManualArtifactsManifestUrl,
} from './issueReportArtifactSidecars'
import {
  assertIssueReportArtifactManifestKind,
  loadIssueReportArtifactManifest,
} from './issueReportArtifactManifest'
import {
  joinIssueReportBaseUrl,
  resolveIssueReportArtifactBundleUrls,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import {
  applyIssueReportManualManifestPreferredCsvToSummaryExport,
  applyIssueReportManualManifestPreferredCsvToSummaryIndex,
} from './issueReportManualPreferredCsv'
import { parseIssueReportSummaryJsonOutput } from './issueReportSummaryJson'
import { parseIssueReportSummaryIndexArgs } from './issueReportSummaryIndexArgs'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'
import {
  ISSUE_REPORT_SUMMARY_INDEX_SCHEMA_VERSION,
} from './issueReportSummaryTypes'
import type {
  IssueReportSummaryIndexFileEntry,
  IssueReportSummaryIndexOutput,
  IssueReportSummaryJsonOutput,
  IssueReportTriagePacketManifest,
} from './issueReportSummaryTypes'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const escapeCell = (value: string) => value.replace(/\|/g, '\\|')
const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const assertNullableStringField = (value: unknown, label: string) => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string or null`)
  }
  return value
}

const assertNullableCompatAliasString = (
  value: unknown,
  label: string,
  canonicalLabel: string,
) => {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error(
      `${label} is a legacy compat alias for ${canonicalLabel} and must be a string or null`,
    )
  }
  return value
}

const pathExists = async (filePath: string | null) => {
  if (!filePath) {
    return false
  }
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const toIndexEntry = (params: {
  path: string | null
  relativePath: string | null
  baseUrl?: string | null
  url?: string | null
}): IssueReportSummaryIndexFileEntry | null =>
  params.path && params.relativePath
      ? {
          path: params.path,
          relativePath: params.relativePath,
          url: params.url ?? joinIssueReportBaseUrl(params.baseUrl ?? null, params.relativePath),
        }
      : null

const toRelativeIndexPath = (summaryPath: string, indexPath: string) =>
  toPortablePath(relative(dirname(summaryPath), indexPath))

const toCanonicalSummaryIndexPath = (summaryPath: string) => {
  const parsedPath = parse(summaryPath)
  return resolve(parsedPath.dir, `${parsedPath.name}-index${parsedPath.ext}`)
}

const pickPreferredCsvFileEntry = (entries: IssueReportSummaryIndexFileEntry[]) =>
  entries.find((entry) => entry.relativePath === 'publish-gate-districts.csv')
  ?? entries.find((entry) => entry.relativePath === 'top-segments.csv')
  ?? entries[0]
  ?? null

const pickPreferredCsvExport = (index: IssueReportSummaryIndexOutput) =>
  pickPreferredCsvFileEntry(index.csvExports)

export const buildIssueReportSummaryIndex = (params: {
  summaryPath: string
  summary: IssueReportSummaryJsonOutput
  packetManifest?: IssueReportTriagePacketManifest | null
  indexPath?: string | null
  indexBaseUrl?: string | null
}): IssueReportSummaryIndexOutput => {
  const indexRelativePath =
    params.indexPath ? toRelativeIndexPath(params.summaryPath, params.indexPath) : null
  const {
    csvRootUrl,
    csvBaseUrl,
    packetRootUrl,
    packetBaseUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl: params.summary.artifacts.packetRootUrl,
    packetLegacyBaseUrl: params.summary.artifacts.packetBaseUrl,
    csvRootUrl: params.summary.artifacts.csvRootUrl,
    csvLegacyBaseUrl: params.summary.artifacts.csvBaseUrl,
  })
  const csvExports = params.summary.artifacts.csvPaths.map((filePath, index) => ({
    path: filePath,
    relativePath: params.summary.artifacts.csvRelativePaths[index] ?? filePath,
    url:
      params.summary.artifacts.csvRelativePaths[index] === params.summary.artifacts.preferredCsvRelativePath
      && params.summary.artifacts.preferredCsvUrl
        ? params.summary.artifacts.preferredCsvUrl
        : joinIssueReportBaseUrl(
          csvRootUrl,
          params.summary.artifacts.csvRelativePaths[index] ?? filePath,
        ),
  }))
  const preferredCsvExport = pickPreferredCsvFileEntry(csvExports)
  const packetFiles = params.summary.artifacts.packetPaths.map((filePath, index) => ({
    path: filePath,
    relativePath: params.summary.artifacts.packetRelativePaths[index] ?? filePath,
    url:
      params.summary.artifacts.packetRelativePaths[index] === params.summary.artifacts.packetSummaryRelativePath
        ? params.summary.artifacts.packetSummaryUrl
        : params.summary.artifacts.packetRelativePaths[index] === params.summary.artifacts.packetManifestRelativePath
          ? params.summary.artifacts.packetManifestUrl
          : joinIssueReportBaseUrl(
            packetRootUrl,
            params.summary.artifacts.packetRelativePaths[index] ?? filePath,
          ),
  }))

  return ({
  artifactType: 'issue-report-summary-index',
  schemaVersion: ISSUE_REPORT_SUMMARY_INDEX_SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  sourceSummaryPath: params.summaryPath,
  sourceSummaryArtifactType: params.summary.artifactType,
  sourceSummarySchemaVersion: params.summary.schemaVersion,
  storageFile: params.summary.storageFile,
  totalCount: params.summary.totalCount,
  filteredCount: params.summary.filteredCount,
  filters: params.summary.filters,
  publishGateSummary: params.summary.publishGateSummary,
  publishGateHotspots: params.summary.publishGateHotspots.map((hotspot) => {
    const manifestHotspot =
      params.packetManifest?.publishGateHotspots.find(
        (entry) => entry.districtId === hotspot.districtId,
      ) ?? null
    return {
      ...hotspot,
      issueHotspotPacketPath: manifestHotspot?.issueHotspotPacketPath ?? null,
      issueHotspotPacketUrl: manifestHotspot?.issueHotspotPacketUrl ?? null,
    }
  }),
  topDistricts: params.summary.topDistricts,
  topSegments: params.summary.topSegments,
  topReasons: params.summary.topReasons,
    indexFile: toIndexEntry({
      path: params.indexPath ?? null,
      relativePath: indexRelativePath,
      url:
        indexRelativePath
          ? joinIssueReportBaseUrl(params.indexBaseUrl ?? null, indexRelativePath)
          : null,
    }),
    manualManifestFile: toIndexEntry({
      path: params.indexPath ? resolve(dirname(params.indexPath), 'artifacts-manifest.json') : null,
      relativePath: resolveIssueReportManualArtifactsManifestRelativePath(indexRelativePath),
      url: resolveIssueReportManualArtifactsManifestUrl(
        indexRelativePath
          ? joinIssueReportBaseUrl(params.indexBaseUrl ?? null, indexRelativePath)
          : null,
      ),
    }),
    summaryFile: toIndexEntry({
      path: params.summary.artifacts.summaryPath,
      relativePath: params.summary.artifacts.summaryRelativePath,
      url: params.summary.artifacts.summaryUrl,
    }),
  rawIssuesFile: toIndexEntry({
      path: params.summary.artifacts.rawIssuesPath,
      relativePath: params.summary.artifacts.rawIssuesRelativePath,
      url: params.summary.artifacts.rawIssuesUrl,
    }),
  csvRootPath: params.summary.artifacts.csvRootPath,
  csvRootUrl,
  csvBaseUrl,
  preferredCsvFile: toIndexEntry({
    path: params.summary.artifacts.preferredCsvPath ?? preferredCsvExport?.path ?? null,
    relativePath:
      params.summary.artifacts.preferredCsvRelativePath ?? preferredCsvExport?.relativePath ?? null,
    url: params.summary.artifacts.preferredCsvUrl ?? preferredCsvExport?.url ?? null,
  }),
  csvExports,
  packetRootPath: params.summary.artifacts.packetRootPath,
  packetRootUrl,
  packetBaseUrl,
  packetSummaryFile: toIndexEntry({
    path: params.summary.artifacts.packetSummaryPath,
    relativePath: params.summary.artifacts.packetSummaryRelativePath,
    baseUrl: packetRootUrl,
    url: params.summary.artifacts.packetSummaryUrl,
  }),
  packetManifestFile: toIndexEntry({
    path: params.summary.artifacts.packetManifestPath,
    relativePath: params.summary.artifacts.packetManifestRelativePath,
    baseUrl: packetRootUrl,
    url: params.summary.artifacts.packetManifestUrl,
  }),
  packetFiles,
  packetManifestArtifactType: params.packetManifest?.artifactType ?? null,
  packetManifestSchemaVersion: params.packetManifest?.schemaVersion ?? null,
  segmentPacketEntries: params.packetManifest?.segmentPackets ?? [],
  reasonPacketEntries: params.packetManifest?.reasonPackets ?? [],
  })
}

export const parseIssueReportSummaryIndex = (
  value: unknown,
): IssueReportSummaryIndexOutput => {
  if (!isRecord(value)) {
    throw new Error('issue report summary index must be an object')
  }
  if (value.artifactType !== 'issue-report-summary-index') {
    throw new Error('issue report summary index must have artifactType issue-report-summary-index')
  }
  if (value.schemaVersion !== ISSUE_REPORT_SUMMARY_INDEX_SCHEMA_VERSION) {
    throw new Error(
      `issue report summary index schemaVersion must be ${ISSUE_REPORT_SUMMARY_INDEX_SCHEMA_VERSION}`,
    )
  }

  const record = value as Record<string, unknown>
  const indexFile = record.indexFile
  if (indexFile !== null && indexFile !== undefined) {
    if (!isRecord(indexFile)) {
      throw new Error('issue report summary index indexFile must be an object when provided')
    }
    if (typeof indexFile.path !== 'string' || typeof indexFile.relativePath !== 'string') {
      throw new Error('issue report summary index indexFile must include path and relativePath')
    }
    if (
      indexFile.url !== null &&
      indexFile.url !== undefined &&
      typeof indexFile.url !== 'string'
    ) {
      throw new Error('issue report summary index indexFile.url must be a string or null')
    }
  }
  const manualManifestFile = record.manualManifestFile
  if (manualManifestFile !== null && manualManifestFile !== undefined) {
    if (!isRecord(manualManifestFile)) {
      throw new Error('issue report summary index manualManifestFile must be an object when provided')
    }
    if (
      typeof manualManifestFile.path !== 'string'
      || typeof manualManifestFile.relativePath !== 'string'
    ) {
      throw new Error(
        'issue report summary index manualManifestFile must include path and relativePath',
      )
    }
    if (
      manualManifestFile.url !== null &&
      manualManifestFile.url !== undefined &&
      typeof manualManifestFile.url !== 'string'
    ) {
      throw new Error(
        'issue report summary index manualManifestFile.url must be a string or null',
      )
    }
  }
  const preferredCsvFile = record.preferredCsvFile
  if (preferredCsvFile !== null && preferredCsvFile !== undefined) {
    if (!isRecord(preferredCsvFile)) {
      throw new Error('issue report summary index preferredCsvFile must be an object when provided')
    }
    if (
      typeof preferredCsvFile.path !== 'string'
      || typeof preferredCsvFile.relativePath !== 'string'
    ) {
      throw new Error(
        'issue report summary index preferredCsvFile must include path and relativePath',
      )
    }
    if (
      preferredCsvFile.url !== null &&
      preferredCsvFile.url !== undefined &&
      typeof preferredCsvFile.url !== 'string'
    ) {
      throw new Error(
        'issue report summary index preferredCsvFile.url must be a string or null',
      )
    }
  }
  const csvRootPath = assertNullableStringField(
    record.csvRootPath,
    'issue report summary index csvRootPath',
  )
  const csvRootUrl = assertNullableStringField(
    record.csvRootUrl,
    'issue report summary index csvRootUrl',
  )
  const csvBaseUrl = assertNullableCompatAliasString(
    record.csvBaseUrl,
    'issue report summary index csvBaseUrl',
    'csvRootUrl',
  )
  const packetRootPath = assertNullableStringField(
    record.packetRootPath,
    'issue report summary index packetRootPath',
  )
  const packetRootUrl = assertNullableStringField(
    record.packetRootUrl,
    'issue report summary index packetRootUrl',
  )
  const packetBaseUrl = assertNullableCompatAliasString(
    record.packetBaseUrl,
    'issue report summary index packetBaseUrl',
    'packetRootUrl',
  )
  if (csvRootUrl && !csvRootPath) {
    throw new Error('issue report summary index csvRootUrl requires csvRootPath')
  }
  if (csvBaseUrl && !csvRootPath) {
    throw new Error(
      'issue report summary index csvBaseUrl is a legacy compat alias for csvRootUrl and requires csvRootPath',
    )
  }
  if (packetRootUrl && !packetRootPath) {
    throw new Error('issue report summary index packetRootUrl requires packetRootPath')
  }
  if (packetBaseUrl && !packetRootPath) {
    throw new Error(
      'issue report summary index packetBaseUrl is a legacy compat alias for packetRootUrl and requires packetRootPath',
    )
  }

  const index = value as IssueReportSummaryIndexOutput
  const {
    csvRootUrl: canonicalCsvRootUrl,
    csvBaseUrl: normalizedCsvBaseUrl,
    packetRootUrl: canonicalPacketRootUrl,
    packetBaseUrl: normalizedPacketBaseUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl,
    packetLegacyBaseUrl: packetBaseUrl,
    csvRootUrl,
    csvLegacyBaseUrl: csvBaseUrl,
  })
  return {
    ...index,
    csvRootUrl: canonicalCsvRootUrl,
    csvBaseUrl: normalizedCsvBaseUrl,
    packetRootUrl: canonicalPacketRootUrl,
    packetBaseUrl: normalizedPacketBaseUrl,
  }
}

export const loadIssueReportSummaryIndex = async (
  indexPath: string,
  cwd = process.cwd(),
): Promise<IssueReportSummaryIndexOutput> => {
  const resolvedPath = resolve(cwd, indexPath)
  const parsedIndex = parseIssueReportSummaryIndex(JSON.parse(await readFile(resolvedPath, 'utf8')))
  const manualManifestPath =
    parsedIndex.manualManifestFile?.path
    ?? resolveIssueReportManualArtifactsManifestPath(resolvedPath)
  if (!manualManifestPath) {
    return parsedIndex
  }
  try {
    const manualManifest = assertIssueReportArtifactManifestKind(
      (await loadIssueReportArtifactManifest(manualManifestPath, cwd)).manifest,
      'manual',
    )
    return applyIssueReportManualManifestPreferredCsvToSummaryIndex(parsedIndex, manualManifest)
  } catch {
    return parsedIndex
  }
}

export const loadIssueReportSummaryIndexFromSummary = async (
  summaryPath: string,
  options: {
    indexPath?: string | null
    indexBaseUrl?: string | null
  } = {},
  cwd = process.cwd(),
): Promise<IssueReportSummaryIndexOutput> => {
  const resolvedSummaryPath = resolve(cwd, summaryPath)
  const parsedSummary = parseIssueReportSummaryJsonOutput(
    JSON.parse(await readFile(resolvedSummaryPath, 'utf8')),
  )
  const manualManifestPath = resolveIssueReportManualArtifactsManifestPath(
    options.indexPath ? resolve(cwd, options.indexPath) : toCanonicalSummaryIndexPath(resolvedSummaryPath),
  )
  const summary =
    manualManifestPath && (await pathExists(manualManifestPath))
      ? applyIssueReportManualManifestPreferredCsvToSummaryExport(
          parsedSummary,
          assertIssueReportArtifactManifestKind(
            (await loadIssueReportArtifactManifest(manualManifestPath, cwd)).manifest,
            'manual',
          ),
        )
      : parsedSummary
  const packetManifest =
    summary.artifacts.packetManifestPath && (await pathExists(summary.artifacts.packetManifestPath))
      ? assertIssueReportArtifactManifestKind(
          (await loadIssueReportArtifactManifest(summary.artifacts.packetManifestPath, cwd)).manifest,
          'packet',
        )
      : null
  return buildIssueReportSummaryIndex({
    summaryPath: resolvedSummaryPath,
    summary,
    packetManifest,
    indexPath: options.indexPath ? resolve(cwd, options.indexPath) : null,
    indexBaseUrl: options.indexBaseUrl ?? null,
  })
}

export const resolveIssueReportSummaryIndexOutPath = (
  args: {
    summaryPath: string
    outPath: string | null
    json: boolean
    writeIndex: boolean
  },
  cwd = process.cwd(),
) => {
  if (args.outPath) {
    return args.outPath
  }
  if (args.json && args.writeIndex) {
    return toCanonicalSummaryIndexPath(resolve(cwd, args.summaryPath))
  }
  return null
}

export const renderIssueReportSummaryIndex = (
  index: IssueReportSummaryIndexOutput,
  topCount = 5,
) => {
  const preferredCsvExport = pickPreferredCsvExport(index)
  const {
    csvRootUrl,
    csvBaseUrl: legacyCsvBaseUrl,
    packetRootUrl,
    packetBaseUrl: legacyPacketBaseUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl: index.packetRootUrl,
    packetLegacyBaseUrl: index.packetBaseUrl,
    csvRootUrl: index.csvRootUrl,
    csvLegacyBaseUrl: index.csvBaseUrl,
  })
  const {
    preferredCsvUrl,
    packetSummaryUrl,
    packetManifestUrl,
  } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl,
    csvRootUrl,
    preferredCsvUrl: index.preferredCsvFile?.url ?? preferredCsvExport?.url ?? null,
    preferredCsvRelativePath:
      index.preferredCsvFile?.relativePath ?? preferredCsvExport?.relativePath ?? null,
    packetSummaryUrl: index.packetSummaryFile?.url ?? null,
    packetSummaryRelativePath: index.packetSummaryFile?.relativePath ?? null,
    packetManifestUrl: index.packetManifestFile?.url ?? null,
    packetManifestRelativePath: index.packetManifestFile?.relativePath ?? null,
  })
  const lines = [
    '# Issue Report Summary Index',
    '',
    `Manifest schema: ${index.artifactType} v${index.schemaVersion}`,
    `Source summary schema: ${index.sourceSummaryArtifactType} v${index.sourceSummarySchemaVersion}`,
    `Source summary: ${index.sourceSummaryPath}`,
    `Input surface: ${index.sourceSummaryArtifactType}`,
    `Matching issue reports: ${index.filteredCount} / ${index.totalCount}`,
    `Canonical full-index handoff: ${index.indexFile?.relativePath ?? '-'}`,
    `Canonical full-index URL: ${index.indexFile?.url ?? '-'}`,
    `Manual manifest entry: ${index.manualManifestFile?.relativePath ?? '-'}`,
    `Manual manifest URL: ${index.manualManifestFile?.url ?? '-'}`,
    `Preferred portable input: ${index.manualManifestFile?.relativePath ?? '-'}`,
    `Preferred portable input URL: ${index.manualManifestFile?.url ?? '-'}`,
    `Fallback compatibility input: ${index.indexFile?.relativePath ?? '-'}`,
    `Fallback compatibility input URL: ${index.indexFile?.url ?? '-'}`,
    `Summary entry: ${index.summaryFile?.relativePath ?? '-'}`,
    `Summary URL: ${index.summaryFile?.url ?? '-'}`,
    `Raw issues entry: ${index.rawIssuesFile?.relativePath ?? '-'}`,
    `Raw issues URL: ${index.rawIssuesFile?.url ?? '-'}`,
    `CSV exchange root: ${index.csvRootPath ?? '-'}`,
    `CSV exchange root URL: ${csvRootUrl ?? '-'}`,
    ...(legacyCsvBaseUrl ? [`Legacy CSV base URL: ${legacyCsvBaseUrl}`] : []),
    `Preferred CSV join file: ${index.preferredCsvFile?.relativePath ?? preferredCsvExport?.relativePath ?? '-'}`,
    `Preferred CSV join file URL: ${preferredCsvUrl ?? '-'}`,
    `Packet root: ${index.packetRootPath ?? '-'}`,
    `Packet root URL: ${packetRootUrl ?? '-'}`,
    ...(legacyPacketBaseUrl ? [`Legacy packet base URL: ${legacyPacketBaseUrl}`] : []),
    `Packet summary entry: ${index.packetSummaryFile?.relativePath ?? '-'}`,
    `Packet summary URL: ${packetSummaryUrl ?? '-'}`,
    `Packet manifest entry: ${index.packetManifestFile?.relativePath ?? '-'}`,
    `Packet manifest URL: ${packetManifestUrl ?? '-'}`,
    `Packet preferred portable input: ${index.packetManifestFile?.relativePath ?? '-'}`,
    `Packet preferred portable input URL: ${packetManifestUrl ?? '-'}`,
    `Packet manifest schema: ${index.packetManifestArtifactType ?? '-'} ${index.packetManifestSchemaVersion ?? '-'}`,
    `CSV exports: ${index.csvExports.length}`,
    `Packet files: ${index.packetFiles.length}`,
    `Packet entries: ${index.segmentPacketEntries.length} segments / ${index.reasonPacketEntries.length} reasons`,
  ]

  if (index.publishGateSummary) {
    lines.push('')
    lines.push('## Publish Gate')
    lines.push('')
    lines.push('| Mode | Exit code | INFO | WARN | FAIL | Allow fail | Override reason |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    lines.push(
      `| ${index.publishGateSummary.mode} | ${index.publishGateSummary.exitCode} | ${index.publishGateSummary.totals.info} | ${index.publishGateSummary.totals.warn} | ${index.publishGateSummary.totals.fail} | ${index.publishGateSummary.allowFail ? 'yes' : 'no'} | ${escapeCell(index.publishGateSummary.overrideReason ?? '-')} |`,
    )
  }

  if (index.publishGateHotspots.length > 0) {
    lines.push('')
    lines.push('## Publish Gate Hotspots')
    lines.push('')
    lines.push(
      '| District | WARN | FAIL | Direct overrides | Spatial overrides | Unmatched named | Top issue hotspot | Packet |',
    )
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    index.publishGateHotspots.slice(0, topCount).forEach((hotspot) => {
      lines.push(
        `| ${hotspot.districtId} | ${hotspot.warn} | ${hotspot.fail} | ${hotspot.directOverrideMatches ?? '-'} | ${hotspot.spatialOverrideMatches ?? '-'} | ${hotspot.unmatchedNamedOverrides ?? '-'} | ${escapeCell(hotspot.issueHotspotSegmentLabel ?? '-')} | ${hotspot.issueHotspotPacketUrl ?? hotspot.issueHotspotPacketPath ?? '-'} |`,
      )
    })
  }

  if (index.topDistricts.length > 0) {
    lines.push('')
    lines.push('## Top Districts')
    lines.push('')
    lines.push('| Scope | District | Count | Latest | Latest summary |')
    lines.push('| --- | --- | --- | --- | --- |')
    index.topDistricts.slice(0, topCount).forEach((district) => {
      lines.push(
        `| ${district.scope} | ${district.districtId} | ${district.count} | ${district.latestCreatedAt ?? '-'} | ${escapeCell(district.latestSummary ?? '-')} |`,
      )
    })
  }

  if (index.topSegments.length > 0) {
    lines.push('')
    lines.push('## Top Segments')
    lines.push('')
    lines.push('| District | Segment | Tier | Count | Latest |')
    lines.push('| --- | --- | --- | --- | --- |')
    index.topSegments.slice(0, topCount).forEach((segment) => {
      lines.push(
        `| ${segment.districtId} | ${escapeCell(segment.segmentName ?? segment.segmentId)} | ${segment.segmentTier ?? '-'} | ${segment.count} | ${segment.latestCreatedAt ?? '-'} |`,
      )
    })
  }

  if (index.topReasons.length > 0) {
    lines.push('')
    lines.push('## Top Reasons')
    lines.push('')
    lines.push('| Reason | Count | Districts | Segments | Latest segment |')
    lines.push('| --- | --- | --- | --- | --- |')
    index.topReasons.slice(0, topCount).forEach((reason) => {
      lines.push(
        `| ${reason.reasonCode} | ${reason.count} | ${reason.districtCount} | ${reason.segmentCount} | ${escapeCell(reason.latestSegmentName ?? reason.latestSegmentId ?? '-')} |`,
      )
    })
  }

  if (index.csvExports.length > 0) {
    lines.push('')
    lines.push('## CSV Exports')
    lines.push('')
    lines.push('| File | URL |')
    lines.push('| --- | --- |')
    index.csvExports.slice(0, topCount).forEach((entry) => {
      lines.push(`| ${entry.relativePath} | ${entry.url ?? entry.path} |`)
    })
  }

  return lines.join('\n')
}

export const renderIssueReportSummaryIndexWriteResult = (
  outPath: string,
  index: IssueReportSummaryIndexOutput,
  topCount = 5,
) => [`Wrote issue report summary index to ${outPath}`, '', renderIssueReportSummaryIndex(index, topCount)].join(
  '\n',
)

const run = async () => {
  const args = parseIssueReportSummaryIndexArgs(process.argv)
  const resolvedOutPath = resolveIssueReportSummaryIndexOutPath(args)
  const indexOutputPath = args.json ? resolvedOutPath : null
  const index = await loadIssueReportSummaryIndexFromSummary(
    args.summaryPath,
    {
      indexPath: indexOutputPath,
      indexBaseUrl: args.indexBaseUrl,
    },
  )
  const content = args.json
    ? JSON.stringify(index, null, 2)
    : renderIssueReportSummaryIndex(index, args.topCount)

  if (resolvedOutPath) {
    const outPath = await writeIssueReportSummaryOutput(resolvedOutPath, content)
    console.log(renderIssueReportSummaryIndexWriteResult(outPath, index, args.topCount))
    return
  }

  console.log(content)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
