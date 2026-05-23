import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertIssueReportArtifactManifestKind,
  loadIssueReportArtifactManifestBundle,
  validateIssueReportArtifactManifestRelations,
} from './issueReportArtifactManifest'
import {
  resolveIssueReportArtifactBundleUrls,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import { parseIssueReportArtifactIndexArgs } from './issueReportArtifactIndexArgs'
import { loadIssueReportTriagePacketBundle } from './issueReportSummaryPacketFiles'
import { writeIssueReportSummaryOutput } from './issueReportSummaryFiles'
import {
  ISSUE_REPORT_ARTIFACT_INDEX_SCHEMA_VERSION,
} from './issueReportSummaryTypes'
import type {
  IssueReportArtifactIndexOutput,
  IssueReportSummaryIndexFileEntry,
} from './issueReportSummaryTypes'

const escapeCell = (value: string) => value.replace(/\|/g, '\\|')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const pickPreferredCsvExport = (
  entries: IssueReportArtifactIndexOutput['csvExports'],
) =>
  entries.find((entry) => entry.fileName === 'publish-gate-districts.csv')
  ?? entries.find((entry) => entry.fileName === 'top-segments.csv')
  ?? entries[0]
  ?? null

const resolveIssueReportArtifactIndexRootManifestLinks = (
  index: Pick<IssueReportArtifactIndexOutput, 'rootManifest'>,
) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: index.rootManifest.packetRootUrl,
    packetLegacyArtifactUrl: index.rootManifest.packetArtifactUrl,
    csvRootUrl: index.rootManifest.csvRootUrl,
    csvLegacyArtifactUrl: index.rootManifest.csvArtifactUrl,
  })

const resolveIssueReportArtifactIndexPacketManifestLinks = (
  index: Pick<IssueReportArtifactIndexOutput, 'packetManifest'>,
) =>
  resolveIssueReportArtifactRootUrls({
    packetRootUrl: index.packetManifest.packetRootUrl,
    packetLegacyBaseUrl: index.packetManifest.packetBaseUrl,
    csvRootUrl: index.packetManifest.csvRootUrl,
    csvLegacyBaseUrl: index.packetManifest.csvBaseUrl,
  })

const resolveIssueReportArtifactIndexPacketRootUrl = (
  index: IssueReportArtifactIndexOutput,
) =>
  resolveIssueReportArtifactIndexRootManifestLinks(index).packetRootUrl
  ?? resolveIssueReportArtifactIndexPacketManifestLinks(index).packetRootUrl

const resolveIssueReportArtifactIndexCsvRootUrl = (
  index: IssueReportArtifactIndexOutput,
) =>
  resolveIssueReportArtifactIndexRootManifestLinks(index).csvRootUrl
  ?? resolveIssueReportArtifactIndexPacketManifestLinks(index).csvRootUrl

const resolveIssueReportArtifactIndexPacketSummaryPath = (
  index: IssueReportArtifactIndexOutput,
) => index.rootManifest.packetSummaryPath ?? index.packetManifest.summaryPath

const resolveIssueReportArtifactIndexPacketSummaryRelativePath = (
  index: IssueReportArtifactIndexOutput,
) =>
  index.rootManifest.packetSummaryRelativePath
  ?? index.packetManifest.summaryRelativePath

const resolveIssueReportArtifactIndexPacketManifestPath = (
  index: IssueReportArtifactIndexOutput,
) =>
  index.rootManifest.packetManifestPath
  ?? index.packetManifest.manifestPath

const resolveIssueReportArtifactIndexPacketManifestRelativePath = (
  index: IssueReportArtifactIndexOutput,
) =>
  index.rootManifest.packetManifestRelativePath
  ?? 'manifest.json'

const resolveIssueReportArtifactIndexPacketRootPath = (
  index: IssueReportArtifactIndexOutput,
) =>
  index.rootManifest.packetRootPath
  ?? index.packetManifest.packetRootPath

const resolveIssueReportArtifactIndexCsvRootPath = (
  index: IssueReportArtifactIndexOutput,
) => index.rootManifest.csvRootPath ?? index.packetManifest.csvRootPath

const resolveIssueReportArtifactIndexBundleUrls = (
  index: IssueReportArtifactIndexOutput,
) => {
  const preferredCsvFile = resolveIssueReportArtifactIndexPreferredCsvFile(index)
  return resolveIssueReportArtifactBundleUrls({
    packetRootUrl: resolveIssueReportArtifactIndexPacketRootUrl(index),
    csvRootUrl: resolveIssueReportArtifactIndexCsvRootUrl(index),
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
      resolveIssueReportArtifactIndexPacketSummaryRelativePath(index),
    packetManifestUrl: index.rootManifest.packetManifestUrl,
    packetManifestRelativePath:
      resolveIssueReportArtifactIndexPacketManifestRelativePath(index),
  })
}

export const resolveIssueReportArtifactIndexPreferredCsvFile = (
  index: IssueReportArtifactIndexOutput,
): IssueReportSummaryIndexFileEntry | null => {
  if (index.rootManifest.preferredCsvPath && index.rootManifest.preferredCsvRelativePath) {
    return {
      path: index.rootManifest.preferredCsvPath,
      relativePath: index.rootManifest.preferredCsvRelativePath,
      url: index.rootManifest.preferredCsvUrl,
    }
  }
  if (index.preferredCsvFile) {
    return index.preferredCsvFile
  }
  const preferredCsvExport = pickPreferredCsvExport(index.csvExports)
  return preferredCsvExport
    ? {
        path: preferredCsvExport.path,
        relativePath: preferredCsvExport.fileName,
        url: preferredCsvExport.url,
      }
    : null
}

export const parseIssueReportArtifactIndex = (
  value: unknown,
): IssueReportArtifactIndexOutput => {
  if (!isRecord(value)) {
    throw new Error('artifact index must be an object')
  }
  if (value.artifactType !== 'issue-report-artifact-index') {
    throw new Error('artifact index must have artifactType issue-report-artifact-index')
  }
  if (value.schemaVersion !== ISSUE_REPORT_ARTIFACT_INDEX_SCHEMA_VERSION) {
    throw new Error(
      `artifact index schemaVersion must be ${ISSUE_REPORT_ARTIFACT_INDEX_SCHEMA_VERSION}`,
    )
  }
  const index = value as IssueReportArtifactIndexOutput
  const rootLinks = resolveIssueReportArtifactIndexRootManifestLinks(index)
  const packetLinks = resolveIssueReportArtifactIndexPacketManifestLinks(index)
  return {
    ...index,
    rootManifest: {
      ...index.rootManifest,
      packetRootUrl: rootLinks.packetRootUrl,
      packetArtifactUrl: rootLinks.packetArtifactUrl,
      csvRootUrl: rootLinks.csvRootUrl,
      csvArtifactUrl: rootLinks.csvArtifactUrl,
    },
    packetManifest: {
      ...index.packetManifest,
      packetRootUrl: packetLinks.packetRootUrl,
      packetBaseUrl: packetLinks.packetBaseUrl,
      csvRootUrl: packetLinks.csvRootUrl,
      csvBaseUrl: packetLinks.csvBaseUrl,
    },
  }
}

export const loadIssueReportArtifactIndex = async (
  indexPath: string,
  cwd = process.cwd(),
): Promise<IssueReportArtifactIndexOutput> => {
  const resolvedPath = resolve(cwd, indexPath)
  const raw = await readFile(resolvedPath, 'utf8')
  return parseIssueReportArtifactIndex(JSON.parse(raw))
}

export const buildIssueReportArtifactIndex = async (
  manifestPath: string,
  cwd = process.cwd(),
): Promise<IssueReportArtifactIndexOutput> => {
  const bundle = await loadIssueReportArtifactManifestBundle(manifestPath, cwd)
  const rootManifest = assertIssueReportArtifactManifestKind(bundle.rootManifest, 'workflow')
  const packetManifest = bundle.packetManifest

  if (!packetManifest || !bundle.packetManifestPath) {
    throw new Error('workflow artifact manifest is missing its nested packet manifest')
  }

  const relationSummary = validateIssueReportArtifactManifestRelations(bundle)
  const packetBundle = await loadIssueReportTriagePacketBundle(rootManifest.packetManifestPath, cwd)
  const preferredCsvExport = pickPreferredCsvExport(packetManifest.csvExports)
  const rootLinks = resolveIssueReportArtifactRootUrls({
    packetRootUrl: rootManifest.packetRootUrl,
    packetLegacyArtifactUrl: rootManifest.packetArtifactUrl,
    csvRootUrl: rootManifest.csvRootUrl,
    csvLegacyArtifactUrl: rootManifest.csvArtifactUrl,
  })
  const packetLinks = resolveIssueReportArtifactRootUrls({
    packetRootUrl: packetManifest.packetRootUrl,
    packetLegacyBaseUrl: packetManifest.packetBaseUrl,
    csvRootUrl: packetManifest.csvRootUrl,
    csvLegacyBaseUrl: packetManifest.csvBaseUrl,
  })

  return {
    artifactType: 'issue-report-artifact-index',
    schemaVersion: ISSUE_REPORT_ARTIFACT_INDEX_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    rootManifest: {
      manifestPath: bundle.rootManifestPath,
      artifactType: rootManifest.artifactType,
      schemaVersion: rootManifest.schemaVersion,
      outRoot: rootManifest.outRoot,
      summaryPath: rootManifest.summaryPath,
      summaryRelativePath: rootManifest.summaryRelativePath,
      summaryUrl: rootManifest.summaryUrl,
      indexSummaryPath: rootManifest.indexSummaryPath,
      indexSummaryRelativePath: rootManifest.indexSummaryRelativePath,
      indexSummaryUrl: rootManifest.indexSummaryUrl,
      indexSummaryJsonPath: rootManifest.indexSummaryJsonPath,
      indexSummaryJsonRelativePath: rootManifest.indexSummaryJsonRelativePath,
      indexSummaryJsonUrl: rootManifest.indexSummaryJsonUrl,
      indexSurfacePath: rootManifest.indexSurfacePath,
      indexSurfaceRelativePath: rootManifest.indexSurfaceRelativePath,
      indexSurfaceUrl: rootManifest.indexSurfaceUrl,
      artifactIndexPath: rootManifest.artifactIndexPath,
      artifactIndexRelativePath: rootManifest.artifactIndexRelativePath,
      artifactIndexUrl: rootManifest.artifactIndexUrl,
      packetManifestPath: rootManifest.packetManifestPath,
      packetSummaryPath: rootManifest.packetSummaryPath,
      packetSummaryRelativePath: rootManifest.packetSummaryRelativePath,
      packetSummaryUrl: rootManifest.packetSummaryUrl,
      packetManifestRelativePath: rootManifest.packetManifestRelativePath,
      packetManifestUrl: rootManifest.packetManifestUrl,
      packetRootPath: rootManifest.packetRootPath,
      csvRootPath: rootManifest.csvRootPath,
      preferredCsvPath: rootManifest.preferredCsvPath,
      preferredCsvRelativePath: rootManifest.preferredCsvRelativePath,
      preferredCsvUrl: rootManifest.preferredCsvUrl,
      packetRootUrl: rootLinks.packetRootUrl,
      packetArtifactUrl: rootLinks.packetArtifactUrl,
      csvRootUrl: rootLinks.csvRootUrl,
      csvArtifactUrl: rootLinks.csvArtifactUrl,
      packetPaths: rootManifest.packetPaths,
      csvPaths: rootManifest.csvPaths,
      storageFile: rootManifest.storageFile,
      totalCount: rootManifest.totalCount,
      filteredCount: rootManifest.filteredCount,
    },
    packetManifest: {
      manifestPath: bundle.packetManifestPath,
      artifactType: packetManifest.artifactType,
      schemaVersion: packetManifest.schemaVersion,
      summaryPath: packetManifest.summaryPath,
      summaryRelativePath: packetManifest.summaryRelativePath,
      summaryUrl: packetManifest.summaryUrl,
      packetRootPath: packetManifest.packetRootPath,
      packetRootUrl: packetLinks.packetRootUrl,
      packetBaseUrl: packetLinks.packetBaseUrl,
      csvRootPath: packetManifest.csvRootPath,
      csvRootUrl: packetLinks.csvRootUrl,
      csvBaseUrl: packetLinks.csvBaseUrl,
      storageFile: packetManifest.storageFile,
      filters: packetManifest.filters,
      totalCount: packetManifest.totalCount,
      filteredCount: packetManifest.filteredCount,
    },
    relationSummary,
    publishGateSummary: packetManifest.publishGateSummary,
    publishGateHotspots: packetManifest.publishGateHotspots,
    topDistricts: rootManifest.topDistricts,
    topSegments: packetBundle.bundle.segmentPackets,
    topReasons: packetBundle.bundle.reasonPackets,
    segmentPackets: packetManifest.segmentPackets,
    reasonPackets: packetManifest.reasonPackets,
    preferredCsvFile: preferredCsvExport
      ? {
          path: preferredCsvExport.path,
          relativePath: preferredCsvExport.fileName,
          url: preferredCsvExport.url,
        }
      : null,
    csvExports: packetManifest.csvExports,
  }
}

export const renderIssueReportArtifactIndex = (
  index: IssueReportArtifactIndexOutput,
) => {
  const preferredCsvFile = resolveIssueReportArtifactIndexPreferredCsvFile(index)
  const rootManifestLinks = resolveIssueReportArtifactIndexRootManifestLinks(index)
  const packetManifestLinks = resolveIssueReportArtifactIndexPacketManifestLinks(index)
  const packetRootUrl =
    rootManifestLinks.packetRootUrl
    ?? packetManifestLinks.packetRootUrl
  const csvRootUrl =
    rootManifestLinks.csvRootUrl
    ?? packetManifestLinks.csvRootUrl
  const bundleUrls = resolveIssueReportArtifactIndexBundleUrls(index)
  const lines = [
    '# Issue Report Artifact Index',
    '',
    `Manifest schema: ${index.artifactType} v${index.schemaVersion}`,
    `Workflow manifest: ${index.rootManifest.manifestPath}`,
    `Workflow summary URL: ${index.rootManifest.summaryUrl ?? '-'}`,
    `Index summary: ${index.rootManifest.indexSummaryPath}`,
    `Index summary entry: ${index.rootManifest.indexSummaryRelativePath}`,
    `Index summary URL: ${index.rootManifest.indexSummaryUrl ?? '-'}`,
    `Index summary json: ${index.rootManifest.indexSummaryJsonPath}`,
    `Index summary json entry: ${index.rootManifest.indexSummaryJsonRelativePath}`,
    `Index summary json URL: ${index.rootManifest.indexSummaryJsonUrl ?? '-'}`,
    `Index surface: ${index.rootManifest.indexSurfacePath}`,
    `Index surface entry: ${index.rootManifest.indexSurfaceRelativePath}`,
    `Index surface URL: ${index.rootManifest.indexSurfaceUrl ?? '-'}`,
    `Artifact index: ${index.rootManifest.artifactIndexPath}`,
    `Artifact index entry: ${index.rootManifest.artifactIndexRelativePath}`,
    `Artifact index URL: ${index.rootManifest.artifactIndexUrl ?? '-'}`,
    `Workflow summary entry: ${index.rootManifest.summaryRelativePath}`,
    `Packet manifest: ${index.packetManifest.manifestPath}`,
    `Root packet summary entry: ${index.rootManifest.packetSummaryRelativePath}`,
    `Root packet summary URL: ${index.rootManifest.packetSummaryUrl ?? '-'}`,
    `Root packet manifest entry: ${index.rootManifest.packetManifestRelativePath}`,
    `Root packet manifest URL: ${index.rootManifest.packetManifestUrl ?? '-'}`,
    `Root preferred CSV join file: ${index.rootManifest.preferredCsvRelativePath ?? '-'}`,
    `Root preferred CSV join URL: ${bundleUrls.preferredCsvUrl ?? '-'}`,
    `Matching issue reports: ${index.rootManifest.filteredCount} / ${index.rootManifest.totalCount}`,
    `Linked publish gate hotspots: ${index.relationSummary.linkedPublishGateHotspotCount} / ${index.relationSummary.totalPublishGateHotspotCount}`,
    `Packet entries: ${index.relationSummary.packetSegmentCount ?? 0} segments / ${index.relationSummary.packetReasonCount ?? 0} reasons`,
    `CSV exports: ${index.relationSummary.packetCsvCount ?? 0}`,
    `Preferred CSV join file: ${preferredCsvFile?.relativePath ?? '-'}`,
    `Preferred CSV join file URL: ${bundleUrls.preferredCsvUrl ?? preferredCsvFile?.url ?? '-'}`,
    `Packet root URL: ${packetRootUrl ?? '-'}`,
    ...(rootManifestLinks.packetArtifactUrl
      ? [`Legacy packet artifact URL: ${rootManifestLinks.packetArtifactUrl}`]
      : []),
    ...(packetManifestLinks.packetBaseUrl
      ? [`Legacy packet base URL: ${packetManifestLinks.packetBaseUrl}`]
      : []),
    `CSV root URL: ${csvRootUrl ?? '-'}`,
    ...(rootManifestLinks.csvArtifactUrl
      ? [`Legacy CSV artifact URL: ${rootManifestLinks.csvArtifactUrl}`]
      : []),
    ...(packetManifestLinks.csvBaseUrl
      ? [`Legacy CSV base URL: ${packetManifestLinks.csvBaseUrl}`]
      : []),
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
    index.publishGateHotspots.forEach((hotspot) => {
      lines.push(
        `| ${hotspot.districtId} | ${hotspot.warn} | ${hotspot.fail} | ${hotspot.directOverrideMatches ?? '-'} | ${hotspot.spatialOverrideMatches ?? '-'} | ${hotspot.unmatchedNamedOverrides ?? '-'} | ${escapeCell(hotspot.issueHotspotSegmentLabel ?? '-')} | ${hotspot.issueHotspotPacketUrl ?? hotspot.issueHotspotPacketPath ?? '-'} |`,
      )
    })
  }

  lines.push('')
  lines.push('## Packet Roots')
  lines.push('')
  lines.push(`- Packet summary: ${resolveIssueReportArtifactIndexPacketSummaryPath(index)}`)
  lines.push(`- Packet summary entry: ${resolveIssueReportArtifactIndexPacketSummaryRelativePath(index)}`)
  lines.push(`- Packet summary URL: ${bundleUrls.packetSummaryUrl ?? '-'}`)
  lines.push(`- Packet manifest: ${resolveIssueReportArtifactIndexPacketManifestPath(index)}`)
  lines.push(`- Packet manifest entry: ${resolveIssueReportArtifactIndexPacketManifestRelativePath(index)}`)
  lines.push(`- Packet manifest URL: ${bundleUrls.packetManifestUrl ?? '-'}`)
  lines.push(`- Packet root: ${resolveIssueReportArtifactIndexPacketRootPath(index)}`)
  lines.push(`- Packet root URL: ${packetRootUrl ?? '-'}`)
  lines.push(`- CSV root: ${resolveIssueReportArtifactIndexCsvRootPath(index) ?? '-'}`)
  lines.push(`- CSV root URL: ${csvRootUrl ?? '-'}`)

  return lines.join('\n')
}

const resolveIssueReportArtifactIndexOutPath = (
  index: IssueReportArtifactIndexOutput,
  args: ReturnType<typeof parseIssueReportArtifactIndexArgs>,
) => {
  if (args.outPath) {
    return args.outPath
  }
  if (args.writeArtifactIndex) {
    return index.rootManifest.artifactIndexPath
  }
  return null
}

const run = async () => {
  const args = parseIssueReportArtifactIndexArgs(process.argv)
  const index = await buildIssueReportArtifactIndex(args.manifestPath)
  const content =
    args.json
      ? JSON.stringify(index, null, 2)
      : renderIssueReportArtifactIndex(index)

  const outPath = resolveIssueReportArtifactIndexOutPath(index, args)

  if (outPath) {
    const writtenPath = await writeIssueReportSummaryOutput(outPath, content)
    console.log(`Wrote issue report artifact index to ${writtenPath}`)
    if (!args.json) {
      console.log(content)
    }
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
