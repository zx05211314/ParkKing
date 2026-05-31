import { access, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import {
  loadIssueReportArtifactIndex,
  resolveIssueReportArtifactIndexPreferredCsvFile,
} from './issueReportArtifactIndex'
import {
  loadIssueReportArtifactSummaryInputDetails,
  parseIssueReportArtifactSummaryJsonOutput,
  parseIssueReportArtifactSummarySurfaceSummary,
} from './issueReportArtifactSummary'
import {
  buildIssueReportArtifactSummaryJsonSurfaceSummary,
  loadIssueReportArtifactSummarySurfaceInput,
} from './issueReportArtifactSummaryJson'
import {
  isIssueReportSummaryArtifactsManifest,
  isIssueReportWorkflowArtifactsManifest,
  resolveIssueReportArtifactEntryPath,
  resolveIssueReportWorkflowArtifactEntryPath,
} from './issueReportWorkflowArtifactPaths'
import {
  resolveIssueReportArtifactBundleUrls,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import {
  writeIssueReportSummaryCsvFiles,
} from './issueReportSummaryCsvFiles'
import { writeIssueReportTriagePacketBundle } from './issueReportSummaryPacketFiles'
import { buildIssueReportTriagePacketBundle } from './issueReportSummaryPackets'
import { loadIssueReportSummary } from './issueReportSummaryState'
import type { IssueReportArtifactSummarySurfaceSummary } from './issueReportSummaryTypes'
import type {
  NotifyNightlyArgs,
  NightlyIssueArtifactOutputs,
  NightlyIssueReasonHotspot,
  NightlyIssueReportSummary,
  NightlyIssueSegmentHotspot,
} from './notifyNightlyTypes'

export interface NightlyIssueArtifactResult {
  summaries: NightlyIssueReportSummary[]
  topSegments: NightlyIssueSegmentHotspot[]
  topReasons: NightlyIssueReasonHotspot[]
  artifacts: NightlyIssueArtifactOutputs
}

const toNightlyIssueSummaries = (
  summaries: Awaited<ReturnType<typeof loadIssueReportSummary>>['summaries'],
): NightlyIssueReportSummary[] => summaries

const toNightlyIssueSegments = (
  segments: Awaited<ReturnType<typeof loadIssueReportSummary>>['topSegments'],
): NightlyIssueSegmentHotspot[] => segments

const toNightlyIssueReasons = (
  reasons: Awaited<ReturnType<typeof loadIssueReportSummary>>['topReasons'],
): NightlyIssueReasonHotspot[] => reasons

const toNightlyIssueSegmentsFromPackets = (
  segments: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>['topSegments'],
): NightlyIssueSegmentHotspot[] =>
  segments.map((segment) => ({
    scope: segment.scope,
    districtId: segment.districtId,
    segmentId: segment.segmentId,
    segmentName: segment.segmentName,
    segmentTier: segment.segmentTier,
    count: segment.count,
    latestCreatedAt: segment.latestCreatedAt,
    latestSummary: segment.latestSummary,
  }))

const toNightlyIssueReasonsFromPackets = (
  reasons: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>['topReasons'],
): NightlyIssueReasonHotspot[] =>
  reasons.map((reason) => ({
    reasonCode: reason.reasonCode,
    count: reason.count,
    districtCount: reason.districtCount,
    segmentCount: reason.segmentCount,
    latestCreatedAt: reason.latestCreatedAt,
    latestDistrictId: reason.latestDistrictId,
    latestSegmentId: reason.latestSegmentId,
      latestSegmentName: reason.latestSegmentName,
    }))

const toNightlyIssueSummariesFromSurface = (
  summaries: IssueReportArtifactSummarySurfaceSummary['topDistricts'],
): NightlyIssueReportSummary[] =>
  summaries.map((summary) => ({
    scope: summary.scope,
    districtId: summary.districtId,
    count: summary.count,
    latestCreatedAt: summary.latestCreatedAt,
    latestSummary: summary.latestSummary,
  }))

const toNightlyIssueSegmentsFromSurface = (
  segments: IssueReportArtifactSummarySurfaceSummary['topSegments'],
): NightlyIssueSegmentHotspot[] =>
  segments.map((segment) => ({
    scope: segment.scope,
    districtId: segment.districtId,
    segmentId: segment.segmentId ?? segment.segmentLabel,
    segmentName: segment.segmentName,
    segmentTier: segment.segmentTier,
    count: segment.count,
    latestCreatedAt: segment.latestCreatedAt,
    latestSummary: segment.latestSummary,
  }))

const toNightlyIssueReasonsFromSurface = (
  reasons: IssueReportArtifactSummarySurfaceSummary['topReasons'],
): NightlyIssueReasonHotspot[] =>
  reasons.map((reason) => ({
    reasonCode: reason.reasonCode,
    count: reason.count,
    districtCount: reason.districtCount,
    segmentCount: reason.segmentCount,
    latestCreatedAt: reason.latestCreatedAt,
    latestDistrictId: reason.latestDistrictId,
    latestSegmentId: reason.latestSegmentId,
    latestSegmentName: reason.latestSegmentName,
  }))

const resolvePortablePath = (baseDir: string, relativePath: string | null) =>
  relativePath ? resolve(baseDir, relativePath) : null

const resolveNightlyArtifactIndexRootManifestLinks = (
  index: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>,
) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: index.rootManifest.packetRootUrl,
    packetLegacyArtifactUrl: index.rootManifest.packetArtifactUrl,
    csvRootUrl: index.rootManifest.csvRootUrl,
    csvLegacyArtifactUrl: index.rootManifest.csvArtifactUrl,
  })

const resolveNightlyArtifactIndexPacketManifestLinks = (
  index: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>,
) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: index.packetManifest.packetRootUrl,
    packetLegacyBaseUrl: index.packetManifest.packetBaseUrl,
    csvRootUrl: index.packetManifest.csvRootUrl,
    csvLegacyBaseUrl: index.packetManifest.csvBaseUrl,
  })

const resolveNightlyArtifactIndexPacketRootUrl = (
  index: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>,
) =>
  resolveNightlyArtifactIndexRootManifestLinks(index).packetRootUrl
  ?? resolveNightlyArtifactIndexPacketManifestLinks(index).packetRootUrl

const resolveNightlyArtifactIndexCsvRootUrl = (
  index: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>,
) =>
  resolveNightlyArtifactIndexRootManifestLinks(index).csvRootUrl
  ?? resolveNightlyArtifactIndexPacketManifestLinks(index).csvRootUrl

const resolveNightlyArtifactIndexPacketSummaryRelativePath = (
  index: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>,
) =>
  index.rootManifest.packetSummaryRelativePath
  ?? index.packetManifest.summaryRelativePath

const resolveNightlyArtifactIndexPacketManifestRelativePath = (
  index: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>,
) =>
  index.rootManifest.packetManifestRelativePath
  ?? 'manifest.json'

const resolveNightlyArtifactIndexBundleUrls = (
  index: Awaited<ReturnType<typeof loadIssueReportArtifactIndex>>,
) => {
  const preferredCsvFile = resolveIssueReportArtifactIndexPreferredCsvFile(index)
  return resolveIssueReportArtifactBundleUrls({
    packetRootUrl: resolveNightlyArtifactIndexPacketRootUrl(index),
    csvRootUrl: resolveNightlyArtifactIndexCsvRootUrl(index),
    preferredCsvUrl:
      index.rootManifest.preferredCsvUrl
      ?? preferredCsvFile?.url
      ?? null,
    preferredCsvRelativePath:
      index.rootManifest.preferredCsvRelativePath
      ?? preferredCsvFile?.relativePath
      ?? null,
    packetSummaryUrl:
      index.rootManifest.packetSummaryUrl
      ?? index.packetManifest.summaryUrl
      ?? null,
    packetSummaryRelativePath:
      resolveNightlyArtifactIndexPacketSummaryRelativePath(index),
    packetManifestUrl: index.rootManifest.packetManifestUrl,
    packetManifestRelativePath:
      resolveNightlyArtifactIndexPacketManifestRelativePath(index),
  })
}

const pickPreferredCsvExport = (
  entries: Array<{ fileName?: string; relativePath?: string; path: string; url?: string | null }> | null | undefined,
) =>
  entries?.find((entry) => (entry.fileName ?? entry.relativePath) === 'publish-gate-districts.csv')
  ?? entries?.find((entry) => (entry.fileName ?? entry.relativePath) === 'top-segments.csv')
  ?? entries?.[0]
  ?? null

const buildNightlyIssueArtifactOutputsFromSurface = (
  surface: IssueReportArtifactSummarySurfaceSummary,
  bundleRoot: string,
): NightlyIssueArtifactOutputs => {
  const rootLinks = resolveIssueReportArtifactRootUrls({
    packetRootUrl: surface.packetRootUrl,
    packetLegacyBaseUrl: surface.packetBaseUrl,
    packetLegacyArtifactUrl: surface.packetArtifactUrl,
    csvRootUrl: surface.csvRootUrl,
    csvLegacyBaseUrl: surface.csvBaseUrl,
    csvLegacyArtifactUrl: surface.csvArtifactUrl,
  })
  const packetRootPath =
    surface.packetRootPath
    ?? resolvePortablePath(bundleRoot, surface.packetRootRelativePath)
  const csvRootPath =
    surface.csvRootPath
    ?? resolvePortablePath(bundleRoot, surface.csvRootRelativePath)
  const bundleUrls = resolveIssueReportArtifactBundleUrls({
    packetRootUrl: rootLinks.packetRootUrl,
    csvRootUrl: rootLinks.csvRootUrl,
    preferredCsvUrl: surface.preferredCsvUrl,
    preferredCsvRelativePath: surface.preferredCsvRelativePath,
    packetSummaryUrl: surface.packetSummaryUrl,
    packetSummaryRelativePath: surface.packetSummaryRelativePath,
    packetManifestUrl: surface.packetManifestUrl,
    packetManifestRelativePath: surface.packetManifestRelativePath,
  })
  return {
    indexUrl: surface.artifactIndexUrl,
    indexPath: resolvePortablePath(bundleRoot, surface.artifactIndexRelativePath),
    workflowSummaryUrl: surface.workflowSummaryUrl,
    workflowSummaryPath: resolvePortablePath(
      bundleRoot,
      surface.workflowSummaryRelativePath,
    ),
    workflowSummaryRelativePath: surface.workflowSummaryRelativePath,
    indexSummaryUrl: surface.indexSummaryUrl,
    indexSummaryPath: resolvePortablePath(
      bundleRoot,
      surface.indexSummaryRelativePath,
    ),
    indexSummaryRelativePath: surface.indexSummaryRelativePath,
    indexSummaryJsonUrl: surface.indexSummaryJsonUrl,
    indexSummaryJsonPath: resolvePortablePath(
      bundleRoot,
      surface.indexSummaryJsonRelativePath,
    ),
    indexSummaryJsonRelativePath: surface.indexSummaryJsonRelativePath,
    indexSurfaceUrl: surface.indexSurfaceUrl,
    indexSurfacePath: resolvePortablePath(
      bundleRoot,
      surface.indexSurfaceRelativePath,
    ),
    indexSurfaceRelativePath: surface.indexSurfaceRelativePath,
    packetSummaryUrl: bundleUrls.packetSummaryUrl,
    packetSummaryPath:
      packetRootPath && surface.packetSummaryRelativePath
        ? resolve(packetRootPath, surface.packetSummaryRelativePath)
        : null,
    packetSummaryRelativePath: surface.packetSummaryRelativePath,
    packetManifestUrl: bundleUrls.packetManifestUrl,
    packetManifestPath:
      packetRootPath && surface.packetManifestRelativePath
        ? resolve(packetRootPath, surface.packetManifestRelativePath)
        : null,
    packetManifestRelativePath: surface.packetManifestRelativePath,
    packetRootPath,
    packetRootUrl: rootLinks.packetRootUrl,
    csvRootPath,
    csvRootUrl: rootLinks.csvRootUrl,
    preferredCsvUrl: bundleUrls.preferredCsvUrl,
    preferredCsvPath:
      csvRootPath && surface.preferredCsvRelativePath
        ? resolve(csvRootPath, surface.preferredCsvRelativePath)
        : null,
    preferredCsvRelativePath: surface.preferredCsvRelativePath,
    packetUrl: rootLinks.packetRootUrl,
    csvUrl: rootLinks.csvRootUrl,
  }
}

const buildNightlyIssueArtifactResultFromSurface = (
  surface: IssueReportArtifactSummarySurfaceSummary,
  bundleRoot: string,
): NightlyIssueArtifactResult => ({
  summaries: toNightlyIssueSummariesFromSurface(surface.topDistricts),
  topSegments: toNightlyIssueSegmentsFromSurface(surface.topSegments),
  topReasons: toNightlyIssueReasonsFromSurface(surface.topReasons),
  artifacts: buildNightlyIssueArtifactOutputsFromSurface(surface, bundleRoot),
})

const nightlyFileExists = async (filePath: string) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

type LoadNightlyIssueArtifactsArgs =
  Pick<
    NotifyNightlyArgs,
    | 'syncStorePath'
    | 'issueLimit'
    | 'issuePacketOutPath'
    | 'issueCsvOutPath'
    | 'issuePacketIssueLimit'
  >
  & Partial<
    Pick<
      NotifyNightlyArgs,
      | 'issueInputPath'
      | 'issuePacketUrl'
      | 'issueCsvUrl'
    >
  >

export const loadNightlyIssueArtifacts = async (
  args: LoadNightlyIssueArtifactsArgs,
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): Promise<NightlyIssueArtifactResult> => {
  if (args.issueInputPath) {
    const indexPath = resolve(cwd, args.issueInputPath)
    if (await nightlyFileExists(indexPath)) {
      const parsed = JSON.parse(await readFile(indexPath, 'utf8')) as { artifactType?: string }
      if (isIssueReportSummaryArtifactsManifest(parsed)) {
        const artifactIndexPath = resolveIssueReportArtifactEntryPath(
          indexPath,
          parsed.artifactIndexRelativePath,
          parsed.artifactIndexPath,
        )
        const summaryInputPath = artifactIndexPath
          ?? resolveIssueReportArtifactEntryPath(
            indexPath,
            parsed.sourceSummaryRelativePath,
            parsed.sourceSummaryPath,
          )
          ?? resolveIssueReportArtifactEntryPath(
            indexPath,
            parsed.indexSummaryJsonRelativePath,
            parsed.indexSummaryJsonPath,
          )
          ?? resolveIssueReportArtifactEntryPath(
            indexPath,
            parsed.indexSurfaceRelativePath,
            parsed.indexSurfacePath,
          )
        if (!summaryInputPath) {
          throw new Error(
            'issue report summary artifacts manifest is missing its canonical input surfaces',
          )
        }
        const loaded = await loadIssueReportArtifactSummarySurfaceInput(summaryInputPath, cwd)
        const surface =
          loaded.surface
          ?? (loaded.summary
            ? buildIssueReportArtifactSummaryJsonSurfaceSummary(loaded.summary)
            : null)
        if (!surface) {
          throw new Error(
            'issue report summary artifacts manifest did not resolve to a usable summary surface',
          )
        }
        const bundleRoot = parsed.outRoot
        const surfaceOutputs = buildNightlyIssueArtifactOutputsFromSurface(surface, bundleRoot)
        const rootLinks = resolveIssueReportArtifactRootUrls({
          packetRootUrl: parsed.packetRootUrl ?? surfaceOutputs.packetRootUrl,
          packetLegacyArtifactUrl: parsed.packetArtifactUrl,
          csvRootUrl: parsed.csvRootUrl ?? surfaceOutputs.csvRootUrl,
          csvLegacyArtifactUrl: parsed.csvArtifactUrl,
        })
        const bundleUrls = resolveIssueReportArtifactBundleUrls({
          packetRootUrl: rootLinks.packetRootUrl,
          csvRootUrl: rootLinks.csvRootUrl,
          preferredCsvUrl: parsed.preferredCsvUrl ?? surfaceOutputs.preferredCsvUrl,
          preferredCsvRelativePath:
            parsed.preferredCsvRelativePath ?? surfaceOutputs.preferredCsvRelativePath,
          packetSummaryUrl: parsed.packetSummaryUrl ?? surfaceOutputs.packetSummaryUrl,
          packetSummaryRelativePath: parsed.packetSummaryRelativePath,
          packetManifestUrl: parsed.packetManifestUrl ?? surfaceOutputs.packetManifestUrl,
          packetManifestRelativePath: parsed.packetManifestRelativePath,
        })
        return {
          ...buildNightlyIssueArtifactResultFromSurface(surface, bundleRoot),
          artifacts: {
            ...surfaceOutputs,
            indexPath: artifactIndexPath,
            workflowSummaryPath: parsed.summaryPath,
            workflowSummaryRelativePath: parsed.summaryRelativePath,
            workflowSummaryUrl: parsed.summaryUrl,
            indexSummaryPath: parsed.indexSummaryPath,
            indexSummaryRelativePath: parsed.indexSummaryRelativePath,
            indexSummaryUrl: parsed.indexSummaryUrl,
            indexSummaryJsonPath: parsed.indexSummaryJsonPath,
            indexSummaryJsonRelativePath: parsed.indexSummaryJsonRelativePath,
            indexSummaryJsonUrl: parsed.indexSummaryJsonUrl,
            indexSurfacePath: parsed.indexSurfacePath,
            indexSurfaceRelativePath: parsed.indexSurfaceRelativePath,
            indexSurfaceUrl: parsed.indexSurfaceUrl,
            packetSummaryUrl: bundleUrls.packetSummaryUrl,
            packetSummaryPath: parsed.packetSummaryPath ?? surfaceOutputs.packetSummaryPath,
            packetSummaryRelativePath: parsed.packetSummaryRelativePath,
            packetManifestUrl: bundleUrls.packetManifestUrl,
            packetManifestPath: parsed.packetManifestPath ?? surfaceOutputs.packetManifestPath,
            packetManifestRelativePath: parsed.packetManifestRelativePath,
            packetRootPath: parsed.packetRootPath ?? surfaceOutputs.packetRootPath,
            packetRootUrl: rootLinks.packetRootUrl,
            csvRootPath: parsed.csvRootPath ?? surfaceOutputs.csvRootPath,
            csvRootUrl: rootLinks.csvRootUrl,
            preferredCsvUrl: bundleUrls.preferredCsvUrl,
            preferredCsvPath: surfaceOutputs.preferredCsvPath,
            preferredCsvRelativePath: surfaceOutputs.preferredCsvRelativePath,
            packetUrl: rootLinks.packetRootUrl,
            csvUrl: rootLinks.csvRootUrl,
          },
        }
      }
      if (isIssueReportWorkflowArtifactsManifest(parsed)) {
        const resolvedSurfacePath = resolveIssueReportWorkflowArtifactEntryPath(
          indexPath,
          parsed.indexSurfaceRelativePath,
          parsed.indexSurfacePath,
        )
        const loaded = await loadIssueReportArtifactSummaryInputDetails(indexPath, cwd)
        if (loaded.index.artifactType === 'issue-report-artifact-summary-surface') {
          const surface = loaded.index
          const bundleRoot = dirname(indexPath)
          return {
            ...buildNightlyIssueArtifactResultFromSurface(surface, bundleRoot),
            artifacts: {
              ...buildNightlyIssueArtifactOutputsFromSurface(surface, bundleRoot),
              indexPath: resolvedSurfacePath ?? resolvePortablePath(
                bundleRoot,
                surface.artifactIndexRelativePath,
              ),
              indexSurfacePath: resolvedSurfacePath,
            },
          }
        }

        const index =
          loaded.index.artifactType === 'issue-report-artifact-index'
            ? loaded.index
            : await loadIssueReportArtifactIndex(indexPath)
        const preferredCsvFile = resolveIssueReportArtifactIndexPreferredCsvFile(index)
        const packetRootUrl = resolveNightlyArtifactIndexPacketRootUrl(index)
        const csvRootUrl = resolveNightlyArtifactIndexCsvRootUrl(index)
        const packetSummaryRelativePath =
          resolveNightlyArtifactIndexPacketSummaryRelativePath(index)
        const packetManifestRelativePath =
          resolveNightlyArtifactIndexPacketManifestRelativePath(index)
        const bundleUrls = resolveNightlyArtifactIndexBundleUrls(index)
        return {
          summaries: index.topDistricts,
          topSegments: toNightlyIssueSegmentsFromPackets(index.topSegments),
          topReasons: toNightlyIssueReasonsFromPackets(index.topReasons),
        artifacts: {
          indexUrl: index.rootManifest.artifactIndexUrl,
          indexPath: index.rootManifest.artifactIndexPath,
          workflowSummaryUrl: index.rootManifest.summaryUrl,
          workflowSummaryPath: index.rootManifest.summaryPath,
          workflowSummaryRelativePath: index.rootManifest.summaryRelativePath,
          indexSummaryUrl: index.rootManifest.indexSummaryUrl,
          indexSummaryPath: index.rootManifest.indexSummaryPath,
          indexSummaryRelativePath: index.rootManifest.indexSummaryRelativePath,
          indexSummaryJsonUrl: index.rootManifest.indexSummaryJsonUrl,
          indexSummaryJsonPath: index.rootManifest.indexSummaryJsonPath,
          indexSummaryJsonRelativePath: index.rootManifest.indexSummaryJsonRelativePath,
          indexSurfaceUrl: index.rootManifest.indexSurfaceUrl,
          indexSurfacePath: index.rootManifest.indexSurfacePath,
          indexSurfaceRelativePath: index.rootManifest.indexSurfaceRelativePath,
          packetSummaryUrl: bundleUrls.packetSummaryUrl,
          packetSummaryPath:
            index.rootManifest.packetSummaryPath
            ?? index.packetManifest.summaryPath,
          packetSummaryRelativePath,
          packetManifestUrl: bundleUrls.packetManifestUrl,
          packetManifestPath:
            index.rootManifest.packetManifestPath
            ?? index.packetManifest.manifestPath,
          packetManifestRelativePath,
          packetRootPath:
            index.rootManifest.packetRootPath
            ?? index.packetManifest.packetRootPath,
          packetRootUrl,
          csvRootPath:
            index.rootManifest.csvRootPath
            ?? index.packetManifest.csvRootPath,
          csvRootUrl,
          preferredCsvUrl: bundleUrls.preferredCsvUrl,
          preferredCsvPath:
            preferredCsvFile?.path
            ?? pickPreferredCsvExport(index.csvExports)?.path
            ?? null,
          preferredCsvRelativePath:
            preferredCsvFile?.relativePath
            ?? pickPreferredCsvExport(index.csvExports)?.fileName
            ?? pickPreferredCsvExport(index.csvExports)?.relativePath
            ?? null,
          packetUrl: packetRootUrl,
          csvUrl: csvRootUrl,
          },
        }
      }
      if (
        parsed.artifactType === 'issue-report-artifact-summary-surface'
        || parsed.artifactType === 'issue-report-artifact-summary-json'
      ) {
        const surface =
          parsed.artifactType === 'issue-report-artifact-summary-surface'
            ? parseIssueReportArtifactSummarySurfaceSummary(parsed)
            : buildIssueReportArtifactSummaryJsonSurfaceSummary({
                summaryPath: indexPath,
                summary: parseIssueReportArtifactSummaryJsonOutput(parsed),
              })
        return buildNightlyIssueArtifactResultFromSurface(
          surface,
          dirname(surface.summaryPath),
        )
      }

      if (
        parsed.artifactType === 'issue-report-summary-index'
        || parsed.artifactType === 'issue-report-summary-json'
      ) {
        const loaded = await loadIssueReportArtifactSummarySurfaceInput(indexPath, cwd)
        if (loaded.surface) {
          return buildNightlyIssueArtifactResultFromSurface(
            loaded.surface,
            dirname(loaded.surface.summaryPath),
          )
        }
        if (loaded.summary) {
          return buildNightlyIssueArtifactResultFromSurface(
            buildIssueReportArtifactSummaryJsonSurfaceSummary(loaded.summary),
            dirname(loaded.summary.summaryPath),
          )
        }
      }

      const index = await loadIssueReportArtifactIndex(indexPath)
      const preferredCsvFile = resolveIssueReportArtifactIndexPreferredCsvFile(index)
      const packetRootUrl = resolveNightlyArtifactIndexPacketRootUrl(index)
      const csvRootUrl = resolveNightlyArtifactIndexCsvRootUrl(index)
      const packetSummaryRelativePath =
        resolveNightlyArtifactIndexPacketSummaryRelativePath(index)
      const packetManifestRelativePath =
        resolveNightlyArtifactIndexPacketManifestRelativePath(index)
      const bundleUrls = resolveNightlyArtifactIndexBundleUrls(index)
      return {
        summaries: index.topDistricts,
        topSegments: toNightlyIssueSegmentsFromPackets(index.topSegments),
        topReasons: toNightlyIssueReasonsFromPackets(index.topReasons),
        artifacts: {
          indexUrl: index.rootManifest.artifactIndexUrl,
          indexPath,
          workflowSummaryUrl: index.rootManifest.summaryUrl,
          workflowSummaryPath: index.rootManifest.summaryPath,
          workflowSummaryRelativePath: index.rootManifest.summaryRelativePath,
          indexSummaryUrl: index.rootManifest.indexSummaryUrl,
          indexSummaryPath: index.rootManifest.indexSummaryPath,
          indexSummaryRelativePath: index.rootManifest.indexSummaryRelativePath,
          indexSummaryJsonUrl: index.rootManifest.indexSummaryJsonUrl,
          indexSummaryJsonPath: index.rootManifest.indexSummaryJsonPath,
          indexSummaryJsonRelativePath: index.rootManifest.indexSummaryJsonRelativePath,
          indexSurfaceUrl: index.rootManifest.indexSurfaceUrl,
          indexSurfacePath: index.rootManifest.indexSurfacePath,
          indexSurfaceRelativePath: index.rootManifest.indexSurfaceRelativePath,
          packetSummaryUrl: bundleUrls.packetSummaryUrl,
          packetSummaryPath:
            index.rootManifest.packetSummaryPath
            ?? index.packetManifest.summaryPath,
          packetSummaryRelativePath,
          packetManifestUrl: bundleUrls.packetManifestUrl,
          packetManifestPath:
            index.rootManifest.packetManifestPath
            ?? index.packetManifest.manifestPath,
          packetManifestRelativePath,
          packetRootPath:
            index.rootManifest.packetRootPath
            ?? index.packetManifest.packetRootPath,
          packetRootUrl,
          csvRootPath:
            index.rootManifest.csvRootPath
            ?? index.packetManifest.csvRootPath,
          csvRootUrl,
          preferredCsvUrl: bundleUrls.preferredCsvUrl,
          preferredCsvPath:
            preferredCsvFile?.path
            ?? pickPreferredCsvExport(index.csvExports)?.path
            ?? null,
          preferredCsvRelativePath:
            preferredCsvFile?.relativePath
            ?? pickPreferredCsvExport(index.csvExports)?.fileName
            ?? pickPreferredCsvExport(index.csvExports)?.relativePath
            ?? null,
          packetUrl: packetRootUrl,
          csvUrl: csvRootUrl,
        },
      }
    }
  }

  const summary = await loadIssueReportSummary(
    {
      syncStorePath: args.syncStorePath,
      scope: null,
      districtId: null,
      segmentId: null,
      reasonCode: null,
      since: null,
      limit: args.issueLimit,
    },
    env,
    cwd,
  )

  let packetRootPath: string | null = null
  let packetSummaryPath: string | null = null
  let packetManifestPath: string | null = null
  let csvRootPath: string | null = null
  let preferredCsvPath: string | null = null
  let preferredCsvRelativePath: string | null = null
  let csvWrite: Awaited<ReturnType<typeof writeIssueReportSummaryCsvFiles>> | null = null
  const issuePacketUrl = args.issuePacketUrl ?? null
  const issueCsvUrl = args.issueCsvUrl ?? null

  if (args.issueCsvOutPath) {
    csvWrite = await writeIssueReportSummaryCsvFiles(
      args.issueCsvOutPath,
      summary,
      null,
      cwd,
    )
    csvRootPath = csvWrite.rootPath
    preferredCsvPath =
      csvWrite.filePaths.find((entry) => entry.endsWith('publish-gate-districts.csv'))
      ?? csvWrite.filePaths.find((entry) => entry.endsWith('top-segments.csv'))
      ?? csvWrite.filePaths[0]
      ?? null
    preferredCsvRelativePath = preferredCsvPath ? relative(csvRootPath, preferredCsvPath).replace(/\\/g, '/') : null
  }

  if (args.issuePacketOutPath) {
    const packetBundle = buildIssueReportTriagePacketBundle(
      summary,
      args.issuePacketIssueLimit,
    )
    const writeResult = await writeIssueReportTriagePacketBundle(
      args.issuePacketOutPath,
      packetBundle,
      {
        packetRootUrl: issuePacketUrl,
        csvWrite,
        csvRootUrl: issueCsvUrl,
      },
      cwd,
    )
    packetRootPath = writeResult.rootPath
    packetSummaryPath = writeResult.summaryPath
    packetManifestPath = writeResult.manifestPath
  }

  return {
    summaries: toNightlyIssueSummaries(summary.summaries),
    topSegments: toNightlyIssueSegments(summary.topSegments),
    topReasons: toNightlyIssueReasons(summary.topReasons),
    artifacts: {
      indexUrl: null,
      indexPath: null,
      workflowSummaryUrl: null,
      workflowSummaryPath: null,
      workflowSummaryRelativePath: null,
      indexSummaryUrl: null,
      indexSummaryPath: null,
      indexSummaryRelativePath: null,
      indexSummaryJsonUrl: null,
      indexSummaryJsonPath: null,
      indexSummaryJsonRelativePath: null,
      indexSurfaceUrl: null,
      indexSurfacePath: null,
      indexSurfaceRelativePath: null,
      packetSummaryUrl: resolveIssueReportArtifactBundleUrls({
        packetRootUrl: issuePacketUrl,
        csvRootUrl: issueCsvUrl,
        preferredCsvUrl: null,
        preferredCsvRelativePath,
        packetSummaryUrl: null,
        packetSummaryRelativePath: packetSummaryPath ? 'summary.md' : null,
        packetManifestUrl: null,
        packetManifestRelativePath: packetManifestPath ? 'manifest.json' : null,
      }).packetSummaryUrl,
      packetSummaryPath,
      packetSummaryRelativePath: packetSummaryPath ? 'summary.md' : null,
      packetManifestUrl: resolveIssueReportArtifactBundleUrls({
        packetRootUrl: issuePacketUrl,
        csvRootUrl: issueCsvUrl,
        preferredCsvUrl: null,
        preferredCsvRelativePath,
        packetSummaryUrl: null,
        packetSummaryRelativePath: packetSummaryPath ? 'summary.md' : null,
        packetManifestUrl: null,
        packetManifestRelativePath: packetManifestPath ? 'manifest.json' : null,
      }).packetManifestUrl,
      packetManifestPath,
      packetManifestRelativePath: packetManifestPath ? 'manifest.json' : null,
      packetRootPath,
      packetRootUrl: issuePacketUrl,
      csvRootPath,
      csvRootUrl: issueCsvUrl,
      preferredCsvUrl: resolveIssueReportArtifactBundleUrls({
        packetRootUrl: issuePacketUrl,
        csvRootUrl: issueCsvUrl,
        preferredCsvUrl: null,
        preferredCsvRelativePath,
        packetSummaryUrl: null,
        packetSummaryRelativePath: packetSummaryPath ? 'summary.md' : null,
        packetManifestUrl: null,
        packetManifestRelativePath: packetManifestPath ? 'manifest.json' : null,
      }).preferredCsvUrl,
      preferredCsvPath,
      preferredCsvRelativePath,
      packetUrl: issuePacketUrl,
      csvUrl: issueCsvUrl,
    },
  }
}
