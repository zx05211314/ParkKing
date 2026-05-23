import { readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ISSUE_REPORT_MANUAL_ARTIFACTS_MANIFEST_PATH,
  ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
  ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
  ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
  resolveIssueReportManualArtifactsManifestUrl,
  resolveIssueReportManualSidecarPath,
  resolveIssueReportManualSidecarRelativePath,
  resolveIssueReportManualSidecarUrl,
} from './issueReportArtifactSidecars'
import {
  buildIssueReportArtifactSummaryJsonOutput,
  renderIssueReportArtifactSummary,
} from './issueReportArtifactSummary'
import { buildIssueReportArtifactSummaryJsonSurfaceSummary } from './issueReportArtifactSummaryJson'
import {
  joinIssueReportBaseUrl,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import { applyIssueReportManualManifestPreferredCsvToSummaryIndex } from './issueReportManualPreferredCsv'
import { parseIssueReportSummaryArtifactsArgs } from './issueReportSummaryArtifactsArgs'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'
import {
  loadIssueReportSummaryIndex,
  loadIssueReportSummaryIndexFromSummary,
  resolveIssueReportSummaryIndexOutPath,
} from './issueReportSummaryIndex'
import {
  ISSUE_REPORT_SUMMARY_ARTIFACTS_MANIFEST_SCHEMA_VERSION,
} from './issueReportSummaryTypes'
import type { IssueReportSummaryArtifactsManifest } from './issueReportSummaryTypes'
import {
  isIssueReportSummaryArtifactsManifest,
  resolveIssueReportArtifactEntryPath,
} from './issueReportWorkflowArtifactPaths'

const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const buildRootCompatArtifactLinks = (params: {
  packetRootUrl: string | null
  packetBaseUrl: string | null
  csvRootUrl: string | null
  csvBaseUrl: string | null
}) => {
  const {
    packetRootUrl,
    packetBaseUrl: packetArtifactUrl,
    csvRootUrl,
    csvBaseUrl: csvArtifactUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl: params.packetRootUrl,
    packetLegacyBaseUrl: params.packetBaseUrl,
    csvRootUrl: params.csvRootUrl,
    csvLegacyBaseUrl: params.csvBaseUrl,
  })

  return {
    packetRootUrl,
    packetArtifactUrl,
    csvRootUrl,
    csvArtifactUrl,
  }
}

const pathExists = async (filePath: string | null) => {
  if (!filePath) {
    return false
  }
  try {
    await readFile(filePath, 'utf8')
    return true
  } catch {
    return false
  }
}

interface LoadedIssueReportSummaryArtifactsInputIndex {
  resolvedInputPath: string
  inputArtifactType: 'issue-report-summary-json' | 'issue-report-summary-index' | 'issue-report-summary-artifacts'
  sourceSummaryPath: string | null
  indexPath: string
  existingIndex: Awaited<ReturnType<typeof loadIssueReportSummaryIndex>> | null
  existingManifest: IssueReportSummaryArtifactsManifest | null
}

const loadIssueReportSummaryArtifactsInputIndex = async (
  inputPath: string,
  cwd = process.cwd(),
): Promise<LoadedIssueReportSummaryArtifactsInputIndex> => {
  const resolvedInputPath = resolve(cwd, inputPath)
  const parsed = JSON.parse(await readFile(resolvedInputPath, 'utf8')) as { artifactType?: string }

  if (parsed.artifactType === 'issue-report-summary-json') {
    const indexPath =
      resolveIssueReportSummaryIndexOutPath(
        {
          summaryPath: resolvedInputPath,
          outPath: null,
          json: true,
          writeIndex: true,
        },
        cwd,
      ) ?? resolve(cwd, resolvedInputPath)
    return {
      resolvedInputPath,
      inputArtifactType: 'issue-report-summary-json',
      sourceSummaryPath: resolvedInputPath,
      indexPath,
      existingIndex: null,
      existingManifest: null,
    }
  }

  if (parsed.artifactType === 'issue-report-summary-index') {
    const index = await loadIssueReportSummaryIndex(resolvedInputPath, cwd)
    return {
      resolvedInputPath,
      inputArtifactType: 'issue-report-summary-index',
      sourceSummaryPath: index.sourceSummaryPath,
      indexPath: index.indexFile?.path ?? resolvedInputPath,
      existingIndex: index,
      existingManifest: null,
    }
  }

  if (isIssueReportSummaryArtifactsManifest(parsed)) {
    const sourceSummaryPath = resolveIssueReportArtifactEntryPath(
      resolvedInputPath,
      parsed.sourceSummaryRelativePath,
      parsed.sourceSummaryPath,
    )
    const artifactIndexPath =
      resolveIssueReportArtifactEntryPath(
        resolvedInputPath,
        parsed.artifactIndexRelativePath,
        parsed.artifactIndexPath,
      ) ?? parsed.artifactIndexPath

    if (artifactIndexPath && (await pathExists(artifactIndexPath)) && sourceSummaryPath) {
      const index = await loadIssueReportSummaryIndex(artifactIndexPath, cwd)
      return {
        resolvedInputPath,
        inputArtifactType: 'issue-report-summary-artifacts',
        sourceSummaryPath: sourceSummaryPath,
        indexPath: index.indexFile?.path ?? artifactIndexPath,
        existingIndex: index,
        existingManifest: parsed,
      }
    }

    if (sourceSummaryPath) {
      return {
        resolvedInputPath,
        inputArtifactType: 'issue-report-summary-artifacts',
        sourceSummaryPath,
        indexPath:
          artifactIndexPath
          ?? resolveIssueReportSummaryIndexOutPath(
            {
              summaryPath: sourceSummaryPath,
              outPath: null,
              json: true,
              writeIndex: true,
            },
            cwd,
          )
          ?? resolve(dirname(sourceSummaryPath), 'issue-summary-index.json'),
        existingIndex: null,
        existingManifest: parsed,
      }
    }
  }

  throw new Error(
    'issue report summary artifacts input must be issue-report-summary-json, issue-report-summary-index, or issue-report-summary-artifacts',
  )
}

export interface IssueReportSummaryArtifactsResult {
  inputPath: string
  inputArtifactType: LoadedIssueReportSummaryArtifactsInputIndex['inputArtifactType']
  summaryPath: string
  indexPath: string
  manifestPath: string
  manifestUrl: string | null
  preferredPortableInputPath: string
  preferredPortableInputUrl: string | null
  indexSummaryPath: string
  indexSummaryUrl: string | null
  indexSummaryJsonPath: string
  indexSummaryJsonUrl: string | null
  indexSurfacePath: string
  indexSurfaceUrl: string | null
  csvRootPath: string | null
  csvRootUrl: string | null
  // Legacy compat alias for csvRootUrl.
  csvBaseUrl: string | null
  preferredCsvPath: string | null
  preferredCsvRelativePath: string | null
  preferredCsvUrl: string | null
  packetRootPath: string | null
  packetRootUrl: string | null
  // Legacy compat alias for packetRootUrl.
  packetBaseUrl: string | null
  // Older compat alias retained for pre-root-url manual consumers.
  packetArtifactUrl: string | null
  packetSummaryPath: string | null
  packetSummaryRelativePath: string | null
  packetSummaryUrl: string | null
  packetManifestPath: string | null
  packetManifestRelativePath: string | null
  packetManifestUrl: string | null
}

export const renderIssueReportSummaryArtifactsResult = (
  result: IssueReportSummaryArtifactsResult,
) => {
  const legacyCsvBaseUrl =
    result.csvBaseUrl && result.csvBaseUrl !== result.csvRootUrl
      ? result.csvBaseUrl
      : null
  const legacyPacketBaseUrl =
    result.packetBaseUrl && result.packetBaseUrl !== result.packetRootUrl
      ? result.packetBaseUrl
      : null
  const legacyPacketArtifactUrl =
    result.packetArtifactUrl
    && result.packetArtifactUrl !== result.packetRootUrl
    && result.packetArtifactUrl !== result.packetBaseUrl
      ? result.packetArtifactUrl
      : null

  return [
    '# Issue Report Summary Artifacts',
    '',
    `Input: ${result.inputPath}`,
    `Input surface: ${result.inputArtifactType}`,
    `Summary: ${result.summaryPath}`,
    `Index: ${result.indexPath}`,
    `Manifest: ${result.manifestPath}`,
    `Preferred portable input: ${result.preferredPortableInputPath}`,
    ...(result.preferredPortableInputUrl
      ? [`Preferred portable input URL: ${result.preferredPortableInputUrl}`]
      : []),
    `Fallback compatibility input: ${result.indexPath}`,
    `Index summary: ${result.indexSummaryPath}`,
    ...(result.indexSummaryUrl ? [`Index summary URL: ${result.indexSummaryUrl}`] : []),
    `Index summary json: ${result.indexSummaryJsonPath}`,
    ...(result.indexSummaryJsonUrl ? [`Index summary json URL: ${result.indexSummaryJsonUrl}`] : []),
    `Index surface: ${result.indexSurfacePath}`,
    ...(result.indexSurfaceUrl ? [`Index surface URL: ${result.indexSurfaceUrl}`] : []),
    ...(result.csvRootPath ? [`CSV exchange root: ${result.csvRootPath}`] : []),
    ...(result.csvRootUrl ? [`CSV exchange root URL: ${result.csvRootUrl}`] : []),
    ...(legacyCsvBaseUrl ? [`Legacy CSV base URL: ${legacyCsvBaseUrl}`] : []),
    ...(result.preferredCsvPath ? [`Preferred CSV join file: ${result.preferredCsvPath}`] : []),
    ...(result.preferredCsvRelativePath
      ? [`Preferred CSV join file entry: ${result.preferredCsvRelativePath}`]
      : []),
    ...(result.preferredCsvUrl ? [`Preferred CSV join file URL: ${result.preferredCsvUrl}`] : []),
    ...(result.packetRootPath ? [`Packet root: ${result.packetRootPath}`] : []),
    ...(result.packetRootUrl ? [`Packet root URL: ${result.packetRootUrl}`] : []),
    ...(legacyPacketBaseUrl ? [`Legacy packet base URL: ${legacyPacketBaseUrl}`] : []),
    ...(legacyPacketArtifactUrl
      ? [`Older legacy packet artifact URL: ${legacyPacketArtifactUrl}`]
      : []),
    ...(result.packetSummaryPath ? [`Packet summary: ${result.packetSummaryPath}`] : []),
    ...(result.packetSummaryRelativePath
      ? [`Packet summary entry: ${result.packetSummaryRelativePath}`]
      : []),
    ...(result.packetSummaryUrl ? [`Packet summary URL: ${result.packetSummaryUrl}`] : []),
    ...(result.packetManifestPath
      ? [`Packet preferred portable input: ${result.packetManifestPath}`]
      : []),
    ...(result.packetManifestRelativePath
      ? [`Packet preferred portable input entry: ${result.packetManifestRelativePath}`]
      : []),
    ...(result.packetManifestUrl
      ? [`Packet preferred portable input URL: ${result.packetManifestUrl}`]
      : []),
    '',
  ].join('\n')
}

const buildIssueReportSummaryArtifactsManifestHotspots = (params: {
  outRoot: string
  packetRootPath: string | null
  packetRootUrl: string | null
  packetBaseUrl: string | null
  csvRootUrl: string | null
  csvBaseUrl: string | null
  publishGateHotspots: Awaited<
    ReturnType<typeof loadIssueReportSummaryIndexFromSummary>
  >['publishGateHotspots']
}) =>
  params.publishGateHotspots.map((hotspot) => {
    const packetPath =
      params.packetRootPath && hotspot.issueHotspotPacketPath
        ? toPortablePath(
            relative(
              params.outRoot,
              resolve(params.packetRootPath, hotspot.issueHotspotPacketPath),
            ),
          )
        : null
    return {
      districtId: hotspot.districtId,
      segmentLabel: hotspot.issueHotspotSegmentLabel,
      packetPath,
      ...buildRootCompatArtifactLinks(params),
    }
  })

export const buildIssueReportSummaryArtifacts = async (
  args: ReturnType<typeof parseIssueReportSummaryArtifactsArgs>,
  cwd = process.cwd(),
): Promise<IssueReportSummaryArtifactsResult> => {
  const inputPath = args.inputPath ?? args.summaryPath
  if (!inputPath) {
    throw new Error('input is required')
  }
  const loadedInput = await loadIssueReportSummaryArtifactsInputIndex(inputPath, cwd)
  const summaryIndex =
    loadedInput.sourceSummaryPath && (await pathExists(loadedInput.sourceSummaryPath))
      ? await loadIssueReportSummaryIndexFromSummary(
          loadedInput.sourceSummaryPath,
          {
            indexPath: loadedInput.indexPath,
            indexBaseUrl: args.indexBaseUrl,
          },
          cwd,
        )
      : loadedInput.existingIndex
        ? {
            ...loadedInput.existingIndex,
            indexFile: loadedInput.existingIndex.indexFile
              ? {
                  ...loadedInput.existingIndex.indexFile,
                  url:
                    args.indexBaseUrl
                      ? joinIssueReportBaseUrl(
                          args.indexBaseUrl,
                          loadedInput.existingIndex.indexFile.relativePath,
                        )
                      : loadedInput.existingIndex.indexFile.url,
                }
              : loadedInput.existingIndex.indexFile,
            manualManifestFile: loadedInput.existingIndex.manualManifestFile
              ? {
                  ...loadedInput.existingIndex.manualManifestFile,
                  url:
                    args.indexBaseUrl
                      ? joinIssueReportBaseUrl(
                          args.indexBaseUrl,
                          loadedInput.existingIndex.manualManifestFile.relativePath,
                        )
                      : loadedInput.existingIndex.manualManifestFile.url,
                }
              : loadedInput.existingIndex.manualManifestFile,
          }
        : null
  if (!summaryIndex) {
    throw new Error(
      'issue report summary artifacts input must include a canonical full index or a source summary json file',
    )
  }
  const manifestAwareSummaryIndex = loadedInput.existingManifest
    ? applyIssueReportManualManifestPreferredCsvToSummaryIndex(
        summaryIndex,
        loadedInput.existingManifest,
      )
    : summaryIndex
  const indexPath = manifestAwareSummaryIndex.indexFile?.path ?? loadedInput.indexPath

  const indexSummaryPath = resolveIssueReportManualSidecarPath(
    indexPath,
    ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
  )
  const manifestPath = resolveIssueReportManualSidecarPath(
    indexPath,
    ISSUE_REPORT_MANUAL_ARTIFACTS_MANIFEST_PATH,
  )
  const indexSummaryJsonPath = resolveIssueReportManualSidecarPath(
    indexPath,
    ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
  )
  const indexSurfacePath = resolveIssueReportManualSidecarPath(
    indexPath,
    ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
  )
  if (!manifestPath || !indexSummaryPath || !indexSummaryJsonPath || !indexSurfacePath) {
    throw new Error('unable to resolve canonical manual artifact sidecar paths')
  }

  const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
    index: manifestAwareSummaryIndex,
    options: {
      label: args.label,
      inputUrl: args.inputUrl,
      publishGateSummaryUrl: args.publishGateSummaryUrl,
      topCount: args.topCount,
      inputArtifactType: 'issue-report-summary-json',
    },
  })
  const surfaceSummary = buildIssueReportArtifactSummaryJsonSurfaceSummary({
    summaryPath: indexSummaryJsonPath,
    summary: summaryJson,
  })
  const markdownSummary = renderIssueReportArtifactSummary(manifestAwareSummaryIndex, {
    label: args.label,
    inputUrl: args.inputUrl,
    publishGateSummaryUrl: args.publishGateSummaryUrl,
    topCount: args.topCount,
    inputArtifactType: 'issue-report-summary-json',
  })
  const manifest: IssueReportSummaryArtifactsManifest = {
    artifactType: 'issue-report-summary-artifacts',
    schemaVersion: ISSUE_REPORT_SUMMARY_ARTIFACTS_MANIFEST_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    outRoot: dirname(indexPath),
    sourceSummaryPath: manifestAwareSummaryIndex.sourceSummaryPath,
    sourceSummaryRelativePath: manifestAwareSummaryIndex.summaryFile?.relativePath ?? null,
    sourceSummaryUrl: manifestAwareSummaryIndex.summaryFile?.url ?? null,
    sourceSummaryArtifactType: manifestAwareSummaryIndex.sourceSummaryArtifactType,
    sourceSummarySchemaVersion: manifestAwareSummaryIndex.sourceSummarySchemaVersion,
    publishGateSummary: manifestAwareSummaryIndex.publishGateSummary,
    publishGateHotspots: buildIssueReportSummaryArtifactsManifestHotspots({
      outRoot: dirname(indexPath),
      packetRootPath: manifestAwareSummaryIndex.packetRootPath,
      packetRootUrl: manifestAwareSummaryIndex.packetRootUrl,
      packetBaseUrl: manifestAwareSummaryIndex.packetBaseUrl,
      csvRootUrl: manifestAwareSummaryIndex.csvRootUrl,
      csvBaseUrl: manifestAwareSummaryIndex.csvBaseUrl,
      publishGateHotspots: manifestAwareSummaryIndex.publishGateHotspots,
    }),
    topDistricts: manifestAwareSummaryIndex.topDistricts,
    ...buildRootCompatArtifactLinks({
      packetRootUrl: manifestAwareSummaryIndex.packetRootUrl,
      packetBaseUrl: manifestAwareSummaryIndex.packetBaseUrl,
      csvRootUrl: manifestAwareSummaryIndex.csvRootUrl,
      csvBaseUrl: manifestAwareSummaryIndex.csvBaseUrl,
    }),
    packetRootPath: manifestAwareSummaryIndex.packetRootPath,
    packetSummaryPath: manifestAwareSummaryIndex.packetSummaryFile?.path ?? null,
    packetSummaryRelativePath: manifestAwareSummaryIndex.packetSummaryFile?.relativePath ?? null,
    packetSummaryUrl: manifestAwareSummaryIndex.packetSummaryFile?.url ?? null,
    packetManifestPath: manifestAwareSummaryIndex.packetManifestFile?.path ?? null,
    packetManifestRelativePath: manifestAwareSummaryIndex.packetManifestFile?.relativePath ?? null,
    packetManifestUrl: manifestAwareSummaryIndex.packetManifestFile?.url ?? null,
    csvRootPath: manifestAwareSummaryIndex.csvRootPath,
    preferredCsvPath: manifestAwareSummaryIndex.preferredCsvFile?.path ?? null,
    preferredCsvRelativePath: manifestAwareSummaryIndex.preferredCsvFile?.relativePath ?? null,
    preferredCsvUrl: manifestAwareSummaryIndex.preferredCsvFile?.url ?? null,
    summaryPath: indexSummaryPath,
    summaryRelativePath:
      resolveIssueReportManualSidecarRelativePath(
        manifestAwareSummaryIndex.indexFile?.relativePath ?? null,
        ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
      ) ?? ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
    summaryUrl: resolveIssueReportManualSidecarUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
      ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
    ),
    indexSummaryPath,
    indexSummaryRelativePath:
      resolveIssueReportManualSidecarRelativePath(
        manifestAwareSummaryIndex.indexFile?.relativePath ?? null,
        ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
      ) ?? ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
    indexSummaryUrl: resolveIssueReportManualSidecarUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
      ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
    ),
    indexSummaryJsonPath,
    indexSummaryJsonRelativePath:
      resolveIssueReportManualSidecarRelativePath(
        manifestAwareSummaryIndex.indexFile?.relativePath ?? null,
        ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
      ) ?? ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
    indexSummaryJsonUrl: resolveIssueReportManualSidecarUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
      ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
    ),
    indexSurfacePath,
    indexSurfaceRelativePath:
      resolveIssueReportManualSidecarRelativePath(
        manifestAwareSummaryIndex.indexFile?.relativePath ?? null,
        ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
      ) ?? ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
    indexSurfaceUrl: resolveIssueReportManualSidecarUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
      ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
    ),
    artifactIndexPath: indexPath,
    artifactIndexRelativePath:
      manifestAwareSummaryIndex.indexFile?.relativePath
      ?? toPortablePath(relative(dirname(indexPath), indexPath)),
    artifactIndexUrl: manifestAwareSummaryIndex.indexFile?.url ?? null,
    manifestPath,
    packetPaths: manifestAwareSummaryIndex.packetFiles.map((entry) => entry.path),
    csvPaths: manifestAwareSummaryIndex.csvExports.map((entry) => entry.path),
    storageFile: manifestAwareSummaryIndex.storageFile,
    totalCount: manifestAwareSummaryIndex.totalCount,
    filteredCount: manifestAwareSummaryIndex.filteredCount,
  }

  await writeIssueReportSummaryOutput(
    indexPath,
    `${JSON.stringify(manifestAwareSummaryIndex, null, 2)}\n`,
    cwd,
  )
  await writeIssueReportSummaryOutput(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    cwd,
  )
  await writeIssueReportSummaryOutput(indexSummaryPath, `${markdownSummary}\n`, cwd)
  await writeIssueReportSummaryOutput(
    indexSummaryJsonPath,
    `${JSON.stringify(summaryJson, null, 2)}\n`,
    cwd,
  )
  await writeIssueReportSummaryOutput(
    indexSurfacePath,
    `${JSON.stringify(surfaceSummary, null, 2)}\n`,
    cwd,
  )

  return {
    inputPath: loadedInput.resolvedInputPath,
    inputArtifactType: loadedInput.inputArtifactType,
    summaryPath: loadedInput.sourceSummaryPath ?? manifestAwareSummaryIndex.sourceSummaryPath,
    indexPath,
    manifestPath,
    manifestUrl: resolveIssueReportManualArtifactsManifestUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
    ),
    preferredPortableInputPath: manifestPath,
    preferredPortableInputUrl: resolveIssueReportManualArtifactsManifestUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
    ),
    indexSummaryPath,
    indexSummaryUrl: resolveIssueReportManualSidecarUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
      ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
    ),
    indexSummaryJsonPath,
    indexSummaryJsonUrl: resolveIssueReportManualSidecarUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
      ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
    ),
    indexSurfacePath,
    indexSurfaceUrl: resolveIssueReportManualSidecarUrl(
      manifestAwareSummaryIndex.indexFile?.url ?? null,
      ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
    ),
    csvRootPath: manifestAwareSummaryIndex.csvRootPath,
    csvRootUrl: buildRootCompatArtifactLinks({
      packetRootUrl: manifestAwareSummaryIndex.packetRootUrl,
      packetBaseUrl: manifestAwareSummaryIndex.packetBaseUrl,
      csvRootUrl: manifestAwareSummaryIndex.csvRootUrl,
      csvBaseUrl: manifestAwareSummaryIndex.csvBaseUrl,
    }).csvRootUrl,
    csvBaseUrl: manifestAwareSummaryIndex.csvBaseUrl,
    preferredCsvPath: manifestAwareSummaryIndex.preferredCsvFile?.path ?? null,
    preferredCsvRelativePath: manifestAwareSummaryIndex.preferredCsvFile?.relativePath ?? null,
    preferredCsvUrl: manifestAwareSummaryIndex.preferredCsvFile?.url ?? null,
    packetRootPath: manifestAwareSummaryIndex.packetRootPath,
    packetRootUrl: buildRootCompatArtifactLinks({
      packetRootUrl: manifestAwareSummaryIndex.packetRootUrl,
      packetBaseUrl: manifestAwareSummaryIndex.packetBaseUrl,
      csvRootUrl: manifestAwareSummaryIndex.csvRootUrl,
      csvBaseUrl: manifestAwareSummaryIndex.csvBaseUrl,
    }).packetRootUrl,
    packetBaseUrl: manifestAwareSummaryIndex.packetBaseUrl,
    packetArtifactUrl: buildRootCompatArtifactLinks({
      packetRootUrl: manifestAwareSummaryIndex.packetRootUrl,
      packetBaseUrl: manifestAwareSummaryIndex.packetBaseUrl,
      csvRootUrl: manifestAwareSummaryIndex.csvRootUrl,
      csvBaseUrl: manifestAwareSummaryIndex.csvBaseUrl,
    }).packetArtifactUrl,
    packetSummaryPath: manifestAwareSummaryIndex.packetSummaryFile?.path ?? null,
    packetSummaryRelativePath:
      manifestAwareSummaryIndex.packetSummaryFile?.relativePath ?? null,
    packetSummaryUrl: manifestAwareSummaryIndex.packetSummaryFile?.url ?? null,
    packetManifestPath: manifestAwareSummaryIndex.packetManifestFile?.path ?? null,
    packetManifestRelativePath:
      manifestAwareSummaryIndex.packetManifestFile?.relativePath ?? null,
    packetManifestUrl: manifestAwareSummaryIndex.packetManifestFile?.url ?? null,
  }
}

const run = async () => {
  const args = parseIssueReportSummaryArtifactsArgs(process.argv)
  const result = await buildIssueReportSummaryArtifacts(args)
  process.stdout.write(renderIssueReportSummaryArtifactsResult(result))
}

const entrypointPath = process.argv[1] ? fileURLToPath(import.meta.url) : null

if (entrypointPath && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
