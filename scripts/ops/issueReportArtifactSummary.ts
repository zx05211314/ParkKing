import { access, readFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
  ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
  ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
  resolveIssueReportManualArtifactsManifestRelativePath,
  resolveIssueReportManualArtifactsManifestUrl,
  resolveIssueReportManualArtifactsManifestPath,
  resolveIssueReportManualSidecarPath,
  resolveIssueReportManualSidecarRelativePath,
  resolveIssueReportManualSidecarUrl,
} from './issueReportArtifactSidecars'
import {
  buildIssueReportArtifactIndex,
  loadIssueReportArtifactIndex,
  parseIssueReportArtifactIndex,
  resolveIssueReportArtifactIndexPreferredCsvFile,
} from './issueReportArtifactIndex'
import {
  applyIssueReportManualManifestPreferredCsvToSummaryIndex,
  applyIssueReportManualManifestPreferredCsvToSummaryJson,
  applyIssueReportManualManifestPreferredCsvToSurfaceSummary,
} from './issueReportManualPreferredCsv'
import { parseIssueReportArtifactSummaryArgs } from './issueReportArtifactSummaryArgs'
import {
  loadIssueReportSummaryIndexFromSummary,
  parseIssueReportSummaryIndex,
  resolveIssueReportSummaryIndexOutPath,
} from './issueReportSummaryIndex'
import { parseIssueReportSummaryJsonOutput } from './issueReportSummaryJson'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'
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
import type {
  IssueReportArtifactSummaryJsonOutput,
  IssueReportArtifactIndexOutput,
  IssueReportArtifactSummaryInputArtifactType,
  IssueReportArtifactSummarySurfaceSummary,
  IssueReportSummaryArtifactsManifest,
  IssueReportSummaryIndexOutput,
  IssueReportSummaryIndexPublishGateHotspot,
  IssueReportTriagePacketManifestCsvEntry,
} from './issueReportSummaryTypes'
import {
  ISSUE_REPORT_ARTIFACT_SUMMARY_JSON_SCHEMA_VERSION,
  ISSUE_REPORT_ARTIFACT_SUMMARY_SURFACE_SCHEMA_VERSION,
} from './issueReportSummaryTypes'

type IssueReportArtifactSummaryIndexInput =
  | IssueReportArtifactIndexOutput
  | IssueReportSummaryIndexOutput

type IssueReportArtifactSummaryJsonSourceInput =
  | IssueReportArtifactSummaryIndexInput
  | IssueReportArtifactSummaryJsonOutput

type IssueReportArtifactSummaryInput =
  | IssueReportArtifactSummaryIndexInput
  | IssueReportArtifactSummaryJsonOutput
  | IssueReportArtifactSummarySurfaceSummary

interface IssueReportArtifactSummaryOptions {
  label?: string | null
  inputUrl?: string | null
  publishGateSummaryUrl?: string | null
  topCount?: number
  inputArtifactType?: IssueReportArtifactSummaryInputArtifactType | null
}

const escapeCell = (value: string) => value.replace(/\|/g, '\\|')

const renderLink = (label: string, value: string | null) =>
  value ? `[${label}](${value})` : '-'

const formatOptionalText = (value: string | null) =>
  value && value.trim().length > 0 ? value : '-'

const resolveIssueReportArtifactIndexRootUrls = (
  index: IssueReportArtifactSummaryIndexInput,
) =>
  isIssueReportArtifactIndex(index)
    ? resolveIssueReportArtifactRootUrls({
        packetRootUrl: index.rootManifest.packetRootUrl,
        packetLegacyArtifactUrl: index.rootManifest.packetArtifactUrl,
        csvRootUrl: index.rootManifest.csvRootUrl,
        csvLegacyArtifactUrl: index.rootManifest.csvArtifactUrl,
      })
    : resolveIssueReportArtifactRootUrls({
        packetRootUrl: index.packetRootUrl,
        packetLegacyBaseUrl: index.packetBaseUrl,
        csvRootUrl: index.csvRootUrl,
        csvLegacyBaseUrl: index.csvBaseUrl,
      })

const resolveIssueReportArtifactLinkRootUrls = (
  links: Pick<
    IssueReportArtifactSummaryJsonOutput['artifactLinks'],
    | 'packetRootUrl'
    | 'packetBaseUrl'
    | 'packetArtifactUrl'
    | 'csvRootUrl'
    | 'csvBaseUrl'
    | 'csvArtifactUrl'
  >,
) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: links.packetRootUrl,
    packetLegacyBaseUrl: links.packetBaseUrl,
    packetLegacyArtifactUrl: links.packetArtifactUrl,
    csvRootUrl: links.csvRootUrl,
    csvLegacyBaseUrl: links.csvBaseUrl,
    csvLegacyArtifactUrl: links.csvArtifactUrl,
  })

const resolveIssueReportArtifactSurfaceRootUrls = (
  surface: Pick<
    IssueReportArtifactSummarySurfaceSummary,
    | 'packetRootUrl'
    | 'packetBaseUrl'
    | 'packetArtifactUrl'
    | 'csvRootUrl'
    | 'csvBaseUrl'
    | 'csvArtifactUrl'
  >,
) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: surface.packetRootUrl,
    packetLegacyBaseUrl: surface.packetBaseUrl,
    packetLegacyArtifactUrl: surface.packetArtifactUrl,
    csvRootUrl: surface.csvRootUrl,
    csvLegacyBaseUrl: surface.csvBaseUrl,
    csvLegacyArtifactUrl: surface.csvArtifactUrl,
  })

const isIssueReportArtifactIndex = (
  index: IssueReportArtifactSummaryInput,
): index is IssueReportArtifactIndexOutput =>
  index.artifactType === 'issue-report-artifact-index'

const isIssueReportArtifactSummaryJson = (
  index: IssueReportArtifactSummaryInput,
): index is IssueReportArtifactSummaryJsonOutput =>
  index.artifactType === 'issue-report-artifact-summary-json'

const isIssueReportArtifactSummarySurface = (
  index: IssueReportArtifactSummaryInput,
): index is IssueReportArtifactSummarySurfaceSummary =>
  index.artifactType === 'issue-report-artifact-summary-surface'

const buildPacketUrlMap = <
  T extends { packetId: string; url: string | null; relativePath: string },
>(
  entries: T[],
) =>
  new Map(
    entries.map((entry) => [
      entry.packetId,
      entry.url ?? entry.relativePath,
    ]),
  )

const buildLabelUrlMap = <
  T extends { label: string; url: string | null; relativePath: string },
>(
  entries: T[],
) =>
  new Map(
    entries.map((entry) => [
      entry.label,
      entry.url ?? entry.relativePath,
    ]),
  )

const prioritizeCsvExports = (
  exports: Array<
    IssueReportTriagePacketManifestCsvEntry | {
      relativePath: string
      url: string | null
      path: string
    }
  >,
) => {
  const prioritized = [...exports]
  prioritized.sort((left, right) => {
    const leftName = 'fileName' in left ? left.fileName : left.relativePath
    const rightName = 'fileName' in right ? right.fileName : right.relativePath
    const leftPriority = leftName === 'publish-gate-districts.csv' ? 0 : 1
    const rightPriority = rightName === 'publish-gate-districts.csv' ? 0 : 1
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }
    return leftName.localeCompare(rightName)
  })
  return prioritized
}

const pickPreferredCsvExport = (
  exports: Array<{
    relativePath: string
    url: string | null
    path: string
  }>,
) =>
  exports.find((entry) => entry.relativePath === 'publish-gate-districts.csv')
  ?? exports.find((entry) => entry.relativePath === 'top-segments.csv')
  ?? exports[0]
  ?? null

const formatSegmentLabel = (segment: { segmentName: string | null; segmentId: string | null }) =>
  segment.segmentName && segment.segmentId
    ? `${segment.segmentName} (${segment.segmentId})`
    : segment.segmentName ?? segment.segmentId ?? '-'

const buildManualSummaryIndexEntries = (
  index: IssueReportSummaryIndexOutput,
) => ({
  indexSummaryRelativePath: resolveIssueReportManualSidecarRelativePath(
    index.indexFile?.relativePath ?? null,
    ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
  ),
  indexSummaryJsonRelativePath: resolveIssueReportManualSidecarRelativePath(
    index.indexFile?.relativePath ?? null,
    ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
  ),
  indexSurfaceRelativePath: resolveIssueReportManualSidecarRelativePath(
    index.indexFile?.relativePath ?? null,
    'index-surface.json',
  ),
  manualManifestRelativePath:
    index.manualManifestFile?.relativePath
    ?? resolveIssueReportManualArtifactsManifestRelativePath(index.indexFile?.relativePath ?? null),
  indexSummaryUrl: resolveIssueReportManualSidecarUrl(
    index.indexFile?.url ?? null,
    ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
  ),
  indexSummaryJsonUrl: resolveIssueReportManualSidecarUrl(
    index.indexFile?.url ?? null,
    ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
  ),
  indexSurfaceUrl: resolveIssueReportManualSidecarUrl(
    index.indexFile?.url ?? null,
    'index-surface.json',
  ),
  manualManifestUrl:
    index.manualManifestFile?.url
    ?? resolveIssueReportManualArtifactsManifestUrl(index.indexFile?.url ?? null),
})

const buildSummaryIndexTopSegments = (
  index: IssueReportArtifactSummaryIndexInput,
): IssueReportArtifactSummaryJsonOutput['topSegments'] => {
  if (isIssueReportArtifactIndex(index)) {
    const packetUrls = buildPacketUrlMap(index.segmentPackets)
    return index.topSegments.map((segment) => ({
      scope: segment.scope,
      districtId: segment.districtId,
      segmentId: segment.segmentId,
      segmentName: segment.segmentName,
      segmentLabel: formatSegmentLabel(segment),
      count: segment.count,
      segmentTier: segment.segmentTier,
      latestCreatedAt: segment.latestCreatedAt,
      latestSummary: segment.latestSummary,
      packetPath: index.segmentPackets.find((entry) => entry.packetId === segment.packetId)?.relativePath ?? null,
      packetUrl: packetUrls.get(segment.packetId) ?? null,
    }))
  }

  const packetUrls = buildLabelUrlMap(index.segmentPacketEntries)
  const packetPaths = new Map(
    index.segmentPacketEntries.map((entry) => [entry.label, entry.relativePath] as const),
  )
  return index.topSegments.map((segment) => {
    const segmentLabel = formatSegmentLabel(segment)
    return {
      scope: segment.scope,
      districtId: segment.districtId,
      segmentId: segment.segmentId,
      segmentName: segment.segmentName,
      segmentLabel,
      count: segment.count,
      segmentTier: segment.segmentTier,
      latestCreatedAt: segment.latestCreatedAt,
      latestSummary: segment.latestSummary,
      packetPath: packetPaths.get(segmentLabel) ?? null,
      packetUrl: packetUrls.get(segmentLabel) ?? null,
    }
  })
}

const buildSummaryIndexTopReasons = (
  index: IssueReportArtifactSummaryIndexInput,
): IssueReportArtifactSummaryJsonOutput['topReasons'] => {
  if (isIssueReportArtifactIndex(index)) {
    const packetUrls = buildPacketUrlMap(index.reasonPackets)
    return index.topReasons.map((reason) => ({
      reasonCode: reason.reasonCode,
      count: reason.count,
      districtCount: reason.districtCount,
      segmentCount: reason.segmentCount,
      latestCreatedAt: reason.latestCreatedAt,
      latestDistrictId: reason.latestDistrictId,
      latestSegmentId: reason.latestSegmentId,
      latestSegmentName: reason.latestSegmentName,
      packetPath: index.reasonPackets.find((entry) => entry.packetId === reason.packetId)?.relativePath ?? null,
      packetUrl: packetUrls.get(reason.packetId) ?? null,
    }))
  }

  const packetUrls = buildLabelUrlMap(index.reasonPacketEntries)
  const packetPaths = new Map(
    index.reasonPacketEntries.map((entry) => [entry.label, entry.relativePath] as const),
  )
  return index.topReasons.map((reason) => ({
    reasonCode: reason.reasonCode,
    count: reason.count,
    districtCount: reason.districtCount,
    segmentCount: reason.segmentCount,
    latestCreatedAt: reason.latestCreatedAt,
    latestDistrictId: reason.latestDistrictId,
    latestSegmentId: reason.latestSegmentId,
    latestSegmentName: reason.latestSegmentName,
    packetPath: packetPaths.get(reason.reasonCode) ?? null,
    packetUrl: packetUrls.get(reason.reasonCode) ?? null,
  }))
}

const renderSummarySegmentRows = (
  segments: IssueReportArtifactSummaryJsonOutput['topSegments'],
) =>
  segments.map((segment) => {
    const packetPath = segment.packetUrl ?? segment.packetPath ?? '-'
    return `| ${segment.districtId} | ${escapeCell(segment.segmentName ?? segment.segmentId ?? '-')} | ${segment.count} | ${formatOptionalText(segment.segmentTier)} | ${formatOptionalText(segment.latestCreatedAt)} | ${escapeCell(segment.latestSummary ?? '-')} | ${packetPath} |`
  })

const renderSummaryReasonRows = (
  reasons: IssueReportArtifactSummaryJsonOutput['topReasons'],
) =>
  reasons.map((reason) => {
    const packetPath = reason.packetUrl ?? reason.packetPath ?? '-'
    return `| ${reason.reasonCode} | ${reason.count} | ${reason.districtCount} | ${reason.segmentCount} | ${escapeCell(reason.latestSegmentName ?? reason.latestSegmentId ?? '-')} | ${formatOptionalText(reason.latestCreatedAt)} | ${packetPath} |`
  })

const buildIssueReportArtifactSummaryJsonOutput = (params: {
  index: IssueReportArtifactSummaryJsonSourceInput
  options: IssueReportArtifactSummaryOptions
}): IssueReportArtifactSummaryJsonOutput => {
  if (isIssueReportArtifactSummaryJson(params.index)) {
    return params.index
  }

  const topCount = params.options.topCount ?? 5
  const linkedPublishGateHotspotCount = params.index.publishGateHotspots.filter(
    (hotspot) => hotspot.issueHotspotPacketPath !== null,
  ).length
  const topSegments = buildSummaryIndexTopSegments(params.index)
  const topReasons = buildSummaryIndexTopReasons(params.index)

  const normalizedCsvExports = prioritizeCsvExports(params.index.csvExports).map((entry) => ({
    path: entry.path,
    relativePath: 'fileName' in entry ? entry.fileName : entry.relativePath,
    url: entry.url,
  }))
  const preferredCsvExport = isIssueReportArtifactIndex(params.index)
    ? resolveIssueReportArtifactIndexPreferredCsvFile(params.index)
    : params.index.preferredCsvFile ?? pickPreferredCsvExport(normalizedCsvExports)
  const workflowPacketSummaryRelativePath = isIssueReportArtifactIndex(params.index)
    ? params.index.rootManifest.packetSummaryRelativePath
      ?? params.index.packetManifest.summaryRelativePath
    : null
  const workflowPacketManifestRelativePath = isIssueReportArtifactIndex(params.index)
    ? params.index.rootManifest.packetManifestRelativePath
      ?? (params.index.rootManifest.packetRootPath
        ? relative(
            params.index.rootManifest.packetRootPath,
            params.index.rootManifest.packetManifestPath,
          ).replace(/\\/g, '/')
        : null)
    : null

  const summaryEntries = isIssueReportArtifactIndex(params.index)
      ? {
          workflowSummaryRelativePath: params.index.rootManifest.summaryRelativePath,
          indexSummaryRelativePath: params.index.rootManifest.indexSummaryRelativePath,
          indexSummaryJsonRelativePath: params.index.rootManifest.indexSummaryJsonRelativePath,
          indexSurfaceRelativePath: params.index.rootManifest.indexSurfaceRelativePath,
          artifactIndexRelativePath: params.index.rootManifest.artifactIndexRelativePath,
          manualManifestRelativePath: null,
          sourceSummaryRelativePath: null,
          rawIssuesRelativePath: null,
          packetRootRelativePath: relative(
            params.index.rootManifest.outRoot,
            params.index.rootManifest.packetRootPath,
        ).replace(/\\/g, '/'),
        csvRootRelativePath: relative(
          params.index.rootManifest.outRoot,
          params.index.rootManifest.csvRootPath,
        ).replace(/\\/g, '/'),
        preferredCsvRelativePath:
          params.index.rootManifest.preferredCsvRelativePath
          ?? preferredCsvExport?.relativePath
          ?? null,
        packetSummaryRelativePath: workflowPacketSummaryRelativePath,
        packetManifestRelativePath: workflowPacketManifestRelativePath,
      }
      : {
          workflowSummaryRelativePath: null,
          indexSummaryRelativePath: buildManualSummaryIndexEntries(params.index)
            .indexSummaryRelativePath,
          indexSummaryJsonRelativePath: buildManualSummaryIndexEntries(params.index)
            .indexSummaryJsonRelativePath,
          indexSurfaceRelativePath: buildManualSummaryIndexEntries(params.index)
            .indexSurfaceRelativePath,
          artifactIndexRelativePath: params.index.indexFile?.relativePath ?? null,
          manualManifestRelativePath: buildManualSummaryIndexEntries(params.index)
            .manualManifestRelativePath,
          sourceSummaryRelativePath: params.index.summaryFile?.relativePath ?? null,
          rawIssuesRelativePath: params.index.rawIssuesFile?.relativePath ?? null,
          packetRootRelativePath:
            params.index.packetRootPath
            ? relative(
                dirname(params.index.sourceSummaryPath),
                params.index.packetRootPath,
              ).replace(/\\/g, '/')
            : null,
        csvRootRelativePath:
          params.index.csvRootPath
            ? relative(
                dirname(params.index.sourceSummaryPath),
                params.index.csvRootPath,
              ).replace(/\\/g, '/')
            : null,
        preferredCsvRelativePath: preferredCsvExport?.relativePath ?? null,
        packetSummaryRelativePath: params.index.packetSummaryFile?.relativePath ?? null,
          packetManifestRelativePath: params.index.packetManifestFile?.relativePath ?? null,
      }

  const {
    packetRootUrl,
    csvRootUrl,
    packetBaseUrl,
    csvBaseUrl,
    packetArtifactUrl,
    csvArtifactUrl,
  } = resolveIssueReportArtifactIndexRootUrls(params.index)
  const {
    preferredCsvUrl,
    packetSummaryUrl,
    packetManifestUrl,
  } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl,
    csvRootUrl,
    preferredCsvUrl: preferredCsvExport?.url ?? null,
    preferredCsvRelativePath: summaryEntries.preferredCsvRelativePath,
    packetSummaryUrl: isIssueReportArtifactIndex(params.index)
      ? params.index.rootManifest.packetSummaryUrl
      : null,
    packetSummaryRelativePath: summaryEntries.packetSummaryRelativePath,
    packetManifestUrl: isIssueReportArtifactIndex(params.index)
      ? params.index.rootManifest.packetManifestUrl
      : null,
    packetManifestRelativePath: summaryEntries.packetManifestRelativePath,
  })

  return {
    artifactType: 'issue-report-artifact-summary-json',
    schemaVersion: ISSUE_REPORT_ARTIFACT_SUMMARY_JSON_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    label: params.options.label ?? null,
    inputArtifactType: params.options.inputArtifactType ?? params.index.artifactType,
    resolvedIndexArtifactType: params.index.artifactType,
    resolvedIndexSchemaVersion: params.index.schemaVersion,
    inputUrl: params.options.inputUrl ?? null,
    publishGateSummaryUrl: params.options.publishGateSummaryUrl ?? null,
    topCount,
    matchingIssueReports: {
      filteredCount: isIssueReportArtifactIndex(params.index)
        ? params.index.rootManifest.filteredCount
        : params.index.filteredCount,
      totalCount: isIssueReportArtifactIndex(params.index)
        ? params.index.rootManifest.totalCount
        : params.index.totalCount,
    },
    linkedPublishGateHotspots: {
      linkedCount: linkedPublishGateHotspotCount,
      totalCount: params.index.publishGateHotspots.length,
    },
    packetEntries: {
      segmentCount: topSegments.length,
      reasonCount: topReasons.length,
    },
    summaryEntries,
    artifactLinks: {
      summaryUrl: isIssueReportArtifactIndex(params.index)
        ? params.index.rootManifest.summaryUrl
        : null,
      indexSummaryUrl: isIssueReportArtifactIndex(params.index)
        ? params.index.rootManifest.indexSummaryUrl
        : buildManualSummaryIndexEntries(params.index).indexSummaryUrl,
      indexSummaryJsonUrl: isIssueReportArtifactIndex(params.index)
        ? params.index.rootManifest.indexSummaryJsonUrl
        : buildManualSummaryIndexEntries(params.index).indexSummaryJsonUrl,
      indexSurfaceUrl: isIssueReportArtifactIndex(params.index)
        ? params.index.rootManifest.indexSurfaceUrl
        : buildManualSummaryIndexEntries(params.index).indexSurfaceUrl,
      artifactIndexUrl: isIssueReportArtifactIndex(params.index)
        ? params.index.rootManifest.artifactIndexUrl
        : params.index.indexFile?.url ?? null,
      manualManifestUrl: isIssueReportArtifactIndex(params.index)
        ? null
        : buildManualSummaryIndexEntries(params.index).manualManifestUrl,
      sourceSummaryUrl: isIssueReportArtifactIndex(params.index)
        ? null
        : params.index.summaryFile?.url ?? null,
      rawIssuesUrl: isIssueReportArtifactIndex(params.index)
        ? null
        : params.index.rawIssuesFile?.url ?? null,
      preferredCsvUrl,
      packetRootUrl,
      csvRootUrl,
      packetBaseUrl,
      csvBaseUrl,
      packetSummaryUrl,
      packetManifestUrl,
      packetArtifactUrl,
      csvArtifactUrl,
    },
    publishGateSummary: params.index.publishGateSummary,
    publishGateHotspots: params.index.publishGateHotspots as IssueReportSummaryIndexPublishGateHotspot[],
    topDistricts: isIssueReportArtifactIndex(params.index)
      ? params.index.topDistricts
      : params.index.topDistricts,
    topSegments,
    topReasons,
    csvExports: normalizedCsvExports,
  }
}

const renderIssueReportArtifactSummaryFromJson = (
  summaryJson: IssueReportArtifactSummaryJsonOutput,
  options: IssueReportArtifactSummaryOptions = {},
) => {
  const topCount = options.topCount ?? summaryJson.topCount ?? 5
  const titleLabel = options.label ?? summaryJson.label
  const titlePrefix = titleLabel ? `${titleLabel} ` : ''
  const inputArtifactType =
    options.inputArtifactType ?? summaryJson.inputArtifactType
  const inputUrl = options.inputUrl ?? summaryJson.inputUrl
  const publishGateSummaryUrl =
    options.publishGateSummaryUrl ?? summaryJson.publishGateSummaryUrl
  const hasWorkflowEntries =
    summaryJson.summaryEntries.workflowSummaryRelativePath !== null
  const {
    packetRootUrl,
    csvRootUrl,
    packetBaseUrl: legacyPacketBaseUrl,
    csvBaseUrl: legacyCsvBaseUrl,
    packetArtifactUrl: legacyPacketArtifactUrl,
    csvArtifactUrl: legacyCsvArtifactUrl,
  } = resolveIssueReportArtifactLinkRootUrls(summaryJson.artifactLinks)
  const { packetSummaryUrl, packetManifestUrl } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl,
    csvRootUrl,
    preferredCsvUrl: summaryJson.artifactLinks.preferredCsvUrl,
    preferredCsvRelativePath: summaryJson.summaryEntries.preferredCsvRelativePath,
    packetSummaryUrl: summaryJson.artifactLinks.packetSummaryUrl,
    packetSummaryRelativePath: summaryJson.summaryEntries.packetSummaryRelativePath,
    packetManifestUrl: summaryJson.artifactLinks.packetManifestUrl,
    packetManifestRelativePath: summaryJson.summaryEntries.packetManifestRelativePath,
  })
  const preferredCsvExport = pickPreferredCsvExport(summaryJson.csvExports)
  const preferredCsvRelativePath =
    summaryJson.summaryEntries.preferredCsvRelativePath
    ?? preferredCsvExport?.relativePath
    ?? null
  const preferredCsvUrl =
    summaryJson.artifactLinks.preferredCsvUrl
    ?? preferredCsvExport?.url
    ?? null

  const lines = [
    `# ${titlePrefix}Issue Artifact Summary`,
    '',
    `Input surface: ${inputArtifactType}`,
    `Manifest schema: ${summaryJson.resolvedIndexArtifactType} v${summaryJson.resolvedIndexSchemaVersion}`,
    `Matching issue reports: ${summaryJson.matchingIssueReports.filteredCount} / ${summaryJson.matchingIssueReports.totalCount}`,
    `Linked publish gate hotspots: ${summaryJson.linkedPublishGateHotspots.linkedCount} / ${summaryJson.linkedPublishGateHotspots.totalCount}`,
    `Packet entries: ${summaryJson.packetEntries.segmentCount} segments / ${summaryJson.packetEntries.reasonCount} reasons`,
    `Issue input: ${renderLink('download artifact', inputUrl)}`,
  ]

  if (hasWorkflowEntries) {
    lines.push(
      `Workflow summary entry: ${summaryJson.summaryEntries.workflowSummaryRelativePath ?? '-'}`,
      `Workflow summary URL: ${renderLink('download artifact', summaryJson.artifactLinks.summaryUrl)}`,
      `Issue index summary entry: ${summaryJson.summaryEntries.indexSummaryRelativePath ?? '-'}`,
      `Issue index summary URL: ${renderLink('download artifact', summaryJson.artifactLinks.indexSummaryUrl)}`,
      `Issue index summary json entry: ${summaryJson.summaryEntries.indexSummaryJsonRelativePath ?? '-'}`,
      `Issue index summary json URL: ${renderLink('download artifact', summaryJson.artifactLinks.indexSummaryJsonUrl)}`,
      `Issue index surface entry: ${summaryJson.summaryEntries.indexSurfaceRelativePath ?? '-'}`,
      `Issue index surface URL: ${renderLink('download artifact', summaryJson.artifactLinks.indexSurfaceUrl)}`,
      `Issue artifact index entry: ${summaryJson.summaryEntries.artifactIndexRelativePath ?? '-'}`,
      `Issue artifact index URL: ${renderLink('download artifact', summaryJson.artifactLinks.artifactIndexUrl)}`,
      `Packet summary entry: ${summaryJson.summaryEntries.packetSummaryRelativePath ?? '-'}`,
      `Packet summary URL: ${renderLink('download artifact', packetSummaryUrl)}`,
      `Packet manifest entry: ${summaryJson.summaryEntries.packetManifestRelativePath ?? '-'}`,
      `Packet manifest URL: ${renderLink('download artifact', packetManifestUrl)}`,
      `Publish gate summary: ${renderLink('download artifact', publishGateSummaryUrl)}`,
      `Preferred CSV join file: ${preferredCsvRelativePath ?? '-'}`,
      `Preferred CSV join file URL: ${renderLink('download artifact', preferredCsvUrl)}`,
      `Packet root URL: ${renderLink('download artifact', packetRootUrl)}`,
      `CSV exchange root URL: ${renderLink('download artifact', csvRootUrl)}`,
    )
    if (legacyPacketArtifactUrl) {
      lines.push(
        `Legacy packet artifact URL: ${renderLink('download artifact', legacyPacketArtifactUrl)}`,
      )
    }
    if (legacyPacketBaseUrl) {
      lines.push(
        `Legacy packet base URL: ${renderLink('download artifact', legacyPacketBaseUrl)}`,
      )
    }
    if (legacyCsvArtifactUrl) {
      lines.push(
        `Legacy CSV artifact URL: ${renderLink('download artifact', legacyCsvArtifactUrl)}`,
      )
    }
    if (legacyCsvBaseUrl) {
      lines.push(
        `Legacy CSV base URL: ${renderLink('download artifact', legacyCsvBaseUrl)}`,
      )
    }
    } else {
      lines.push(
        `Issue index summary entry: ${summaryJson.summaryEntries.indexSummaryRelativePath ?? '-'}`,
        `Issue index summary URL: ${renderLink('download artifact', summaryJson.artifactLinks.indexSummaryUrl)}`,
        `Issue index summary json entry: ${summaryJson.summaryEntries.indexSummaryJsonRelativePath ?? '-'}`,
        `Issue index summary json URL: ${renderLink('download artifact', summaryJson.artifactLinks.indexSummaryJsonUrl)}`,
        `Issue index surface entry: ${summaryJson.summaryEntries.indexSurfaceRelativePath ?? '-'}`,
        `Issue index surface URL: ${renderLink('download artifact', summaryJson.artifactLinks.indexSurfaceUrl)}`,
        `Issue artifact index entry: ${summaryJson.summaryEntries.artifactIndexRelativePath ?? '-'}`,
        `Issue artifact index URL: ${renderLink('download artifact', summaryJson.artifactLinks.artifactIndexUrl)}`,
        `Manual artifacts manifest entry: ${summaryJson.summaryEntries.manualManifestRelativePath ?? '-'}`,
        `Source summary entry: ${summaryJson.summaryEntries.sourceSummaryRelativePath ?? '-'}`,
        `Raw issues entry: ${summaryJson.summaryEntries.rawIssuesRelativePath ?? '-'}`,
        `Packet summary entry: ${summaryJson.summaryEntries.packetSummaryRelativePath ?? '-'}`,
        `Packet summary URL: ${renderLink('download artifact', packetSummaryUrl)}`,
        `Packet manifest entry: ${summaryJson.summaryEntries.packetManifestRelativePath ?? '-'}`,
        `Packet manifest URL: ${renderLink('download artifact', packetManifestUrl)}`,
        `Publish gate summary: ${renderLink('download artifact', publishGateSummaryUrl)}`,
        `Preferred CSV join file: ${preferredCsvRelativePath ?? '-'}`,
        `Preferred CSV join file URL: ${renderLink('download artifact', preferredCsvUrl)}`,
        `Packet root URL: ${renderLink('download artifact', packetRootUrl)}`,
        `CSV exchange root URL: ${renderLink('download artifact', csvRootUrl)}`,
      )
      if (legacyPacketArtifactUrl) {
        lines.push(
          `Legacy packet artifact URL: ${renderLink('download artifact', legacyPacketArtifactUrl)}`,
        )
      }
      if (legacyPacketBaseUrl) {
        lines.push(
          `Legacy packet base URL: ${renderLink('download artifact', legacyPacketBaseUrl)}`,
        )
      }
      if (legacyCsvArtifactUrl) {
        lines.push(
          `Legacy CSV artifact URL: ${renderLink('download artifact', legacyCsvArtifactUrl)}`,
        )
      }
      if (legacyCsvBaseUrl) {
        lines.push(
          `Legacy CSV base URL: ${renderLink('download artifact', legacyCsvBaseUrl)}`,
        )
      }
      if (summaryJson.artifactLinks.manualManifestUrl) {
        lines.push(
          `Manual artifacts manifest URL: ${renderLink('download artifact', summaryJson.artifactLinks.manualManifestUrl)}`,
        )
      }
      if (summaryJson.summaryEntries.manualManifestRelativePath) {
        lines.push(
          `Preferred portable input: ${summaryJson.summaryEntries.manualManifestRelativePath}`,
        )
      }
      if (summaryJson.artifactLinks.manualManifestUrl) {
        lines.push(
          `Preferred portable input URL: ${renderLink('download artifact', summaryJson.artifactLinks.manualManifestUrl)}`,
        )
      }
      if (summaryJson.summaryEntries.artifactIndexRelativePath) {
        lines.push(
          `Fallback compatibility input: ${summaryJson.summaryEntries.artifactIndexRelativePath}`,
        )
      }
      if (summaryJson.artifactLinks.artifactIndexUrl) {
        lines.push(
          `Fallback compatibility input URL: ${renderLink('download artifact', summaryJson.artifactLinks.artifactIndexUrl)}`,
        )
      }
      if (summaryJson.artifactLinks.sourceSummaryUrl) {
        lines.push(
          `Source summary URL: ${renderLink('download artifact', summaryJson.artifactLinks.sourceSummaryUrl)}`,
        )
      }
      if (summaryJson.artifactLinks.rawIssuesUrl) {
        lines.push(
          `Raw issues URL: ${renderLink('download artifact', summaryJson.artifactLinks.rawIssuesUrl)}`,
        )
      }
    }

  if (summaryJson.publishGateSummary) {
    lines.push('')
    lines.push('## Publish Gate')
    lines.push('')
    lines.push('| Mode | Exit code | INFO | WARN | FAIL | Allow fail | Override reason |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    lines.push(
      `| ${summaryJson.publishGateSummary.mode} | ${summaryJson.publishGateSummary.exitCode} | ${summaryJson.publishGateSummary.totals.info} | ${summaryJson.publishGateSummary.totals.warn} | ${summaryJson.publishGateSummary.totals.fail} | ${summaryJson.publishGateSummary.allowFail ? 'yes' : 'no'} | ${escapeCell(summaryJson.publishGateSummary.overrideReason ?? '-')} |`,
    )
  }

  if (summaryJson.publishGateHotspots.length > 0) {
    lines.push('')
    lines.push('## Publish Gate Hotspots')
    lines.push('')
    lines.push(
      '| District | WARN | FAIL | Direct overrides | Spatial overrides | Unmatched named | Top issue hotspot | Packet |',
    )
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    summaryJson.publishGateHotspots.slice(0, topCount).forEach((hotspot) => {
      lines.push(
        `| ${hotspot.districtId} | ${hotspot.warn} | ${hotspot.fail} | ${hotspot.directOverrideMatches ?? '-'} | ${hotspot.spatialOverrideMatches ?? '-'} | ${hotspot.unmatchedNamedOverrides ?? '-'} | ${escapeCell(hotspot.issueHotspotSegmentLabel ?? '-')} | ${hotspot.issueHotspotPacketUrl ?? hotspot.issueHotspotPacketPath ?? '-'} |`,
      )
    })
  }

  const topDistricts = summaryJson.topDistricts
  if (topDistricts.length > 0) {
    lines.push('')
    lines.push('## Top Issue Districts')
    lines.push('')
    lines.push('| Scope | District | Count | Latest | Latest summary |')
    lines.push('| --- | --- | --- | --- | --- |')
    topDistricts.slice(0, topCount).forEach((district) => {
      lines.push(
        `| ${district.scope} | ${district.districtId} | ${district.count} | ${formatOptionalText(district.latestCreatedAt)} | ${escapeCell(district.latestSummary ?? '-')} |`,
      )
    })
  }

  if (summaryJson.topSegments.length > 0) {
      lines.push('')
      lines.push('## Top Issue Segments')
      lines.push('')
      lines.push('| District | Segment | Count | Tier | Latest | Latest summary | Packet |')
      lines.push('| --- | --- | --- | --- | --- | --- | --- |')
      lines.push(...renderSummarySegmentRows(summaryJson.topSegments.slice(0, topCount)))
  }

  if (summaryJson.topReasons.length > 0) {
      lines.push('')
      lines.push('## Top Issue Reasons')
      lines.push('')
      lines.push('| Reason | Count | Districts | Segments | Latest segment | Latest | Packet |')
      lines.push('| --- | --- | --- | --- | --- | --- | --- |')
      lines.push(...renderSummaryReasonRows(summaryJson.topReasons.slice(0, topCount)))
  }

  const csvExports = prioritizeCsvExports(summaryJson.csvExports)
  if (csvExports.length > 0) {
    lines.push('')
    lines.push('## CSV Exports')
    lines.push('')
    lines.push('| File | URL |')
    lines.push('| --- | --- |')
    csvExports.slice(0, topCount).forEach((entry) => {
      const fileName = 'fileName' in entry ? entry.fileName : entry.relativePath
      lines.push(`| ${fileName} | ${entry.url ?? entry.path} |`)
    })
  }

  return lines.join('\n')
}

const renderIssueReportArtifactSummaryFromSurface = (
  surface: IssueReportArtifactSummarySurfaceSummary,
  options: IssueReportArtifactSummaryOptions = {},
) => {
  const topCount = options.topCount ?? surface.topCount ?? 5
  const titleLabel = options.label ?? surface.label
  const titlePrefix = titleLabel ? `${titleLabel} ` : ''
  const inputArtifactType =
    options.inputArtifactType ?? surface.artifactType
  const inputUrl = options.inputUrl
  const publishGateSummaryUrl = options.publishGateSummaryUrl
  const {
    packetRootUrl,
    csvRootUrl,
    packetBaseUrl: legacyPacketBaseUrl,
    csvBaseUrl: legacyCsvBaseUrl,
    packetArtifactUrl: legacyPacketArtifactUrl,
    csvArtifactUrl: legacyCsvArtifactUrl,
  } = resolveIssueReportArtifactSurfaceRootUrls(surface)
  const { packetSummaryUrl, packetManifestUrl } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl,
    csvRootUrl,
    preferredCsvUrl: surface.preferredCsvUrl,
    preferredCsvRelativePath: surface.preferredCsvRelativePath,
    packetSummaryUrl: surface.packetSummaryUrl,
    packetSummaryRelativePath: surface.packetSummaryRelativePath,
    packetManifestUrl: surface.packetManifestUrl,
    packetManifestRelativePath: surface.packetManifestRelativePath,
  })
  const lines = [
    `# ${titlePrefix}Issue Artifact Summary`,
    '',
    `Input surface: ${inputArtifactType}`,
    `Source summary surface: ${surface.sourceArtifactType} v${surface.sourceSchemaVersion}`,
    `Source input surface: ${surface.inputArtifactType}`,
    `Resolved index surface: ${surface.resolvedIndexArtifactType} v${surface.resolvedIndexSchemaVersion}`,
    `Matching issue reports: ${surface.filteredCount} / ${surface.totalCount}`,
    `Linked publish gate hotspots: ${surface.linkedPublishGateHotspotCount} / ${surface.totalPublishGateHotspotCount}`,
    `Packet entries: ${surface.segmentPacketCount} segments / ${surface.reasonPacketCount} reasons`,
    `CSV exports: ${surface.csvCount}`,
    `Issue input: ${renderLink('download artifact', inputUrl)}`,
    `Summary surface path: ${surface.summaryPath}`,
  ]

  if (surface.publishGateSummary) {
    lines.push('')
    lines.push('## Publish Gate')
    lines.push('')
    lines.push('| Mode | Exit code | INFO | WARN | FAIL |')
    lines.push('| --- | --- | --- | --- | --- |')
    lines.push(
      `| ${surface.publishGateSummary.mode} | ${surface.publishGateSummary.exitCode} | ${surface.publishGateSummary.info} | ${surface.publishGateSummary.warn} | ${surface.publishGateSummary.fail} |`,
    )
  }

  if (surface.topPublishGateHotspots.length > 0) {
    lines.push('')
    lines.push('## Publish Gate Hotspots')
    lines.push('')
    lines.push(
      '| District | WARN | FAIL | Direct overrides | Spatial overrides | Unmatched named | Top issue hotspot | Packet |',
    )
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    surface.topPublishGateHotspots.slice(0, topCount).forEach((hotspot) => {
      lines.push(
        `| ${hotspot.districtId} | ${hotspot.warn} | ${hotspot.fail} | ${hotspot.directOverrideMatches ?? '-'} | ${hotspot.spatialOverrideMatches ?? '-'} | ${hotspot.unmatchedNamedOverrides ?? '-'} | ${escapeCell(hotspot.issueHotspotSegmentLabel ?? '-')} | ${hotspot.issueHotspotPacketUrl ?? hotspot.issueHotspotPacketPath ?? '-'} |`,
      )
    })
  }

  if (surface.topDistricts.length > 0) {
    lines.push('')
    lines.push('## Top Issue Districts')
    lines.push('')
    lines.push('| Scope | District | Count | Latest | Latest summary |')
    lines.push('| --- | --- | --- | --- | --- |')
    surface.topDistricts.slice(0, topCount).forEach((district) => {
      lines.push(
        `| ${district.scope} | ${district.districtId} | ${district.count} | ${formatOptionalText(district.latestCreatedAt)} | ${escapeCell(district.latestSummary ?? '-')} |`,
      )
    })
  }

  if (surface.topSegments.length > 0) {
    lines.push('')
    lines.push('## Top Issue Segments')
    lines.push('')
    lines.push('| Scope | District | Segment | Count | Tier | Latest | Latest summary | Packet |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    surface.topSegments.slice(0, topCount).forEach((segment) => {
      lines.push(
        `| ${segment.scope} | ${segment.districtId} | ${escapeCell(segment.segmentLabel)} | ${segment.count} | ${formatOptionalText(segment.segmentTier)} | ${formatOptionalText(segment.latestCreatedAt)} | ${escapeCell(segment.latestSummary ?? '-')} | ${segment.packetUrl ?? segment.packetPath ?? '-'} |`,
      )
    })
  }

  if (surface.topReasons.length > 0) {
    lines.push('')
    lines.push('## Top Issue Reasons')
    lines.push('')
    lines.push('| Reason | Count | Districts | Segments | Latest | Latest location | Packet |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    surface.topReasons.slice(0, topCount).forEach((reason) => {
      const latestLocation =
        reason.latestSegmentName && reason.latestSegmentId
          ? `${reason.latestDistrictId ?? '-'} / ${reason.latestSegmentName} (${reason.latestSegmentId})`
          : reason.latestSegmentId
            ? `${reason.latestDistrictId ?? '-'} / ${reason.latestSegmentId}`
            : reason.latestDistrictId ?? '-'
      lines.push(
        `| ${reason.reasonCode} | ${reason.count} | ${reason.districtCount} | ${reason.segmentCount} | ${formatOptionalText(reason.latestCreatedAt)} | ${escapeCell(latestLocation)} | ${reason.packetUrl ?? reason.packetPath ?? '-'} |`,
      )
    })
  }

  const summaryEntries = [
    ['Packet root entry', surface.packetRootRelativePath],
    ['CSV root entry', surface.csvRootRelativePath],
    ['Workflow summary entry', surface.workflowSummaryRelativePath],
    ['Index summary entry', surface.indexSummaryRelativePath],
    ['Index summary json entry', surface.indexSummaryJsonRelativePath],
    ['Index surface entry', surface.indexSurfaceRelativePath],
    ['Artifact index entry', surface.artifactIndexRelativePath],
    ['Source summary entry', surface.sourceSummaryRelativePath],
    ['Raw issues entry', surface.rawIssuesRelativePath],
    ['Packet summary entry', surface.packetSummaryRelativePath],
    ['Packet manifest entry', surface.packetManifestRelativePath],
  ].filter(([, value]) => value !== null) as Array<[string, string]>

  if (
    summaryEntries.length > 0 ||
    surface.packetRootPath ||
    surface.csvRootPath ||
    publishGateSummaryUrl ||
    packetRootUrl ||
    csvRootUrl ||
    legacyPacketBaseUrl ||
    legacyCsvBaseUrl ||
    legacyPacketArtifactUrl ||
    legacyCsvArtifactUrl
  ) {
    lines.push('')
    lines.push('## Artifact Entries')
    lines.push('')
    if (surface.packetRootPath) {
      lines.push(`Packet root: ${surface.packetRootPath}`)
    }
    if (surface.csvRootPath) {
      lines.push(`CSV exchange root: ${surface.csvRootPath}`)
    }
    if (packetRootUrl) {
      lines.push(
        `Packet root URL: ${renderLink(
          'download artifact',
          packetRootUrl,
        )}`,
      )
    }
    if (csvRootUrl) {
      lines.push(
        `CSV exchange root URL: ${renderLink(
          'download artifact',
          csvRootUrl,
        )}`,
      )
    }
    if (legacyPacketArtifactUrl) {
      lines.push(
        `Legacy packet artifact URL: ${renderLink(
          'download artifact',
          legacyPacketArtifactUrl,
        )}`,
      )
    }
    if (legacyPacketBaseUrl) {
      lines.push(
        `Legacy packet base URL: ${renderLink(
          'download artifact',
          legacyPacketBaseUrl,
        )}`,
      )
    }
    if (legacyCsvArtifactUrl) {
      lines.push(
        `Legacy CSV artifact URL: ${renderLink(
          'download artifact',
          legacyCsvArtifactUrl,
        )}`,
      )
    }
    if (legacyCsvBaseUrl) {
      lines.push(
        `Legacy CSV base URL: ${renderLink(
          'download artifact',
          legacyCsvBaseUrl,
        )}`,
      )
    }
    summaryEntries.forEach(([label, value]) => {
      lines.push(`${label}: ${value}`)
    })
    if (surface.workflowSummaryUrl) {
      lines.push(
        `Workflow summary URL: ${renderLink('download artifact', surface.workflowSummaryUrl)}`,
      )
    }
    if (surface.indexSummaryUrl) {
      lines.push(
        `Index summary URL: ${renderLink('download artifact', surface.indexSummaryUrl)}`,
      )
    }
    if (surface.indexSummaryJsonUrl) {
      lines.push(
        `Index summary json URL: ${renderLink('download artifact', surface.indexSummaryJsonUrl)}`,
      )
    }
    if (surface.indexSurfaceUrl) {
      lines.push(
        `Index surface URL: ${renderLink('download artifact', surface.indexSurfaceUrl)}`,
      )
    }
    if (surface.manualManifestRelativePath) {
      lines.push(`Manual artifacts manifest entry: ${surface.manualManifestRelativePath}`)
      lines.push(`Preferred portable input: ${surface.manualManifestRelativePath}`)
    }
    if (surface.manualManifestUrl) {
      lines.push(
        `Manual artifacts manifest URL: ${renderLink('download artifact', surface.manualManifestUrl)}`,
      )
      lines.push(
        `Preferred portable input URL: ${renderLink('download artifact', surface.manualManifestUrl)}`,
      )
    }
    if (surface.artifactIndexRelativePath) {
      lines.push(`Fallback compatibility input: ${surface.artifactIndexRelativePath}`)
    }
    if (surface.artifactIndexUrl) {
      lines.push(
        `Fallback compatibility input URL: ${renderLink('download artifact', surface.artifactIndexUrl)}`,
      )
    }
    if (publishGateSummaryUrl) {
      lines.push(
        `Publish gate summary: ${renderLink('download artifact', publishGateSummaryUrl)}`,
      )
    }
    if (surface.sourceSummaryUrl) {
      lines.push(
        `Source summary URL: ${renderLink('download artifact', surface.sourceSummaryUrl)}`,
      )
    }
    if (surface.rawIssuesUrl) {
      lines.push(`Raw issues URL: ${renderLink('download artifact', surface.rawIssuesUrl)}`)
    }
    if (surface.preferredCsvRelativePath) {
      lines.push(`Preferred CSV join file: ${surface.preferredCsvRelativePath}`)
    }
    if (surface.preferredCsvUrl) {
      lines.push(
        `Preferred CSV join file URL: ${renderLink('download artifact', surface.preferredCsvUrl)}`,
      )
    }
    if (packetSummaryUrl) {
      lines.push(`Packet summary URL: ${renderLink('download artifact', packetSummaryUrl)}`)
    }
    if (packetManifestUrl) {
      lines.push(`Packet manifest URL: ${renderLink('download artifact', packetManifestUrl)}`)
    }
  }

  return lines.join('\n')
}

const renderIssueReportArtifactSummary = (
  index: IssueReportArtifactSummaryInput,
  options: IssueReportArtifactSummaryOptions = {},
) => {
  if (isIssueReportArtifactSummarySurface(index)) {
    return renderIssueReportArtifactSummaryFromSurface(index, options)
  }
  const summaryJson = buildIssueReportArtifactSummaryJsonOutput({
    index,
    options: {
      ...options,
      topCount: options.topCount ?? 5,
    },
  })
  return renderIssueReportArtifactSummaryFromJson(summaryJson, options)
}

const renderIssueReportArtifactSummaryWriteResult = (
  outPath: string,
  index: IssueReportArtifactSummaryInput,
  options: IssueReportArtifactSummaryOptions = {},
) => [
  `Wrote issue report artifact summary to ${outPath}`,
  '',
  renderIssueReportArtifactSummary(index, options),
].join('\n')

const resolveIssueReportArtifactSummaryOutPath = (
  index: IssueReportArtifactSummaryInput,
  options: Pick<IssueReportArtifactSummaryOptions, never> & {
    outPath: string | null
    json: boolean
    writeIndexSummary: boolean
  },
) => {
  if (options.outPath) {
    return options.outPath
  }
  if (options.writeIndexSummary && isIssueReportArtifactIndex(index)) {
    return options.json
      ? index.rootManifest.indexSummaryJsonPath
      : index.rootManifest.indexSummaryPath
  }
  if (options.writeIndexSummary && isIssueReportArtifactSummarySurface(index)) {
    const bundleRoot = dirname(index.summaryPath)
    const relativePath = options.json
      ? index.indexSurfaceRelativePath ?? 'index-surface.json'
      : index.indexSummaryRelativePath ?? 'index-summary.md'
    return resolve(bundleRoot, relativePath)
  }
  if (options.writeIndexSummary && index.artifactType === 'issue-report-summary-index') {
    return options.json
      ? resolveIssueReportManualSidecarPath(
          index.indexFile?.path ?? null,
          ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
        )
      : resolveIssueReportManualSidecarPath(
          index.indexFile?.path ?? null,
          ISSUE_REPORT_MANUAL_INDEX_SUMMARY_PATH,
        )
  }
  return null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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

const loadPreferredManualIssueReportArtifactSummaryInput = async (
  index: IssueReportSummaryIndexOutput,
  inputArtifactType:
    | 'issue-report-summary-artifacts'
    | 'issue-report-summary-index'
    | 'issue-report-summary-json',
): Promise<{
  index: IssueReportArtifactSummaryInput
  inputArtifactType: IssueReportArtifactSummaryInputArtifactType
}> => {
  const manualManifestPath =
    index.manualManifestFile?.path
    ?? resolveIssueReportManualArtifactsManifestPath(index.indexFile?.path ?? null)
  let parsedManualManifest: IssueReportSummaryArtifactsManifest | null = null
  if (await pathExists(manualManifestPath)) {
    const parsedManifest = JSON.parse(await readFile(manualManifestPath!, 'utf8')) as {
      artifactType?: string
    }
    if (isIssueReportSummaryArtifactsManifest(parsedManifest)) {
      parsedManualManifest = parsedManifest
      const manifestIndexSurfacePath = resolveIssueReportArtifactEntryPath(
        manualManifestPath!,
        parsedManifest.indexSurfaceRelativePath,
        parsedManifest.indexSurfacePath,
      )
      if (await pathExists(manifestIndexSurfacePath)) {
        return {
          index: applyIssueReportManualManifestPreferredCsvToSurfaceSummary(
            parseIssueReportArtifactSummarySurfaceSummary(
              JSON.parse(await readFile(manifestIndexSurfacePath!, 'utf8')),
            ),
            parsedManifest,
          ),
          inputArtifactType,
        }
      }

      const manifestIndexSummaryJsonPath = resolveIssueReportArtifactEntryPath(
        manualManifestPath!,
        parsedManifest.indexSummaryJsonRelativePath,
        parsedManifest.indexSummaryJsonPath,
      )
      if (await pathExists(manifestIndexSummaryJsonPath)) {
        return {
          index: applyIssueReportManualManifestPreferredCsvToSummaryJson(
            parseIssueReportArtifactSummaryJsonOutput(
              JSON.parse(await readFile(manifestIndexSummaryJsonPath!, 'utf8')),
            ),
            parsedManifest,
          ),
          inputArtifactType,
        }
      }
    }
  }

  const indexSurfacePath = resolveIssueReportManualSidecarPath(
    index.indexFile?.path ?? null,
    ISSUE_REPORT_MANUAL_INDEX_SURFACE_PATH,
  )
  if (await pathExists(indexSurfacePath)) {
    return {
      index: parsedManualManifest
        ? applyIssueReportManualManifestPreferredCsvToSurfaceSummary(
            parseIssueReportArtifactSummarySurfaceSummary(
              JSON.parse(await readFile(indexSurfacePath!, 'utf8')),
            ),
            parsedManualManifest,
          )
        : parseIssueReportArtifactSummarySurfaceSummary(
            JSON.parse(await readFile(indexSurfacePath!, 'utf8')),
          ),
      inputArtifactType,
    }
  }

  const indexSummaryJsonPath = resolveIssueReportManualSidecarPath(
    index.indexFile?.path ?? null,
    ISSUE_REPORT_MANUAL_INDEX_SUMMARY_JSON_PATH,
  )
  if (await pathExists(indexSummaryJsonPath)) {
    return {
      index: parsedManualManifest
        ? applyIssueReportManualManifestPreferredCsvToSummaryJson(
            parseIssueReportArtifactSummaryJsonOutput(
              JSON.parse(await readFile(indexSummaryJsonPath!, 'utf8')),
            ),
            parsedManualManifest,
          )
        : parseIssueReportArtifactSummaryJsonOutput(
            JSON.parse(await readFile(indexSummaryJsonPath!, 'utf8')),
          ),
      inputArtifactType,
    }
  }

  return {
    index: parsedManualManifest
      ? applyIssueReportManualManifestPreferredCsvToSummaryIndex(index, parsedManualManifest)
      : index,
    inputArtifactType,
  }
}

const parseIssueReportArtifactSummaryJsonOutput = (
  value: unknown,
): IssueReportArtifactSummaryJsonOutput => {
  if (!isRecord(value)) {
    throw new Error('issue report artifact summary json must be an object')
  }
  if (value.artifactType !== 'issue-report-artifact-summary-json') {
    throw new Error(
      'issue report artifact summary json must have artifactType issue-report-artifact-summary-json',
    )
  }
  if (value.schemaVersion !== ISSUE_REPORT_ARTIFACT_SUMMARY_JSON_SCHEMA_VERSION) {
    throw new Error(
      `issue report artifact summary json schemaVersion must be ${ISSUE_REPORT_ARTIFACT_SUMMARY_JSON_SCHEMA_VERSION}`,
    )
  }
  const output = value as IssueReportArtifactSummaryJsonOutput
  const {
    packetRootUrl,
    csvRootUrl,
    packetBaseUrl,
    csvBaseUrl,
    packetArtifactUrl,
    csvArtifactUrl,
  } = resolveIssueReportArtifactLinkRootUrls(output.artifactLinks)
  const {
    preferredCsvUrl,
    packetSummaryUrl,
    packetManifestUrl,
  } = resolveIssueReportArtifactBundleUrls({
    packetRootUrl,
    csvRootUrl,
    preferredCsvUrl: output.artifactLinks.preferredCsvUrl,
    preferredCsvRelativePath: output.summaryEntries.preferredCsvRelativePath,
    packetSummaryUrl: output.artifactLinks.packetSummaryUrl,
    packetSummaryRelativePath: output.summaryEntries.packetSummaryRelativePath,
    packetManifestUrl: output.artifactLinks.packetManifestUrl,
    packetManifestRelativePath: output.summaryEntries.packetManifestRelativePath,
  })

  return {
    ...output,
    artifactLinks: {
      ...output.artifactLinks,
      packetRootUrl,
      csvRootUrl,
      packetBaseUrl,
      csvBaseUrl,
      packetArtifactUrl,
      csvArtifactUrl,
      preferredCsvUrl,
      packetSummaryUrl,
      packetManifestUrl,
    },
  }
}

const parseIssueReportArtifactSummarySurfaceSummary = (
  value: unknown,
): IssueReportArtifactSummarySurfaceSummary => {
  if (!isRecord(value)) {
    throw new Error('issue report artifact summary surface must be an object')
  }
  if (value.artifactType !== 'issue-report-artifact-summary-surface') {
    throw new Error(
      'issue report artifact summary surface must have artifactType issue-report-artifact-summary-surface',
    )
  }
  if (value.schemaVersion !== ISSUE_REPORT_ARTIFACT_SUMMARY_SURFACE_SCHEMA_VERSION) {
    throw new Error(
      `issue report artifact summary surface schemaVersion must be ${ISSUE_REPORT_ARTIFACT_SUMMARY_SURFACE_SCHEMA_VERSION}`,
    )
  }
  const summary = value as IssueReportArtifactSummarySurfaceSummary
  const {
    packetRootUrl,
    csvRootUrl,
    packetBaseUrl,
    csvBaseUrl,
    packetArtifactUrl,
    csvArtifactUrl,
  } = resolveIssueReportArtifactSurfaceRootUrls(summary)
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

  return {
    ...summary,
    packetRootUrl,
    csvRootUrl,
    packetBaseUrl,
    csvBaseUrl,
    packetArtifactUrl,
    csvArtifactUrl,
    preferredCsvUrl,
    packetSummaryUrl,
    packetManifestUrl,
  }
}

const loadIssueReportArtifactSummaryInput = async (
  indexPath: string,
  cwd = process.cwd(),
): Promise<IssueReportArtifactSummaryInput> => {
  const loaded = await loadIssueReportArtifactSummaryInputDetails(indexPath, cwd)
  return loaded.index
}

const loadIssueReportArtifactSummaryInputDetails = async (
  indexPath: string,
  cwd = process.cwd(),
): Promise<{
  index: IssueReportArtifactSummaryInput
  inputArtifactType: IssueReportArtifactSummaryInputArtifactType
}> => {
  const resolvedPath = resolve(cwd, indexPath)
  const parsed = JSON.parse(await readFile(resolvedPath, 'utf8')) as { artifactType?: string }
  if (isIssueReportWorkflowArtifactsManifest(parsed)) {
    const indexSurfacePath = resolveIssueReportWorkflowArtifactEntryPath(
      resolvedPath,
      parsed.indexSurfaceRelativePath,
      parsed.indexSurfacePath,
    )

    if (await pathExists(indexSurfacePath)) {
      return {
        index: parseIssueReportArtifactSummarySurfaceSummary(
          JSON.parse(await readFile(indexSurfacePath, 'utf8')),
        ),
        inputArtifactType: 'issue-report-workflow-artifacts',
      }
    }

    const artifactIndexPath = resolveIssueReportWorkflowArtifactEntryPath(
      resolvedPath,
      parsed.artifactIndexRelativePath,
      parsed.artifactIndexPath,
    )

    if (await pathExists(artifactIndexPath)) {
      return {
        index: await loadIssueReportArtifactIndex(artifactIndexPath, cwd),
        inputArtifactType: 'issue-report-workflow-artifacts',
      }
    }

    return {
      index: await buildIssueReportArtifactIndex(indexPath, cwd),
      inputArtifactType: 'issue-report-workflow-artifacts',
    }
  }
  if (isIssueReportSummaryArtifactsManifest(parsed)) {
    const artifactIndexPath = resolveIssueReportArtifactEntryPath(
      resolvedPath,
      parsed.artifactIndexRelativePath,
      parsed.artifactIndexPath,
    )
    if (await pathExists(artifactIndexPath)) {
      const loaded = await loadIssueReportArtifactSummaryInputDetails(artifactIndexPath, cwd)
      return {
        index: loaded.index,
        inputArtifactType: 'issue-report-summary-artifacts',
      }
    }

    const sourceSummaryPath = resolveIssueReportArtifactEntryPath(
      resolvedPath,
      parsed.sourceSummaryRelativePath,
      parsed.sourceSummaryPath,
    )
    if (await pathExists(sourceSummaryPath)) {
      const loaded = await loadIssueReportArtifactSummaryInputDetails(sourceSummaryPath, cwd)
      return {
        index: loaded.index,
        inputArtifactType: 'issue-report-summary-artifacts',
      }
    }

    const indexSummaryJsonPath = resolveIssueReportArtifactEntryPath(
      resolvedPath,
      parsed.indexSummaryJsonRelativePath,
      parsed.indexSummaryJsonPath,
    )
    if (await pathExists(indexSummaryJsonPath)) {
      return {
        index: applyIssueReportManualManifestPreferredCsvToSummaryJson(
          parseIssueReportArtifactSummaryJsonOutput(
            JSON.parse(await readFile(indexSummaryJsonPath!, 'utf8')),
          ),
          parsed,
        ),
        inputArtifactType: 'issue-report-summary-artifacts',
      }
    }

    const indexSurfacePath = resolveIssueReportArtifactEntryPath(
      resolvedPath,
      parsed.indexSurfaceRelativePath,
      parsed.indexSurfacePath,
    )
    if (await pathExists(indexSurfacePath)) {
      return {
        index: applyIssueReportManualManifestPreferredCsvToSurfaceSummary(
          parseIssueReportArtifactSummarySurfaceSummary(
            JSON.parse(await readFile(indexSurfacePath!, 'utf8')),
          ),
          parsed,
        ),
        inputArtifactType: 'issue-report-summary-artifacts',
      }
    }

    throw new Error(
      'issue report summary artifacts manifest is missing its canonical summary/index sidecars',
    )
  }
  if (parsed.artifactType === 'issue-report-artifact-index') {
    return {
      index: parseIssueReportArtifactIndex(parsed),
      inputArtifactType: 'issue-report-artifact-index',
    }
  }
  if (parsed.artifactType === 'issue-report-summary-index') {
    return loadPreferredManualIssueReportArtifactSummaryInput(
      parseIssueReportSummaryIndex(parsed),
      'issue-report-summary-index',
    )
  }
  if (parsed.artifactType === 'issue-report-summary-json') {
    parseIssueReportSummaryJsonOutput(parsed)
    const loadedIndex = await loadIssueReportSummaryIndexFromSummary(
      indexPath,
      {
        indexPath: resolveIssueReportSummaryIndexOutPath(
          {
            summaryPath: resolvedPath,
            outPath: null,
            indexBaseUrl: null,
            json: true,
            topCount: 5,
            writeIndex: true,
          },
          cwd,
        ),
      },
      cwd,
    )
    return loadPreferredManualIssueReportArtifactSummaryInput(
      loadedIndex,
      'issue-report-summary-json',
    )
  }
  if (parsed.artifactType === 'issue-report-artifact-summary-json') {
    return {
      index: parseIssueReportArtifactSummaryJsonOutput(parsed),
      inputArtifactType: 'issue-report-artifact-summary-json',
    }
  }
  if (parsed.artifactType === 'issue-report-artifact-summary-surface') {
    return {
      index: parseIssueReportArtifactSummarySurfaceSummary(parsed),
      inputArtifactType: 'issue-report-artifact-summary-surface',
    }
  }
  throw new Error(
    'issue report summary input must be issue-report-workflow-artifacts, issue-report-summary-artifacts, issue-report-artifact-index, issue-report-summary-index, issue-report-summary-json, issue-report-artifact-summary-json, or issue-report-artifact-summary-surface',
  )
}

const run = async () => {
  const args = parseIssueReportArtifactSummaryArgs(process.argv)
  const loaded = await loadIssueReportArtifactSummaryInputDetails(args.inputPath)
  const content = args.json
    ? JSON.stringify(
        isIssueReportArtifactSummarySurface(loaded.index)
          ? loaded.index
          : buildIssueReportArtifactSummaryJsonOutput({
              index: loaded.index,
              options: {
                label: args.label,
                inputUrl: args.inputUrl,
                publishGateSummaryUrl: args.publishGateSummaryUrl,
                topCount: args.topCount,
                inputArtifactType: loaded.inputArtifactType,
              },
            }),
        null,
        2,
      )
    : renderIssueReportArtifactSummary(loaded.index, {
        label: args.label,
        inputUrl: args.inputUrl,
        publishGateSummaryUrl: args.publishGateSummaryUrl,
        topCount: args.topCount,
        inputArtifactType: loaded.inputArtifactType,
      })
  const outPath = resolveIssueReportArtifactSummaryOutPath(loaded.index, {
    outPath: args.outPath,
    json: args.json,
    writeIndexSummary: args.writeIndexSummary,
  })

  if (outPath) {
    const resolvedOutPath = await writeIssueReportSummaryOutput(outPath, `${content}\n`)
    console.log(
      renderIssueReportArtifactSummaryWriteResult(resolvedOutPath, loaded.index, {
        label: args.label,
        inputUrl: args.inputUrl,
        publishGateSummaryUrl: args.publishGateSummaryUrl,
        topCount: args.topCount,
        inputArtifactType: loaded.inputArtifactType,
      }),
    )
    return
  }

  console.log(content)
}

export {
  buildIssueReportArtifactSummaryJsonOutput,
  loadIssueReportArtifactSummaryInput,
  loadIssueReportArtifactSummaryInputDetails,
  parseIssueReportArtifactSummaryJsonOutput,
  parseIssueReportArtifactSummarySurfaceSummary,
  renderIssueReportArtifactSummary,
  renderIssueReportArtifactSummaryWriteResult,
  resolveIssueReportArtifactSummaryOutPath,
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
