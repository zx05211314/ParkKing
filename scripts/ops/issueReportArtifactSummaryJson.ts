import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseIssueReportArtifactSummaryJsonArgs } from './issueReportArtifactSummaryJsonArgs'
import {
  buildIssueReportArtifactIndex,
  loadIssueReportArtifactIndex,
  parseIssueReportArtifactIndex,
} from './issueReportArtifactIndex'
import {
  applyIssueReportManualManifestPreferredCsvToSummaryIndex,
  applyIssueReportManualManifestPreferredCsvToSummaryJson,
  applyIssueReportManualManifestPreferredCsvToSurfaceSummary,
} from './issueReportManualPreferredCsv'
import {
  buildIssueReportArtifactSummaryJsonOutput,
  parseIssueReportArtifactSummaryJsonOutput,
  parseIssueReportArtifactSummarySurfaceSummary,
} from './issueReportArtifactSummary'
import {
  ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
  ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
  resolveIssueReportManualArtifactsManifestPath,
  resolveIssueReportManualSidecarPath,
} from './issueReportArtifactSidecars'
import {
  resolveIssueReportArtifactBundleUrls,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import {
  loadIssueReportSummaryIndexFromSummary,
  parseIssueReportSummaryIndex,
  resolveIssueReportSummaryIndexOutPath,
} from './issueReportSummaryIndex'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'
import {
  isIssueReportSummaryArtifactsManifest,
  isIssueReportWorkflowArtifactsManifest,
  resolveIssueReportArtifactEntryPath,
  resolveIssueReportWorkflowArtifactEntryPath,
} from './issueReportWorkflowArtifactPaths'
import type {
  IssueReportArtifactIndexOutput,
  IssueReportArtifactSummaryJsonOutput,
  IssueReportArtifactSummaryInputArtifactType,
  IssueReportArtifactSummarySurfaceSummary,
  IssueReportSummaryArtifactsManifest,
  IssueReportSummaryIndexOutput,
} from './issueReportSummaryTypes'
import { ISSUE_REPORT_ARTIFACT_SUMMARY_SURFACE_SCHEMA_VERSION } from './issueReportSummaryTypes'

type IssueReportArtifactSummaryJsonSourceInput =
  | IssueReportArtifactIndexOutput
  | IssueReportSummaryIndexOutput
  | IssueReportArtifactSummaryJsonOutput

export interface LoadedIssueReportArtifactSummaryJsonOutput {
  summaryPath: string
  summary: IssueReportArtifactSummaryJsonOutput
}

export interface LoadedIssueReportArtifactSummarySurfaceInput {
  inputArtifactType: IssueReportArtifactSummaryInputArtifactType
  summary: LoadedIssueReportArtifactSummaryJsonOutput | null
  surface: IssueReportArtifactSummarySurfaceSummary | null
  surfacePath: string | null
}

const toLoadedIssueReportArtifactSummaryJsonOutput = (params: {
  summaryPath: string
  inputArtifactType: IssueReportArtifactSummaryInputArtifactType
  summary: IssueReportArtifactSummaryJsonSourceInput
}) => ({
  summaryPath: params.summaryPath,
  summary: buildIssueReportArtifactSummaryJsonOutput({
    index: params.summary,
    options: {
      inputArtifactType: params.inputArtifactType,
    },
  }),
})

const isPortableRelativePath = (value: string | null) =>
  value === null || (!value.includes(':') && !value.startsWith('/') && !value.startsWith('\\'))

const pickPreferredCsvExport = (summary: IssueReportArtifactSummaryJsonOutput) =>
  summary.csvExports.find((entry) => entry.relativePath === 'publish-gate-districts.csv')
  ?? summary.csvExports.find((entry) => entry.relativePath === 'top-segments.csv')
  ?? summary.csvExports[0]
  ?? null

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

export const loadIssueReportArtifactSummaryJsonOutput = async (
  summaryPath: string,
  cwd = process.cwd(),
): Promise<LoadedIssueReportArtifactSummaryJsonOutput> => {
  const resolvedPath = resolve(cwd, summaryPath)
  return {
    summaryPath: resolvedPath,
    summary: parseIssueReportArtifactSummaryJsonOutput(
      JSON.parse(await readFile(resolvedPath, 'utf8')),
    ),
  }
}

export const loadIssueReportArtifactSummarySurfaceInput = async (
  inputPath: string,
  cwd = process.cwd(),
): Promise<LoadedIssueReportArtifactSummarySurfaceInput> => {
  const resolvedPath = resolve(cwd, inputPath)
  const parsed = JSON.parse(await readFile(resolvedPath, 'utf8')) as { artifactType?: string }

  if (parsed.artifactType === 'issue-report-artifact-summary-json') {
    return {
      inputArtifactType: 'issue-report-artifact-summary-json',
      summary: {
        summaryPath: resolvedPath,
        summary: parseIssueReportArtifactSummaryJsonOutput(parsed),
      },
      surface: null,
      surfacePath: null,
    }
  }

  if (parsed.artifactType === 'issue-report-artifact-summary-surface') {
    return {
      inputArtifactType: 'issue-report-artifact-summary-surface',
      summary: null,
      surface: parseIssueReportArtifactSummarySurfaceSummary(parsed),
      surfacePath: resolvedPath,
    }
  }

  if (parsed.artifactType === 'issue-report-artifact-index') {
    const index = parseIssueReportArtifactIndex(parsed)
    const summaryPath = resolveIssueReportWorkflowArtifactEntryPath(
      resolvedPath,
      index.rootManifest.indexSummaryJsonRelativePath,
      index.rootManifest.indexSummaryJsonPath,
    )
    if (await pathExists(summaryPath)) {
      return {
        inputArtifactType: 'issue-report-artifact-index',
        summary: await loadIssueReportArtifactSummaryJsonOutput(summaryPath!),
        surface: null,
        surfacePath: null,
      }
    }
    const surfacePath = resolveIssueReportWorkflowArtifactEntryPath(
      resolvedPath,
      index.rootManifest.indexSurfaceRelativePath,
      index.rootManifest.indexSurfacePath,
    )
    if (await pathExists(surfacePath)) {
      return {
        inputArtifactType: 'issue-report-artifact-index',
        summary: null,
        surface: parseIssueReportArtifactSummarySurfaceSummary(
          JSON.parse(await readFile(surfacePath!, 'utf8')),
        ),
        surfacePath: surfacePath!,
      }
    }
    return {
      inputArtifactType: 'issue-report-artifact-index',
      summary: toLoadedIssueReportArtifactSummaryJsonOutput({
        summaryPath: summaryPath ?? resolvedPath,
        inputArtifactType: 'issue-report-artifact-index',
        summary: index,
      }),
      surface: null,
      surfacePath: null,
    }
  }

  if (isIssueReportSummaryArtifactsManifest(parsed)) {
    const artifactIndexPath = resolveIssueReportArtifactEntryPath(
      resolvedPath,
      parsed.artifactIndexRelativePath,
      parsed.artifactIndexPath,
    )
    if (await pathExists(artifactIndexPath)) {
      const loaded = await loadIssueReportArtifactSummarySurfaceInput(artifactIndexPath!, cwd)
      return {
        ...loaded,
        inputArtifactType: 'issue-report-summary-artifacts',
      }
    }

    const sourceSummaryPath = resolveIssueReportArtifactEntryPath(
      resolvedPath,
      parsed.sourceSummaryRelativePath,
      parsed.sourceSummaryPath,
    )
    if (await pathExists(sourceSummaryPath)) {
      const loaded = await loadIssueReportArtifactSummarySurfaceInput(sourceSummaryPath!, cwd)
      return {
        ...loaded,
        inputArtifactType: 'issue-report-summary-artifacts',
      }
    }

    const summaryPath = resolveIssueReportArtifactEntryPath(
      resolvedPath,
      parsed.indexSummaryJsonRelativePath,
      parsed.indexSummaryJsonPath,
    )
    if (await pathExists(summaryPath)) {
      return {
        inputArtifactType: 'issue-report-summary-artifacts',
        summary: {
          summaryPath: summaryPath!,
          summary: applyIssueReportManualManifestPreferredCsvToSummaryJson(
            (await loadIssueReportArtifactSummaryJsonOutput(summaryPath!)).summary,
            parsed,
          ),
        },
        surface: null,
        surfacePath: null,
      }
    }

    const surfacePath = resolveIssueReportArtifactEntryPath(
      resolvedPath,
      parsed.indexSurfaceRelativePath,
      parsed.indexSurfacePath,
    )
    if (await pathExists(surfacePath)) {
      return {
        inputArtifactType: 'issue-report-summary-artifacts',
        summary: null,
        surface: applyIssueReportManualManifestPreferredCsvToSurfaceSummary(
          parseIssueReportArtifactSummarySurfaceSummary(
            JSON.parse(await readFile(surfacePath!, 'utf8')),
          ),
          parsed,
        ),
        surfacePath: surfacePath!,
      }
    }

    throw new Error(
      'artifact summary input must include a canonical manual summary surface, summary json, full index, or source summary',
    )
  }

  if (
    parsed.artifactType === 'issue-report-summary-index' ||
    parsed.artifactType === 'issue-report-summary-json'
  ) {
    const summaryIndex =
      parsed.artifactType === 'issue-report-summary-index'
        ? parseIssueReportSummaryIndex(parsed)
        : await loadIssueReportSummaryIndexFromSummary(
            inputPath,
            {
              indexPath: resolveIssueReportSummaryIndexOutPath(
                {
                  summaryPath: resolvedPath,
                  outPath: null,
                  json: true,
                  writeIndex: true,
                },
                cwd,
              ),
            },
            cwd,
          )
    const inputArtifactType =
      parsed.artifactType === 'issue-report-summary-index'
        ? 'issue-report-summary-index'
        : 'issue-report-summary-json'
    const summaryIndexPath = summaryIndex.indexFile?.path ?? null
    const manualManifestPath =
      summaryIndex.manualManifestFile?.path
      ?? resolveIssueReportManualArtifactsManifestPath(summaryIndexPath)
    let parsedManualManifest: IssueReportSummaryArtifactsManifest | null = null
    if (await pathExists(manualManifestPath)) {
      const parsedManifest = JSON.parse(await readFile(manualManifestPath!, 'utf8')) as {
        artifactType?: string
      }
      if (isIssueReportSummaryArtifactsManifest(parsedManifest)) {
        parsedManualManifest = parsedManifest
        const summaryPathFromManifest = resolveIssueReportArtifactEntryPath(
          manualManifestPath!,
          parsedManifest.indexSummaryJsonRelativePath,
          parsedManifest.indexSummaryJsonPath,
        )
        if (await pathExists(summaryPathFromManifest)) {
          return {
            inputArtifactType,
            summary: {
              summaryPath: summaryPathFromManifest!,
              summary: applyIssueReportManualManifestPreferredCsvToSummaryJson(
                (await loadIssueReportArtifactSummaryJsonOutput(summaryPathFromManifest!)).summary,
                parsedManifest,
              ),
            },
            surface: null,
            surfacePath: null,
          }
        }

        const surfacePathFromManifest = resolveIssueReportArtifactEntryPath(
          manualManifestPath!,
          parsedManifest.indexSurfaceRelativePath,
          parsedManifest.indexSurfacePath,
        )
        if (await pathExists(surfacePathFromManifest)) {
          return {
            inputArtifactType,
            summary: null,
            surface: applyIssueReportManualManifestPreferredCsvToSurfaceSummary(
              parseIssueReportArtifactSummarySurfaceSummary(
                JSON.parse(await readFile(surfacePathFromManifest!, 'utf8')),
              ),
              parsedManifest,
            ),
            surfacePath: surfacePathFromManifest!,
          }
        }
      }
    }

    const summaryJsonPath = resolveIssueReportManualSidecarPath(
      summaryIndexPath,
      ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
    )
    if (await pathExists(summaryJsonPath)) {
      return {
        inputArtifactType,
        summary: parsedManualManifest
          ? {
              summaryPath: summaryJsonPath!,
              summary: applyIssueReportManualManifestPreferredCsvToSummaryJson(
                (await loadIssueReportArtifactSummaryJsonOutput(summaryJsonPath!)).summary,
                parsedManualManifest,
              ),
            }
          : await loadIssueReportArtifactSummaryJsonOutput(summaryJsonPath!),
        surface: null,
        surfacePath: null,
      }
    }
    const surfacePath = resolveIssueReportManualSidecarPath(
      summaryIndexPath,
      ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
    )
    if (await pathExists(surfacePath)) {
      return {
        inputArtifactType,
        summary: null,
        surface: parsedManualManifest
          ? applyIssueReportManualManifestPreferredCsvToSurfaceSummary(
              parseIssueReportArtifactSummarySurfaceSummary(
                JSON.parse(await readFile(surfacePath!, 'utf8')),
              ),
              parsedManualManifest,
            )
          : parseIssueReportArtifactSummarySurfaceSummary(
              JSON.parse(await readFile(surfacePath!, 'utf8')),
            ),
        surfacePath: surfacePath!,
      }
    }
    return {
      inputArtifactType,
      summary: {
        summaryPath: summaryJsonPath ?? resolvedPath,
        summary: buildIssueReportArtifactSummaryJsonOutput({
          index: parsedManualManifest
            ? applyIssueReportManualManifestPreferredCsvToSummaryIndex(
                summaryIndex,
                parsedManualManifest,
              )
            : summaryIndex,
          options: {
            inputArtifactType,
          },
        }),
      },
      surface: null,
      surfacePath: null,
    }
  }

  if (isIssueReportWorkflowArtifactsManifest(parsed)) {
    const summaryPath = resolveIssueReportWorkflowArtifactEntryPath(
      resolvedPath,
      parsed.indexSummaryJsonRelativePath,
      parsed.indexSummaryJsonPath,
    )
    if (await pathExists(summaryPath)) {
      return {
        inputArtifactType: 'issue-report-workflow-artifacts',
        summary: await loadIssueReportArtifactSummaryJsonOutput(summaryPath!),
        surface: null,
        surfacePath: null,
      }
    }
    const surfacePath = resolveIssueReportWorkflowArtifactEntryPath(
      resolvedPath,
      parsed.indexSurfaceRelativePath,
      parsed.indexSurfacePath,
    )
    if (await pathExists(surfacePath)) {
      return {
        inputArtifactType: 'issue-report-workflow-artifacts',
        summary: null,
        surface: parseIssueReportArtifactSummarySurfaceSummary(
          JSON.parse(await readFile(surfacePath!, 'utf8')),
        ),
        surfacePath: surfacePath!,
      }
    }
    const artifactIndexPath = resolveIssueReportWorkflowArtifactEntryPath(
      resolvedPath,
      parsed.artifactIndexRelativePath,
      parsed.artifactIndexPath,
    )
    const index =
      artifactIndexPath && (await pathExists(artifactIndexPath))
        ? await loadIssueReportArtifactIndex(artifactIndexPath)
        : await buildIssueReportArtifactIndex(resolvedPath)
    const resolvedSummaryPath =
      resolveIssueReportWorkflowArtifactEntryPath(
        resolvedPath,
        index.rootManifest.indexSummaryJsonRelativePath,
        index.rootManifest.indexSummaryJsonPath,
      ) ?? resolvedPath
    return {
      inputArtifactType: 'issue-report-workflow-artifacts',
      summary: toLoadedIssueReportArtifactSummaryJsonOutput({
        summaryPath: resolvedSummaryPath,
        inputArtifactType: 'issue-report-workflow-artifacts',
        summary: index,
      }),
      surface: null,
      surfacePath: null,
    }
  }

  throw new Error(
    'artifact summary input must be issue-report-workflow-artifacts, issue-report-summary-artifacts, issue-report-artifact-index, issue-report-artifact-summary-json, or issue-report-artifact-summary-surface',
  )
}

export const buildIssueReportArtifactSummaryJsonSurfaceSummary = (
  loaded: LoadedIssueReportArtifactSummaryJsonOutput,
): IssueReportArtifactSummarySurfaceSummary => {
  const summaryEntries = loaded.summary.summaryEntries
  const bundleRoot = dirname(loaded.summaryPath)
  const relativeEntries = [
    summaryEntries.workflowSummaryRelativePath,
    summaryEntries.indexSummaryRelativePath,
    summaryEntries.indexSummaryJsonRelativePath,
    summaryEntries.indexSurfaceRelativePath,
    summaryEntries.artifactIndexRelativePath,
    summaryEntries.manualManifestRelativePath,
    summaryEntries.sourceSummaryRelativePath,
    summaryEntries.rawIssuesRelativePath,
    summaryEntries.preferredCsvRelativePath,
    summaryEntries.packetSummaryRelativePath,
    summaryEntries.packetManifestRelativePath,
  ]
  const invalidRelativePath = relativeEntries.find((entry) => !isPortableRelativePath(entry))
  if (invalidRelativePath) {
    throw new Error('artifact summary json relative paths must be portable bundle paths')
  }
  const {
    packetRootUrl,
    csvRootUrl,
    packetBaseUrl,
    csvBaseUrl,
    packetArtifactUrl,
    csvArtifactUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl: loaded.summary.artifactLinks.packetRootUrl,
    packetLegacyBaseUrl: loaded.summary.artifactLinks.packetBaseUrl,
    packetLegacyArtifactUrl: loaded.summary.artifactLinks.packetArtifactUrl,
    csvRootUrl: loaded.summary.artifactLinks.csvRootUrl,
    csvLegacyBaseUrl: loaded.summary.artifactLinks.csvBaseUrl,
    csvLegacyArtifactUrl: loaded.summary.artifactLinks.csvArtifactUrl,
  })
  const {
    preferredCsvUrl,
    packetSummaryUrl,
    packetManifestUrl,
  } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl,
    csvRootUrl,
    preferredCsvUrl: loaded.summary.artifactLinks.preferredCsvUrl,
    preferredCsvRelativePath:
      loaded.summary.summaryEntries.preferredCsvRelativePath
      ?? pickPreferredCsvExport(loaded.summary)?.relativePath
      ?? null,
    packetSummaryUrl: loaded.summary.artifactLinks.packetSummaryUrl,
    packetSummaryRelativePath: summaryEntries.packetSummaryRelativePath,
    packetManifestUrl: loaded.summary.artifactLinks.packetManifestUrl,
    packetManifestRelativePath: summaryEntries.packetManifestRelativePath,
  })

  return {
    artifactType: 'issue-report-artifact-summary-surface',
    schemaVersion: ISSUE_REPORT_ARTIFACT_SUMMARY_SURFACE_SCHEMA_VERSION,
    summaryPath: loaded.summaryPath,
    sourceArtifactType: loaded.summary.artifactType,
    sourceSchemaVersion: loaded.summary.schemaVersion,
    label: loaded.summary.label,
    inputArtifactType: loaded.summary.inputArtifactType,
    resolvedIndexArtifactType: loaded.summary.resolvedIndexArtifactType,
    resolvedIndexSchemaVersion: loaded.summary.resolvedIndexSchemaVersion,
    topCount: loaded.summary.topCount,
    filteredCount: loaded.summary.matchingIssueReports.filteredCount,
    totalCount: loaded.summary.matchingIssueReports.totalCount,
    linkedPublishGateHotspotCount: loaded.summary.linkedPublishGateHotspots.linkedCount,
    totalPublishGateHotspotCount: loaded.summary.linkedPublishGateHotspots.totalCount,
    segmentPacketCount: loaded.summary.packetEntries.segmentCount,
    reasonPacketCount: loaded.summary.packetEntries.reasonCount,
    csvCount: loaded.summary.csvExports.length,
    publishGateSummary: loaded.summary.publishGateSummary
      ? {
          mode: loaded.summary.publishGateSummary.mode,
          exitCode: loaded.summary.publishGateSummary.exitCode,
          info: loaded.summary.publishGateSummary.totals.info,
          warn: loaded.summary.publishGateSummary.totals.warn,
          fail: loaded.summary.publishGateSummary.totals.fail,
        }
      : null,
    topPublishGateHotspots: loaded.summary.publishGateHotspots
      .slice(0, loaded.summary.topCount)
      .map((hotspot) => ({
        districtId: hotspot.districtId,
        warn: hotspot.warn,
        fail: hotspot.fail,
        directOverrideMatches: hotspot.directOverrideMatches,
        spatialOverrideMatches: hotspot.spatialOverrideMatches,
        unmatchedNamedOverrides: hotspot.unmatchedNamedOverrides,
        issueHotspotSegmentLabel: hotspot.issueHotspotSegmentLabel,
        issueHotspotPacketPath: hotspot.issueHotspotPacketPath,
        issueHotspotPacketUrl: hotspot.issueHotspotPacketUrl,
      })),
    topDistricts: loaded.summary.topDistricts
      .slice(0, loaded.summary.topCount)
      .map((district) => ({
        scope: district.scope,
        districtId: district.districtId,
        count: district.count,
        latestCreatedAt: district.latestCreatedAt,
        latestSummary: district.latestSummary,
      })),
    topSegments: loaded.summary.topSegments
      .slice(0, loaded.summary.topCount)
      .map((segment) => ({
        scope: segment.scope,
        districtId: segment.districtId,
        segmentId: segment.segmentId,
        segmentName: segment.segmentName,
        segmentLabel: segment.segmentLabel,
        count: segment.count,
        segmentTier: segment.segmentTier,
        latestCreatedAt: segment.latestCreatedAt,
        latestSummary: segment.latestSummary,
        packetPath: segment.packetPath,
        packetUrl: segment.packetUrl,
      })),
    topReasons: loaded.summary.topReasons
      .slice(0, loaded.summary.topCount)
      .map((reason) => ({
        reasonCode: reason.reasonCode,
        count: reason.count,
        districtCount: reason.districtCount,
        segmentCount: reason.segmentCount,
        latestCreatedAt: reason.latestCreatedAt,
        latestDistrictId: reason.latestDistrictId,
        latestSegmentId: reason.latestSegmentId,
        latestSegmentName: reason.latestSegmentName,
        packetPath: reason.packetPath,
        packetUrl: reason.packetUrl,
      })),
    packetRootPath: summaryEntries.packetRootRelativePath
      ? resolve(bundleRoot, summaryEntries.packetRootRelativePath)
      : null,
    packetRootRelativePath: summaryEntries.packetRootRelativePath,
    packetRootUrl,
    packetBaseUrl,
    csvRootPath: summaryEntries.csvRootRelativePath
      ? resolve(bundleRoot, summaryEntries.csvRootRelativePath)
      : null,
    csvRootRelativePath: summaryEntries.csvRootRelativePath,
    csvRootUrl,
    csvBaseUrl,
    workflowSummaryRelativePath: summaryEntries.workflowSummaryRelativePath,
    workflowSummaryUrl: loaded.summary.artifactLinks.summaryUrl ?? null,
    indexSummaryRelativePath: summaryEntries.indexSummaryRelativePath,
    indexSummaryUrl: loaded.summary.artifactLinks.indexSummaryUrl ?? null,
    indexSummaryJsonRelativePath: summaryEntries.indexSummaryJsonRelativePath,
    indexSummaryJsonUrl: loaded.summary.artifactLinks.indexSummaryJsonUrl ?? null,
    indexSurfaceRelativePath: summaryEntries.indexSurfaceRelativePath,
    indexSurfaceUrl: loaded.summary.artifactLinks.indexSurfaceUrl ?? null,
    artifactIndexRelativePath: summaryEntries.artifactIndexRelativePath,
    artifactIndexUrl: loaded.summary.artifactLinks.artifactIndexUrl ?? null,
    manualManifestRelativePath: summaryEntries.manualManifestRelativePath,
    manualManifestUrl: loaded.summary.artifactLinks.manualManifestUrl ?? null,
    sourceSummaryRelativePath: summaryEntries.sourceSummaryRelativePath,
    sourceSummaryUrl: loaded.summary.artifactLinks.sourceSummaryUrl ?? null,
    rawIssuesRelativePath: summaryEntries.rawIssuesRelativePath,
    rawIssuesUrl: loaded.summary.artifactLinks.rawIssuesUrl ?? null,
    preferredCsvRelativePath:
      loaded.summary.summaryEntries.preferredCsvRelativePath
      ?? pickPreferredCsvExport(loaded.summary)?.relativePath
      ?? null,
    preferredCsvUrl,
    packetSummaryRelativePath: summaryEntries.packetSummaryRelativePath,
    packetManifestRelativePath: summaryEntries.packetManifestRelativePath,
    packetSummaryUrl,
    packetManifestUrl,
    packetArtifactUrl,
    csvArtifactUrl,
  }
}

export const renderIssueReportArtifactSummaryJsonSurfaceSummary = (
  summary: IssueReportArtifactSummarySurfaceSummary,
) => {
  const {
    packetRootUrl,
    csvRootUrl,
    packetBaseUrl: legacyPacketBaseUrl,
    csvBaseUrl: legacyCsvBaseUrl,
    packetArtifactUrl: legacyPacketArtifactUrl,
    csvArtifactUrl: legacyCsvArtifactUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl: summary.packetRootUrl,
    packetLegacyBaseUrl: summary.packetBaseUrl,
    packetLegacyArtifactUrl: summary.packetArtifactUrl,
    csvRootUrl: summary.csvRootUrl,
    csvLegacyBaseUrl: summary.csvBaseUrl,
    csvLegacyArtifactUrl: summary.csvArtifactUrl,
  })

  return [
    `Valid ${summary.sourceArtifactType} v${summary.sourceSchemaVersion}`,
    `Summary: ${summary.summaryPath}`,
    ...(summary.label ? [`Label: ${summary.label}`] : []),
    `Input surface: ${summary.inputArtifactType}`,
    `Resolved index surface: ${summary.resolvedIndexArtifactType} v${summary.resolvedIndexSchemaVersion}`,
    `Top count: ${summary.topCount}`,
    `Matching issue reports: ${summary.filteredCount} / ${summary.totalCount}`,
    `Linked publish gate hotspots: ${summary.linkedPublishGateHotspotCount} / ${summary.totalPublishGateHotspotCount}`,
    `Packet entries: ${summary.segmentPacketCount} segments / ${summary.reasonPacketCount} reasons`,
    `CSV exports: ${summary.csvCount}`,
    ...(summary.publishGateSummary
      ? [
          `Publish gate: ${summary.publishGateSummary.mode} exit ${summary.publishGateSummary.exitCode} (INFO ${summary.publishGateSummary.info} / WARN ${summary.publishGateSummary.warn} / FAIL ${summary.publishGateSummary.fail})`,
        ]
      : []),
    ...summary.topPublishGateHotspots.map(
      (hotspot) =>
        `Top publish gate hotspot: ${hotspot.districtId} WARN ${hotspot.warn} FAIL ${hotspot.fail} ${hotspot.issueHotspotSegmentLabel ?? '-'}`,
    ),
    ...summary.topDistricts.map(
      (district) =>
        `Top district: ${district.scope}/${district.districtId} x${district.count}`,
    ),
    ...summary.topSegments.map(
      (segment) =>
        `Top segment: ${segment.scope}/${segment.districtId} ${segment.segmentLabel} x${segment.count}`,
    ),
    ...summary.topReasons.map(
      (reason) => `Top reason: ${reason.reasonCode} x${reason.count}`,
    ),
    ...(summary.packetRootPath ? [`Packet root: ${summary.packetRootPath}`] : []),
    ...(summary.packetRootRelativePath
      ? [`Packet root entry: ${summary.packetRootRelativePath}`]
      : []),
    ...(packetRootUrl
      ? [`Packet root URL: ${packetRootUrl}`]
      : []),
    ...(legacyPacketBaseUrl
      ? [`Legacy packet base URL: ${legacyPacketBaseUrl}`]
      : []),
    ...(summary.csvRootPath ? [`CSV exchange root: ${summary.csvRootPath}`] : []),
    ...(summary.csvRootRelativePath
      ? [`CSV root entry: ${summary.csvRootRelativePath}`]
      : []),
    ...(csvRootUrl
      ? [`CSV exchange root URL: ${csvRootUrl}`]
      : []),
    ...(legacyCsvBaseUrl
      ? [`Legacy CSV base URL: ${legacyCsvBaseUrl}`]
      : []),
    ...(summary.workflowSummaryRelativePath
      ? [`Workflow summary entry: ${summary.workflowSummaryRelativePath}`]
      : []),
    ...(summary.workflowSummaryUrl
      ? [`Workflow summary URL: ${summary.workflowSummaryUrl}`]
      : []),
    ...(summary.indexSummaryRelativePath
      ? [`Index summary entry: ${summary.indexSummaryRelativePath}`]
      : []),
    ...(summary.indexSummaryUrl
      ? [`Index summary URL: ${summary.indexSummaryUrl}`]
      : []),
    ...(summary.indexSummaryJsonRelativePath
      ? [`Index summary json entry: ${summary.indexSummaryJsonRelativePath}`]
      : []),
    ...(summary.indexSummaryJsonUrl
      ? [`Index summary json URL: ${summary.indexSummaryJsonUrl}`]
      : []),
    ...(summary.indexSurfaceRelativePath
      ? [`Index surface entry: ${summary.indexSurfaceRelativePath}`]
      : []),
    ...(summary.indexSurfaceUrl
      ? [`Index surface URL: ${summary.indexSurfaceUrl}`]
      : []),
    ...(summary.artifactIndexRelativePath
      ? [`Artifact index entry: ${summary.artifactIndexRelativePath}`]
      : []),
    ...(summary.artifactIndexUrl
      ? [`Artifact index URL: ${summary.artifactIndexUrl}`]
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
    ...(summary.sourceSummaryRelativePath
      ? [`Source summary entry: ${summary.sourceSummaryRelativePath}`]
      : []),
    ...(summary.sourceSummaryUrl
      ? [`Source summary URL: ${summary.sourceSummaryUrl}`]
      : []),
    ...(summary.rawIssuesRelativePath
      ? [`Raw issues entry: ${summary.rawIssuesRelativePath}`]
      : []),
    ...(summary.rawIssuesUrl ? [`Raw issues URL: ${summary.rawIssuesUrl}`] : []),
    ...(summary.preferredCsvRelativePath
      ? [`Preferred CSV join file: ${summary.preferredCsvRelativePath}`]
      : []),
    ...(summary.preferredCsvUrl
      ? [`Preferred CSV join file URL: ${summary.preferredCsvUrl}`]
      : []),
    ...(summary.packetSummaryRelativePath
      ? [`Packet summary entry: ${summary.packetSummaryRelativePath}`]
      : []),
    ...(summary.packetManifestRelativePath
      ? [`Packet manifest entry: ${summary.packetManifestRelativePath}`]
      : []),
    ...(summary.packetSummaryUrl
      ? [`Packet summary URL: ${summary.packetSummaryUrl}`]
      : []),
    ...(summary.packetManifestUrl
      ? [`Packet manifest URL: ${summary.packetManifestUrl}`]
      : []),
    ...(legacyPacketArtifactUrl
      ? [`Legacy packet artifact URL: ${legacyPacketArtifactUrl}`]
      : []),
    ...(legacyCsvArtifactUrl
      ? [`Legacy CSV artifact URL: ${legacyCsvArtifactUrl}`]
      : []),
  ].join('\n')
}

export const renderIssueReportArtifactSummaryJsonSurfaceWriteResult = (
  outPath: string,
  summary: IssueReportArtifactSummarySurfaceSummary,
) => [
  `Wrote issue report artifact summary surface to ${outPath}`,
  '',
  renderIssueReportArtifactSummaryJsonSurfaceSummary(summary),
].join('\n')

export const resolveIssueReportArtifactSummarySurfaceOutPath = (
  loaded: LoadedIssueReportArtifactSummarySurfaceInput,
  options: { outPath: string | null; writeIndexSurface: boolean },
) => {
  if (options.outPath) {
    return options.outPath
  }
  if (!options.writeIndexSurface) {
    return null
  }
  if (loaded.surfacePath) {
    return loaded.surfacePath
  }
  const relativePath = loaded.summary?.summary.summaryEntries.indexSurfaceRelativePath
  if (relativePath) {
    return resolve(dirname(loaded.summary!.summaryPath), relativePath)
  }
  throw new Error(
    'writeIndexSurface requires an artifact summary input with a canonical indexSurfaceRelativePath',
  )
}

const run = async () => {
  const args = parseIssueReportArtifactSummaryJsonArgs(process.argv)
  const loaded = await loadIssueReportArtifactSummarySurfaceInput(args.inputPath)
  const summary =
    loaded.surface
      ?? buildIssueReportArtifactSummaryJsonSurfaceSummary(loaded.summary!)
  const content = args.json
    ? JSON.stringify(summary, null, 2)
    : renderIssueReportArtifactSummaryJsonSurfaceSummary(summary)
  const outPath = resolveIssueReportArtifactSummarySurfaceOutPath(loaded, {
    outPath: args.outPath,
    writeIndexSurface: args.writeIndexSurface,
  })
  if (outPath) {
    const resolvedOutPath = await writeIssueReportSummaryOutput(outPath, `${content}\n`)
    console.log(
      renderIssueReportArtifactSummaryJsonSurfaceWriteResult(
        resolvedOutPath,
        summary,
      ),
    )
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
