import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import {
  assertIssueReportArtifactManifestKind,
  loadIssueReportArtifactManifest,
} from './issueReportArtifactManifest'
import {
  joinIssueReportBaseUrl,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import { findDistrictIssueHotspot, formatDistrictIssueHotspotLabel } from './issueReportSummaryHotspots'
import type { IssueReportSummaryCsvWriteResult } from './issueReportSummaryCsvFiles'
import { ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION } from './issueReportSummaryTypes'
import type {
  IssueReportReasonPacket,
  IssueReportSegmentPacket,
  IssueReportTriagePacketBundle,
  IssueReportTriagePacketManifest,
} from './issueReportSummaryTypes'

interface IssueReportPacketFileWriteOptions {
  packetRootUrl?: string | null
  packetBaseUrl?: string | null
  csvWrite?: IssueReportSummaryCsvWriteResult | null
  csvRootUrl?: string | null
  csvBaseUrl?: string | null
}

export interface IssueReportPacketFileWriteResult {
  rootPath: string
  summaryPath: string
  manifestPath: string
  segmentPacketPaths: string[]
  reasonPacketPaths: string[]
  segmentEntries: Array<{
    packet: IssueReportSegmentPacket
    absolutePath: string
    relativePath: string
  }>
  reasonEntries: Array<{
    packet: IssueReportReasonPacket
    absolutePath: string
    relativePath: string
  }>
}

export interface LoadedIssueReportTriagePacketBundle {
  manifestPath: string
  manifest: IssueReportTriagePacketManifest
  bundle: IssueReportTriagePacketBundle
  csvWrite: IssueReportSummaryCsvWriteResult | null
}

const escapeCell = (value: string) => value.replace(/\|/g, '\\|')

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const buildPacketFileName = (
  rank: number,
  suffix: string,
) => `${String(rank).padStart(2, '0')}-${slugify(suffix)}.json`

const toPortablePath = (value: string) => value.replace(/\\/g, '/')

const formatFilterLine = (bundle: IssueReportTriagePacketBundle) =>
  [
    `scope=${bundle.filters.scope ?? 'all'}`,
    `district=${bundle.filters.districtId ?? 'all'}`,
    `segment=${bundle.filters.segmentId ?? 'all'}`,
    `reason=${bundle.filters.reasonCode ?? 'all'}`,
    `since=${bundle.filters.since ?? 'none'}`,
  ].join(', ')

const renderPublishGateSection = (
  bundle: IssueReportTriagePacketBundle,
  segmentEntries: Array<{ packet: IssueReportSegmentPacket; relativePath: string }>,
  packetRootUrl: string | null,
) => {
  if (!bundle.publishGateSummary) {
    return []
  }

  const { publishGateSummary } = bundle
  const lines: string[] = []
  lines.push('## Publish Gate')
  lines.push('')
  lines.push('| Mode | Exit code | INFO | WARN | FAIL | Allow fail | Override reason |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  lines.push(
    `| ${publishGateSummary.mode} | ${publishGateSummary.exitCode} | ${publishGateSummary.totals.info} | ${publishGateSummary.totals.warn} | ${publishGateSummary.totals.fail} | ${publishGateSummary.allowFail ? 'yes' : 'no'} | ${escapeCell(publishGateSummary.overrideReason ?? '-')} |`,
  )

  if (publishGateSummary.topDistricts.length > 0) {
    lines.push('')
    lines.push(
      '| District | WARN | FAIL | Direct overrides | Spatial overrides | Unmatched named | Issue hotspot packet | Issue hotspot URL |',
    )
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    publishGateSummary.topDistricts.forEach((district) => {
      const hotspot = findDistrictIssueHotspot(
        segmentEntries.map(({ packet }) => packet),
        district.districtId,
      )
      const hotspotPacketPath =
        hotspot
          ? segmentEntries.find(({ packet }) => packet.packetId === hotspot.packetId)?.relativePath ??
            '-'
          : '-'
      const hotspotPacketUrl =
        hotspotPacketPath !== '-'
          ? joinIssueReportBaseUrl(packetRootUrl, hotspotPacketPath) ?? '-'
          : '-'
      lines.push(
        `| ${district.districtId} | ${district.warn} | ${district.fail} | ${district.signOverrideBreakdown?.matchedBySegmentId ?? '-'} | ${district.signOverrideBreakdown?.matchedBySpatial ?? '-'} | ${district.signOverrideBreakdown?.unmatchedNamed ?? '-'} | ${hotspotPacketPath} | ${hotspotPacketUrl} |`,
      )
    })
  }

  return lines
}

const renderSegmentPacketIndex = (
  packet: IssueReportSegmentPacket,
  relativePath: string,
  packetRootUrl: string | null,
) => {
  const segmentLabel =
    packet.segmentName && packet.segmentId
      ? `${packet.segmentName} (${packet.segmentId})`
      : packet.segmentName ?? packet.segmentId

  return `| ${packet.rank} | ${packet.scope} | ${packet.districtId} | ${escapeCell(segmentLabel)} | ${packet.segmentTier ?? '-'} | ${packet.count} | ${packet.latestCreatedAt ?? '-'} | ${relativePath} | ${joinIssueReportBaseUrl(packetRootUrl, relativePath) ?? '-'} |`
}

const renderReasonPacketIndex = (
  packet: IssueReportReasonPacket,
  relativePath: string,
  packetRootUrl: string | null,
) =>
  `| ${packet.rank} | ${packet.reasonCode} | ${packet.count} | ${packet.districtCount} | ${packet.segmentCount} | ${packet.latestCreatedAt ?? '-'} | ${relativePath} | ${joinIssueReportBaseUrl(packetRootUrl, relativePath) ?? '-'} |`

const buildIssueReportTriagePacketManifest = (params: {
  bundle: IssueReportTriagePacketBundle
  rootPath: string
  summaryPath: string
  packetRootUrl: string | null
  packetBaseUrl: string | null
  csvWrite: IssueReportSummaryCsvWriteResult | null
  csvRootUrl: string | null
  csvBaseUrl: string | null
  segmentEntries: Array<{ packet: IssueReportSegmentPacket; relativePath: string }>
  reasonEntries: Array<{ packet: IssueReportReasonPacket; relativePath: string }>
}): IssueReportTriagePacketManifest => {
  const {
    bundle,
    rootPath,
    summaryPath,
    packetRootUrl,
    csvWrite,
    csvRootUrl,
    segmentEntries,
    reasonEntries,
  } = params

  return {
    artifactType: 'issue-report-triage-packets',
    schemaVersion: ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION,
    generatedAt: bundle.generatedAt,
    storageFile: bundle.storageFile,
    filters: bundle.filters,
    totalCount: bundle.totalCount,
    filteredCount: bundle.filteredCount,
    packetRootPath: rootPath,
    packetRootUrl,
    packetBaseUrl: params.packetBaseUrl,
    csvRootPath: csvWrite?.rootPath ?? null,
    csvRootUrl,
    csvBaseUrl: params.csvBaseUrl,
    summaryPath,
    summaryRelativePath: 'summary.md',
    summaryUrl: joinIssueReportBaseUrl(packetRootUrl, 'summary.md'),
    publishGateSummary: bundle.publishGateSummary,
    publishGateHotspots:
      bundle.publishGateSummary?.topDistricts.map((district) => {
        const hotspot = findDistrictIssueHotspot(
          segmentEntries.map(({ packet }) => packet),
          district.districtId,
        )
        const packetPath =
          hotspot
            ? segmentEntries.find(({ packet }) => packet.packetId === hotspot.packetId)?.relativePath ??
              null
            : null
        return {
          districtId: district.districtId,
          warn: district.warn,
          fail: district.fail,
          topWarnCodes: district.topWarnCodes,
          topFailCodes: district.topFailCodes,
          directOverrideMatches: district.signOverrideBreakdown?.matchedBySegmentId ?? null,
          spatialOverrideMatches: district.signOverrideBreakdown?.matchedBySpatial ?? null,
          unmatchedNamedOverrides: district.signOverrideBreakdown?.unmatchedNamed ?? null,
          issueHotspotSegmentId: hotspot?.segmentId ?? null,
          issueHotspotSegmentName: hotspot?.segmentName ?? null,
          issueHotspotSegmentLabel: hotspot ? formatDistrictIssueHotspotLabel(hotspot) : null,
          issueHotspotPacketPath: packetPath,
          issueHotspotPacketUrl:
            packetPath ? joinIssueReportBaseUrl(packetRootUrl, packetPath) : null,
        }
      }) ?? [],
    segmentPackets: segmentEntries.map(({ packet, relativePath }) => ({
      rank: packet.rank,
      packetId: packet.packetId,
      packetKind: packet.packetKind,
      label:
        packet.segmentName && packet.segmentId
          ? `${packet.segmentName} (${packet.segmentId})`
          : packet.segmentName ?? packet.segmentId,
      relativePath,
      url: joinIssueReportBaseUrl(packetRootUrl, relativePath),
    })),
    reasonPackets: reasonEntries.map(({ packet, relativePath }) => ({
      rank: packet.rank,
      packetId: packet.packetId,
      packetKind: packet.packetKind,
      label: packet.reasonCode,
      relativePath,
      url: joinIssueReportBaseUrl(packetRootUrl, relativePath),
    })),
    csvExports:
      csvWrite?.filePaths.map((filePath) => {
        const fileName = basename(filePath)
        return {
          fileName,
          path: filePath,
          url: joinIssueReportBaseUrl(csvRootUrl, fileName),
        }
      }) ?? [],
  }
}

const renderIssueReportTriagePacketIndex = (params: {
  bundle: IssueReportTriagePacketBundle
  packetRootUrl: string | null
  csvRootUrl: string | null
  segmentEntries: Array<{ packet: IssueReportSegmentPacket; relativePath: string }>
  reasonEntries: Array<{ packet: IssueReportReasonPacket; relativePath: string }>
}) => {
  const { bundle, packetRootUrl, csvRootUrl, segmentEntries, reasonEntries } = params
  const lines: string[] = []
  lines.push('# Issue Report Triage Packets')
  lines.push('')
  lines.push(
    `Manifest schema: issue-report-triage-packets v${ISSUE_REPORT_TRIAGE_PACKET_MANIFEST_SCHEMA_VERSION}`,
  )
  lines.push(`Generated at: ${bundle.generatedAt}`)
  lines.push(`Sync store: ${bundle.storageFile}`)
  lines.push(`Filters: ${formatFilterLine(bundle)}`)
  lines.push(`Total synced issue reports: ${bundle.totalCount}`)
  lines.push(`Matching issue reports: ${bundle.filteredCount}`)
  if (packetRootUrl) {
    lines.push(`Packet root URL: ${packetRootUrl}`)
  }
  if (csvRootUrl) {
    lines.push(`CSV exchange root URL: ${csvRootUrl}`)
  }
  if (bundle.publishGateSummary) {
    lines.push('')
    lines.push(...renderPublishGateSection(bundle, segmentEntries, packetRootUrl))
  }

  lines.push('')
  lines.push('## Segment packets')
  lines.push('')

  if (segmentEntries.length === 0) {
    lines.push('No segment hotspot packets were generated.')
  } else {
    lines.push('| Rank | Scope | District | Segment | Tier | Count | Latest | Packet | Packet URL |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
    segmentEntries.forEach(({ packet, relativePath }) => {
      lines.push(renderSegmentPacketIndex(packet, relativePath, packetRootUrl))
    })
  }

  lines.push('')
  lines.push('## Reason packets')
  lines.push('')

  if (reasonEntries.length === 0) {
    lines.push('No reason hotspot packets were generated.')
  } else {
    lines.push('| Rank | Reason | Count | Districts | Segments | Latest | Packet | Packet URL |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    reasonEntries.forEach(({ packet, relativePath }) => {
      lines.push(renderReasonPacketIndex(packet, relativePath, packetRootUrl))
    })
  }

  return lines.join('\n')
}

export const writeIssueReportTriagePacketBundle = async (
  outPath: string,
  bundle: IssueReportTriagePacketBundle,
  options: IssueReportPacketFileWriteOptions = {},
  cwd = process.cwd(),
): Promise<IssueReportPacketFileWriteResult> => {
  const rootPath = resolve(cwd, outPath)
  const {
    packetRootUrl,
    packetBaseUrl,
    csvRootUrl,
    csvBaseUrl,
  } = resolveIssueReportArtifactRootUrls({
    packetRootUrl: options.packetRootUrl ?? null,
    packetLegacyBaseUrl: options.packetBaseUrl ?? null,
    csvRootUrl: options.csvRootUrl ?? null,
    csvLegacyBaseUrl: options.csvBaseUrl ?? null,
  })
  const segmentDir = join(rootPath, 'top-segments')
  const reasonDir = join(rootPath, 'top-reasons')

  await mkdir(segmentDir, { recursive: true })
  await mkdir(reasonDir, { recursive: true })

  const segmentEntries = await Promise.all(
    bundle.segmentPackets.map(async (packet) => {
      const fileName = buildPacketFileName(
        packet.rank,
        `${packet.scope}-${packet.districtId}-${packet.segmentId}`,
      )
      const absolutePath = join(segmentDir, fileName)
      await writeFile(absolutePath, JSON.stringify(packet, null, 2), 'utf8')
      return {
        packet,
        absolutePath,
        relativePath: toPortablePath(join('top-segments', fileName)),
      }
    }),
  )

  const reasonEntries = await Promise.all(
    bundle.reasonPackets.map(async (packet) => {
      const fileName = buildPacketFileName(packet.rank, packet.reasonCode)
      const absolutePath = join(reasonDir, fileName)
      await writeFile(absolutePath, JSON.stringify(packet, null, 2), 'utf8')
      return {
        packet,
        absolutePath,
        relativePath: toPortablePath(join('top-reasons', fileName)),
      }
    }),
  )

  const summaryPath = join(rootPath, 'summary.md')
  await writeFile(
    summaryPath,
    renderIssueReportTriagePacketIndex({
      bundle,
      packetRootUrl,
      csvRootUrl,
      segmentEntries: segmentEntries.map(({ packet, relativePath }) => ({
        packet,
        relativePath,
      })),
      reasonEntries: reasonEntries.map(({ packet, relativePath }) => ({
        packet,
        relativePath,
      })),
    }),
    'utf8',
  )

  const manifestPath = join(rootPath, 'manifest.json')
  const manifest = buildIssueReportTriagePacketManifest({
    bundle,
    rootPath,
    summaryPath,
    packetRootUrl,
    packetBaseUrl,
    csvWrite: options.csvWrite ?? null,
    csvRootUrl,
    csvBaseUrl,
    segmentEntries: segmentEntries.map(({ packet, relativePath }) => ({
      packet,
      relativePath,
    })),
    reasonEntries: reasonEntries.map(({ packet, relativePath }) => ({
      packet,
      relativePath,
    })),
  })
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  return {
    rootPath,
    summaryPath,
    manifestPath,
    segmentPacketPaths: segmentEntries.map(({ absolutePath }) => absolutePath),
    reasonPacketPaths: reasonEntries.map(({ absolutePath }) => absolutePath),
    segmentEntries,
    reasonEntries,
  }
}

export const loadIssueReportTriagePacketBundle = async (
  manifestPath: string,
  cwd = process.cwd(),
): Promise<LoadedIssueReportTriagePacketBundle> => {
  const loadedManifest = await loadIssueReportArtifactManifest(manifestPath, cwd)
  const manifest = assertIssueReportArtifactManifestKind(loadedManifest.manifest, 'packet')

  const segmentPackets = await Promise.all(
    manifest.segmentPackets.map(async (entry) =>
      JSON.parse(
        await readFile(resolve(manifest.packetRootPath, entry.relativePath), 'utf8'),
      ) as IssueReportSegmentPacket,
    ),
  )
  const reasonPackets = await Promise.all(
    manifest.reasonPackets.map(async (entry) =>
      JSON.parse(
        await readFile(resolve(manifest.packetRootPath, entry.relativePath), 'utf8'),
      ) as IssueReportReasonPacket,
    ),
  )

  return {
    manifestPath: loadedManifest.manifestPath,
    manifest,
    bundle: {
      generatedAt: manifest.generatedAt,
      storageFile: manifest.storageFile,
      filters: manifest.filters,
      totalCount: manifest.totalCount,
      filteredCount: manifest.filteredCount,
      publishGateSummary: manifest.publishGateSummary,
      segmentPackets,
      reasonPackets,
    },
    csvWrite:
      manifest.csvRootPath !== null
        ? {
            rootPath: manifest.csvRootPath,
            filePaths: manifest.csvExports.map((entry) => entry.path),
          }
        : null,
  }
}
