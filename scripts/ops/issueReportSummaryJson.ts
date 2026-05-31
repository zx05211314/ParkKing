import { readFile } from 'node:fs/promises'
import { basename, parse, relative, resolve } from 'node:path'
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
  resolveIssueReportArtifactBundleUrls,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import { applyIssueReportManualManifestPreferredCsvToSummaryExport } from './issueReportManualPreferredCsv'
import { parseIssueReportSummaryJsonArgs } from './issueReportSummaryJsonArgs'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'
import { ISSUE_REPORT_SUMMARY_JSON_SCHEMA_VERSION } from './issueReportSummaryTypes'
import type { IssueReportSummaryJsonOutput } from './issueReportSummaryTypes'

export interface LoadedIssueReportSummaryJsonOutput {
  summaryPath: string
  summary: IssueReportSummaryJsonOutput
}

export interface IssueReportSummaryJsonSurfaceSummary {
  summaryPath: string
  artifactType: IssueReportSummaryJsonOutput['artifactType']
  schemaVersion: IssueReportSummaryJsonOutput['schemaVersion']
  totalCount: number
  filteredCount: number
  publishGateHotspotCount: number
  csvCount: number
  packetCount: number
  summaryRelativePath: string | null
  summaryUrl: string | null
  artifactIndexRelativePath: string | null
  artifactIndexUrl: string | null
  manualManifestRelativePath: string | null
  manualManifestUrl: string | null
  rawIssuesRelativePath: string | null
  rawIssuesUrl: string | null
  csvRootPath: string | null
  csvRootUrl: string | null
  csvBaseUrl: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  packetRootPath: string | null
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetBaseUrl: string | null
  // Older compat alias retained for pre-root-url raw summary consumers.
  packetArtifactUrl: string | null
  packetSummaryRelativePath: string | null
  packetSummaryUrl: string | null
  packetManifestRelativePath: string | null
  packetManifestUrl: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const assertRecord = (value: unknown, label: string) => {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

const assertString = (value: unknown, label: string) => {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }
  return value
}

const assertNullableString = (value: unknown, label: string) => {
  if (value === null || value === undefined) {
    return null
  }
  return assertString(value, label)
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

const assertNumber = (value: unknown, label: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }
  return value
}

const assertStringArray = (value: unknown, label: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`)
  }
  return value.map((entry, index) => assertString(entry, `${label}[${index}]`))
}

const assertRecordArray = (value: unknown, label: string) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`)
  }
  return value.map((entry, index) => assertRecord(entry, `${label}[${index}]`))
}

const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const joinPortablePath = (dirPath: string, fileName: string) => {
  const normalizedDir = toPortablePath(dirPath).replace(/\/+$/, '')
  if (normalizedDir.length === 0 || normalizedDir === '.') {
    return fileName
  }
  return `${normalizedDir}/${fileName}`
}

const resolveCanonicalSummaryIndexRelativePath = (summaryRelativePath: string | null) => {
  if (!summaryRelativePath) {
    return null
  }
  const parsedPath = parse(summaryRelativePath)
  return joinPortablePath(parsedPath.dir, `${parsedPath.name}-index${parsedPath.ext}`)
}

const resolveCanonicalSummaryIndexPath = (summaryPath: string) => {
  const parsedPath = parse(summaryPath)
  return resolve(parsedPath.dir, `${parsedPath.name}-index${parsedPath.ext}`)
}

const resolveSiblingUrl = (entryUrl: string | null, fileName: string) => {
  if (!entryUrl) {
    return null
  }
  const parsedUrl = new URL(entryUrl)
  const currentPath = parsedUrl.pathname.replace(/\/+$/, '')
  const nextPath = `${currentPath.replace(/\/[^/]*$/, '')}/${fileName}`.replace(/\/{2,}/g, '/')
  parsedUrl.pathname = nextPath
  return parsedUrl.toString()
}

const resolveCanonicalSummaryIndexUrl = (summaryUrl: string | null) => {
  if (!summaryUrl) {
    return null
  }
  const parsedUrl = new URL(summaryUrl)
  const currentPath = parsedUrl.pathname.replace(/\/+$/, '')
  const currentFileName = currentPath.split('/').pop()
  if (!currentFileName) {
    return null
  }
  const parsedFileName = parse(currentFileName)
  return resolveSiblingUrl(summaryUrl, `${parsedFileName.name}-index${parsedFileName.ext}`)
}

const pickPreferredCsvRelativePath = (summary: IssueReportSummaryJsonOutput) =>
  summary.artifacts.csvRelativePaths.find((entry) => entry === 'publish-gate-districts.csv')
  ?? summary.artifacts.csvRelativePaths.find((entry) => entry === 'top-segments.csv')
  ?? summary.artifacts.csvRelativePaths[0]
  ?? null

const assertFileNameRelativePath = (
  absolutePath: string | null,
  relativePath: string | null,
  label: string,
) => {
  if (!absolutePath || !relativePath) {
    return
  }
  if (toPortablePath(basename(absolutePath)) !== relativePath) {
    throw new Error(`${label} must match the exported file name`)
  }
}

const assertRootRelativePath = (
  rootPath: string | null,
  absolutePath: string | null,
  relativePath: string | null,
  label: string,
) => {
  if (!rootPath || !absolutePath || !relativePath) {
    return
  }
  const resolvedRelativePath = toPortablePath(relative(rootPath, absolutePath))
  if (resolvedRelativePath !== relativePath) {
    throw new Error(`${label} must resolve from its root path`)
  }
}

export const parseIssueReportSummaryJsonOutput = (
  value: unknown,
  label = 'issueReportSummaryJson',
): IssueReportSummaryJsonOutput => {
  const record = assertRecord(value, label)
  const artifactType = assertString(record.artifactType, `${label}.artifactType`)
  if (artifactType !== 'issue-report-summary-json') {
    throw new Error(`${label}.artifactType must be issue-report-summary-json`)
  }

  const schemaVersion = assertNumber(record.schemaVersion, `${label}.schemaVersion`)
  if (schemaVersion !== ISSUE_REPORT_SUMMARY_JSON_SCHEMA_VERSION) {
    throw new Error(
      `${label}.schemaVersion must be ${ISSUE_REPORT_SUMMARY_JSON_SCHEMA_VERSION}`,
    )
  }

  const artifacts = assertRecord(record.artifacts, `${label}.artifacts`)
  const summaryPath = assertNullableString(
    artifacts.summaryPath ?? null,
    `${label}.artifacts.summaryPath`,
  )
  const summaryRelativePath = assertNullableString(
    artifacts.summaryRelativePath ?? null,
    `${label}.artifacts.summaryRelativePath`,
  )
  const summaryUrl = assertNullableString(
    artifacts.summaryUrl ?? null,
    `${label}.artifacts.summaryUrl`,
  )
  const rawIssuesPath = assertNullableString(
    artifacts.rawIssuesPath ?? null,
    `${label}.artifacts.rawIssuesPath`,
  )
  const rawIssuesRelativePath = assertNullableString(
    artifacts.rawIssuesRelativePath ?? null,
    `${label}.artifacts.rawIssuesRelativePath`,
  )
  const rawIssuesUrl = assertNullableString(
    artifacts.rawIssuesUrl ?? null,
    `${label}.artifacts.rawIssuesUrl`,
  )
  const csvRootPath = assertNullableString(
    artifacts.csvRootPath ?? null,
    `${label}.artifacts.csvRootPath`,
  )
  const csvRootUrl = assertNullableString(
    artifacts.csvRootUrl ?? null,
    `${label}.artifacts.csvRootUrl`,
  )
  const csvBaseUrl = assertNullableString(
    assertNullableCompatAliasString(
      artifacts.csvBaseUrl ?? null,
      `${label}.artifacts.csvBaseUrl`,
      'csvRootUrl',
    ),
    `${label}.artifacts.csvBaseUrl`,
  )
  const preferredCsvPath = assertNullableString(
    artifacts.preferredCsvPath ?? null,
    `${label}.artifacts.preferredCsvPath`,
  )
  const preferredCsvRelativePath = assertNullableString(
    artifacts.preferredCsvRelativePath ?? null,
    `${label}.artifacts.preferredCsvRelativePath`,
  )
  const preferredCsvUrl = assertNullableString(
    artifacts.preferredCsvUrl ?? null,
    `${label}.artifacts.preferredCsvUrl`,
  )
  const csvPaths = assertStringArray(artifacts.csvPaths ?? [], `${label}.artifacts.csvPaths`)
  const csvRelativePaths = assertStringArray(
    artifacts.csvRelativePaths ?? [],
    `${label}.artifacts.csvRelativePaths`,
  )
  const packetRootPath = assertNullableString(
    artifacts.packetRootPath ?? null,
    `${label}.artifacts.packetRootPath`,
  )
  const packetRootUrl = assertNullableString(
    artifacts.packetRootUrl ?? null,
    `${label}.artifacts.packetRootUrl`,
  )
  const packetBaseUrl = assertNullableString(
    assertNullableCompatAliasString(
      artifacts.packetBaseUrl ?? null,
      `${label}.artifacts.packetBaseUrl`,
      'packetRootUrl',
    ),
    `${label}.artifacts.packetBaseUrl`,
  )
  const packetSummaryPath = assertNullableString(
    artifacts.packetSummaryPath ?? null,
    `${label}.artifacts.packetSummaryPath`,
  )
  const packetSummaryRelativePath = assertNullableString(
    artifacts.packetSummaryRelativePath ?? null,
    `${label}.artifacts.packetSummaryRelativePath`,
  )
  const packetSummaryUrl = assertNullableString(
    artifacts.packetSummaryUrl ?? null,
    `${label}.artifacts.packetSummaryUrl`,
  )
  const packetManifestPath = assertNullableString(
    artifacts.packetManifestPath ?? null,
    `${label}.artifacts.packetManifestPath`,
  )
  const packetManifestRelativePath = assertNullableString(
    artifacts.packetManifestRelativePath ?? null,
    `${label}.artifacts.packetManifestRelativePath`,
  )
  const packetManifestUrl = assertNullableString(
    artifacts.packetManifestUrl ?? null,
    `${label}.artifacts.packetManifestUrl`,
  )
  const packetPaths = assertStringArray(
    artifacts.packetPaths ?? [],
    `${label}.artifacts.packetPaths`,
  )
  const packetRelativePaths = assertStringArray(
    artifacts.packetRelativePaths ?? [],
    `${label}.artifacts.packetRelativePaths`,
  )

  if (csvPaths.length !== csvRelativePaths.length) {
    throw new Error(`${label}.artifacts.csvRelativePaths must match csvPaths`)
  }
  if (packetPaths.length !== packetRelativePaths.length) {
    throw new Error(`${label}.artifacts.packetRelativePaths must match packetPaths`)
  }

  assertFileNameRelativePath(
    summaryPath,
    summaryRelativePath,
    `${label}.artifacts.summaryRelativePath`,
  )
  assertFileNameRelativePath(
    rawIssuesPath,
    rawIssuesRelativePath,
    `${label}.artifacts.rawIssuesRelativePath`,
  )

  if (summaryUrl && !summaryRelativePath) {
    throw new Error(`${label}.artifacts.summaryUrl requires summaryRelativePath`)
  }
  if (rawIssuesUrl && !rawIssuesRelativePath) {
    throw new Error(`${label}.artifacts.rawIssuesUrl requires rawIssuesRelativePath`)
  }
  assertFileNameRelativePath(
    preferredCsvPath,
    preferredCsvRelativePath,
    `${label}.artifacts.preferredCsvRelativePath`,
  )
  if (preferredCsvUrl && !preferredCsvRelativePath) {
    throw new Error(`${label}.artifacts.preferredCsvUrl requires preferredCsvRelativePath`)
  }
  if (csvRootUrl && !csvRootPath) {
    throw new Error(`${label}.artifacts.csvRootUrl requires csvRootPath`)
  }
  csvPaths.forEach((filePath, index) => {
    assertRootRelativePath(
      csvRootPath,
      filePath,
      csvRelativePaths[index] ?? null,
      `${label}.artifacts.csvRelativePaths[${index}]`,
    )
  })
  assertRootRelativePath(
    packetRootPath,
    packetSummaryPath,
    packetSummaryRelativePath,
    `${label}.artifacts.packetSummaryRelativePath`,
  )
  if (packetSummaryUrl && !packetSummaryRelativePath) {
    throw new Error(`${label}.artifacts.packetSummaryUrl requires packetSummaryRelativePath`)
  }
  assertRootRelativePath(
    packetRootPath,
    packetManifestPath,
    packetManifestRelativePath,
    `${label}.artifacts.packetManifestRelativePath`,
  )
  if (packetManifestUrl && !packetManifestRelativePath) {
    throw new Error(`${label}.artifacts.packetManifestUrl requires packetManifestRelativePath`)
  }
  if (packetRootUrl && !packetRootPath) {
    throw new Error(`${label}.artifacts.packetRootUrl requires packetRootPath`)
  }
  packetPaths.forEach((filePath, index) => {
    assertRootRelativePath(
      packetRootPath,
      filePath,
      packetRelativePaths[index] ?? null,
      `${label}.artifacts.packetRelativePaths[${index}]`,
    )
  })
  if (csvBaseUrl && !csvRootPath) {
    throw new Error(
      `${label}.artifacts.csvBaseUrl is a legacy alias for csvRootUrl and requires csvRootPath`,
    )
  }
  if (packetBaseUrl && !packetRootPath) {
    throw new Error(
      `${label}.artifacts.packetBaseUrl is a legacy alias for packetRootUrl and requires packetRootPath`,
    )
  }

  assertString(record.storageFile, `${label}.storageFile`)
  assertNumber(record.totalCount, `${label}.totalCount`)
  assertNumber(record.filteredCount, `${label}.filteredCount`)
  assertRecord(record.filters, `${label}.filters`)
  assertRecordArray(record.topDistricts ?? [], `${label}.topDistricts`)
  assertRecordArray(record.latestDistricts ?? [], `${label}.latestDistricts`)
  assertRecordArray(record.topSegments ?? [], `${label}.topSegments`)
  assertRecordArray(record.topReasons ?? [], `${label}.topReasons`)
  assertRecordArray(record.summaries ?? [], `${label}.summaries`)
  assertRecordArray(record.segmentSummaries ?? [], `${label}.segmentSummaries`)
  assertRecordArray(record.issues ?? [], `${label}.issues`)
  assertRecordArray(record.rawIssues ?? [], `${label}.rawIssues`)
  assertRecordArray(record.publishGateHotspots ?? [], `${label}.publishGateHotspots`)

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
    ...(record as unknown as IssueReportSummaryJsonOutput),
    artifacts: {
      ...((record as unknown as IssueReportSummaryJsonOutput).artifacts),
      csvRootUrl: canonicalCsvRootUrl,
      csvBaseUrl: normalizedCsvBaseUrl,
      packetRootUrl: canonicalPacketRootUrl,
      packetBaseUrl: normalizedPacketBaseUrl,
    },
  }
}

export const loadIssueReportSummaryJsonOutput = async (
  summaryPath: string,
  cwd = process.cwd(),
): Promise<LoadedIssueReportSummaryJsonOutput> => {
  const resolvedPath = resolve(cwd, summaryPath)
  const parsedSummary = parseIssueReportSummaryJsonOutput(
    JSON.parse(await readFile(resolvedPath, 'utf8')),
    resolvedPath,
  )
  const manualManifestPath = resolveIssueReportManualArtifactsManifestPath(
    resolveCanonicalSummaryIndexPath(resolvedPath),
  )
  if (!manualManifestPath) {
    return {
      summaryPath: resolvedPath,
      summary: parsedSummary,
    }
  }
  try {
    const manualManifest = assertIssueReportArtifactManifestKind(
      (await loadIssueReportArtifactManifest(manualManifestPath, cwd)).manifest,
      'manual',
    )
    return {
      summaryPath: resolvedPath,
      summary: applyIssueReportManualManifestPreferredCsvToSummaryExport(
        parsedSummary,
        manualManifest,
      ),
    }
  } catch {
    return {
      summaryPath: resolvedPath,
      summary: parsedSummary,
    }
  }
}

export const buildIssueReportSummaryJsonSurfaceSummary = (
  loaded: LoadedIssueReportSummaryJsonOutput,
): IssueReportSummaryJsonSurfaceSummary => {
  const artifactIndexRelativePath = resolveCanonicalSummaryIndexRelativePath(
    loaded.summary.artifacts.summaryRelativePath,
  )
  const artifactIndexUrl = resolveCanonicalSummaryIndexUrl(
    loaded.summary.artifacts.summaryUrl,
  )
  const {
    csvRootUrl,
    csvBaseUrl,
    packetRootUrl,
    packetBaseUrl,
    packetArtifactUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl: loaded.summary.artifacts.packetRootUrl,
    packetLegacyBaseUrl: loaded.summary.artifacts.packetBaseUrl,
    csvRootUrl: loaded.summary.artifacts.csvRootUrl,
    csvLegacyBaseUrl: loaded.summary.artifacts.csvBaseUrl,
  })
  const preferredCsvRelativePath =
    loaded.summary.artifacts.preferredCsvRelativePath
    ?? pickPreferredCsvRelativePath(loaded.summary)
  const { preferredCsvUrl, packetSummaryUrl, packetManifestUrl } =
    resolveIssueReportArtifactBundleUrls({
      packetRootUrl,
      csvRootUrl,
      preferredCsvUrl: loaded.summary.artifacts.preferredCsvUrl,
      preferredCsvRelativePath,
      packetSummaryUrl: loaded.summary.artifacts.packetSummaryUrl,
      packetSummaryRelativePath: loaded.summary.artifacts.packetSummaryRelativePath,
      packetManifestUrl: loaded.summary.artifacts.packetManifestUrl,
      packetManifestRelativePath: loaded.summary.artifacts.packetManifestRelativePath,
    })
  return {
    summaryPath: loaded.summaryPath,
    artifactType: loaded.summary.artifactType,
    schemaVersion: loaded.summary.schemaVersion,
    totalCount: loaded.summary.totalCount,
    filteredCount: loaded.summary.filteredCount,
    publishGateHotspotCount: loaded.summary.publishGateHotspots.length,
    csvCount: loaded.summary.artifacts.csvPaths.length,
    packetCount: loaded.summary.artifacts.packetPaths.length,
    summaryRelativePath: loaded.summary.artifacts.summaryRelativePath,
    summaryUrl: loaded.summary.artifacts.summaryUrl,
    artifactIndexRelativePath,
    artifactIndexUrl,
    manualManifestRelativePath: resolveIssueReportManualArtifactsManifestRelativePath(
      artifactIndexRelativePath,
    ),
    manualManifestUrl: resolveIssueReportManualArtifactsManifestUrl(artifactIndexUrl),
    rawIssuesRelativePath: loaded.summary.artifacts.rawIssuesRelativePath,
    rawIssuesUrl: loaded.summary.artifacts.rawIssuesUrl,
    csvRootPath: loaded.summary.artifacts.csvRootPath,
    csvRootUrl,
    csvBaseUrl,
    preferredCsvRelativePath,
    preferredCsvUrl,
    packetRootPath: loaded.summary.artifacts.packetRootPath,
    packetRootUrl,
    packetBaseUrl,
    packetArtifactUrl,
    packetSummaryRelativePath: loaded.summary.artifacts.packetSummaryRelativePath,
    packetSummaryUrl,
    packetManifestRelativePath: loaded.summary.artifacts.packetManifestRelativePath,
    packetManifestUrl,
  }
}

export const renderIssueReportSummaryJsonSurfaceSummary = (
  summary: IssueReportSummaryJsonSurfaceSummary,
) => {
  const {
    csvRootUrl,
    csvBaseUrl: legacyCsvBaseUrl,
    packetRootUrl,
    packetBaseUrl: legacyPacketBaseUrl,
    packetArtifactUrl: legacyPacketArtifactUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl: summary.packetRootUrl,
    packetLegacyBaseUrl: summary.packetBaseUrl,
    packetLegacyArtifactUrl: summary.packetArtifactUrl,
    csvRootUrl: summary.csvRootUrl,
    csvLegacyBaseUrl: summary.csvBaseUrl,
  })
  const {
    preferredCsvUrl,
    packetSummaryUrl,
    packetManifestUrl,
  } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl,
    csvRootUrl,
    preferredCsvUrl: summary.preferredCsvUrl,
    preferredCsvRelativePath: summary.preferredCsvRelativePath,
    packetSummaryUrl: summary.packetSummaryUrl,
    packetSummaryRelativePath: summary.packetSummaryRelativePath,
    packetManifestUrl: summary.packetManifestUrl,
    packetManifestRelativePath: summary.packetManifestRelativePath,
  })

  return [
    `Valid ${summary.artifactType} v${summary.schemaVersion}`,
    `Summary: ${summary.summaryPath}`,
    `Input surface: ${summary.artifactType}`,
    `Matching issue reports: ${summary.filteredCount} / ${summary.totalCount}`,
    `Publish gate hotspots: ${summary.publishGateHotspotCount}`,
    `CSV exports: ${summary.csvCount}`,
    `Packet entries: ${summary.packetCount}`,
    ...(summary.summaryRelativePath
      ? [`Summary entry: ${summary.summaryRelativePath}`]
      : []),
    ...(summary.summaryUrl ? [`Summary URL: ${summary.summaryUrl}`] : []),
    ...(summary.artifactIndexRelativePath
      ? [`Canonical full-index handoff: ${summary.artifactIndexRelativePath}`]
      : []),
    ...(summary.artifactIndexUrl
      ? [`Canonical full-index URL: ${summary.artifactIndexUrl}`]
      : []),
    ...(summary.manualManifestRelativePath
      ? [`Manual artifacts manifest entry: ${summary.manualManifestRelativePath}`]
      : []),
    ...(summary.manualManifestUrl
      ? [`Manual artifacts manifest URL: ${summary.manualManifestUrl}`]
      : []),
    ...(summary.manualManifestRelativePath
      ? [`Preferred portable input: ${summary.manualManifestRelativePath}`]
      : []),
    ...(summary.manualManifestUrl
      ? [`Preferred portable input URL: ${summary.manualManifestUrl}`]
      : []),
    ...(summary.artifactIndexRelativePath
      ? [`Fallback compatibility input: ${summary.artifactIndexRelativePath}`]
      : []),
    ...(summary.artifactIndexUrl
      ? [`Fallback compatibility input URL: ${summary.artifactIndexUrl}`]
      : []),
    ...(summary.rawIssuesRelativePath
      ? [`Raw issues entry: ${summary.rawIssuesRelativePath}`]
      : []),
    ...(summary.rawIssuesUrl ? [`Raw issues URL: ${summary.rawIssuesUrl}`] : []),
    ...(summary.csvRootPath ? [`CSV exchange root: ${summary.csvRootPath}`] : []),
    ...(csvRootUrl
      ? [`CSV exchange root URL: ${csvRootUrl}`]
      : []),
    ...(legacyCsvBaseUrl
      ? [`Legacy CSV base URL: ${legacyCsvBaseUrl}`]
      : []),
    ...(summary.preferredCsvRelativePath
      ? [`Preferred CSV join file: ${summary.preferredCsvRelativePath}`]
      : []),
    ...(preferredCsvUrl
      ? [`Preferred CSV join file URL: ${preferredCsvUrl}`]
      : []),
    ...(summary.packetRootPath ? [`Packet root: ${summary.packetRootPath}`] : []),
    ...(packetRootUrl
      ? [`Packet root URL: ${packetRootUrl}`]
      : []),
    ...(legacyPacketBaseUrl
      ? [`Legacy packet base URL: ${legacyPacketBaseUrl}`]
      : []),
    ...(legacyPacketArtifactUrl
      ? [`Older legacy packet artifact URL: ${legacyPacketArtifactUrl}`]
      : []),
    ...(summary.packetSummaryRelativePath
      ? [`Packet summary entry: ${summary.packetSummaryRelativePath}`]
      : []),
    ...(packetSummaryUrl
      ? [`Packet summary URL: ${packetSummaryUrl}`]
      : []),
    ...(summary.packetManifestRelativePath
      ? [`Packet manifest entry: ${summary.packetManifestRelativePath}`]
      : []),
    ...(packetManifestUrl
      ? [`Packet manifest URL: ${packetManifestUrl}`]
      : []),
    ...(summary.packetManifestRelativePath
      ? [`Packet preferred portable input: ${summary.packetManifestRelativePath}`]
      : []),
    ...(packetManifestUrl
      ? [`Packet preferred portable input URL: ${packetManifestUrl}`]
      : []),
  ].join('\n')
}

export const renderIssueReportSummaryJsonWriteResult = (
  outPath: string,
  summary: IssueReportSummaryJsonSurfaceSummary,
) => [`Wrote issue report summary validation to ${outPath}`, '', renderIssueReportSummaryJsonSurfaceSummary(summary)].join(
  '\n',
)

const run = async () => {
  const args = parseIssueReportSummaryJsonArgs(process.argv)
  const loaded = await loadIssueReportSummaryJsonOutput(args.summaryPath)
  const summary = buildIssueReportSummaryJsonSurfaceSummary(loaded)
  const content = args.json
    ? JSON.stringify(summary, null, 2)
    : renderIssueReportSummaryJsonSurfaceSummary(summary)

  if (args.outPath) {
    const outPath = await writeIssueReportSummaryOutput(args.outPath, content)
    console.log(renderIssueReportSummaryJsonWriteResult(outPath, summary))
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
