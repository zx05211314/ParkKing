import { basename } from 'node:path'
import type { NightlyPublishGateSummary } from './notifyNightlyTypes'
import {
  buildIssueReportPublishGateHotspots,
} from './issueReportSummaryHotspots'
import {
  buildIssueReportSummaryJsonSurfaceSummary,
} from './issueReportSummaryJson'
import {
  resolveIssueReportArtifactBundleUrls,
  resolveIssueReportArtifactRootUrls,
} from './issueReportArtifactUrlResolvers'
import type {
  IssueReportSummaryJsonOutput,
  IssueReportSummaryResult,
} from './issueReportSummaryTypes'

const renderFilterLine = (result: IssueReportSummaryResult) => {
  const parts = [
    `scope=${result.filters.scope ?? 'all'}`,
    `district=${result.filters.districtId ?? 'all'}`,
    `segment=${result.filters.segmentId ?? 'all'}`,
    `reason=${result.filters.reasonCode ?? 'all'}`,
    `since=${result.filters.since ?? 'none'}`,
  ]
  return `Filters: ${parts.join(', ')}`
}

const escapeCell = (value: string) => value.replace(/\|/g, '\\|')

const pickPreferredCsvExport = (summary: IssueReportSummaryJsonOutput) => {
  const entries = summary.artifacts.csvPaths.map((path, index) => ({
    path,
    relativePath:
      summary.artifacts.csvRelativePaths[index] ?? basename(path).replace(/\\/g, '/'),
  }))

  return (
    entries.find((entry) => entry.relativePath === 'publish-gate-districts.csv')
    ?? entries.find((entry) => entry.relativePath === 'top-segments.csv')
    ?? entries[0]
    ?? null
  )
}

export const renderIssueReportSummary = (result: IssueReportSummaryResult) => {
  const lines: string[] = []
  lines.push(`Sync store: ${result.storageFile}${result.storeExists ? '' : ' (missing)'}`)
  lines.push(renderFilterLine(result))

  if (!result.storeExists) {
    lines.push('No sync store file was found.')
    return lines.join('\n')
  }

  lines.push(`Total synced issue reports: ${result.totalCount}`)
  lines.push(`Matching issue reports: ${result.filteredCount}`)

  if (result.filteredCount === 0) {
    lines.push('No synced issue reports matched the current filters.')
    return lines.join('\n')
  }

  if (result.topDistricts.length > 0) {
    lines.push('')
    lines.push('Top recurring districts:')
    lines.push('')
    lines.push('| Scope | District | Count | Latest | Example |')
    lines.push('| --- | --- | --- | --- | --- |')
    result.topDistricts.forEach((summary) => {
      lines.push(
        `| ${summary.scope} | ${summary.districtId} | ${summary.count} | ${summary.latestCreatedAt ?? '-'} | ${escapeCell(summary.latestSummary ?? '-')} |`,
      )
    })
  }

  if (result.latestDistricts.length > 0) {
    lines.push('')
    lines.push('Latest affected districts:')
    lines.push('')
    lines.push('| Scope | District | Latest | Count | Example |')
    lines.push('| --- | --- | --- | --- | --- |')
    result.latestDistricts.forEach((summary) => {
      lines.push(
        `| ${summary.scope} | ${summary.districtId} | ${summary.latestCreatedAt ?? '-'} | ${summary.count} | ${escapeCell(summary.latestSummary ?? '-')} |`,
      )
    })
  }

  if (result.topSegments.length > 0) {
    lines.push('')
    lines.push('Top recurring segments:')
    lines.push('')
    lines.push('| Scope | District | Segment | Tier | Count | Latest | Example |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    result.topSegments.forEach((summary) => {
      const segmentLabel =
        summary.segmentName && summary.segmentId
          ? `${summary.segmentName} (${summary.segmentId})`
          : summary.segmentName ?? summary.segmentId
      lines.push(
        `| ${summary.scope} | ${summary.districtId} | ${escapeCell(segmentLabel)} | ${summary.segmentTier ?? '-'} | ${summary.count} | ${summary.latestCreatedAt ?? '-'} | ${escapeCell(summary.latestSummary ?? '-')} |`,
      )
    })
  }

  if (result.topReasons.length > 0) {
    lines.push('')
    lines.push('Top recurring reasons:')
    lines.push('')
    lines.push('| Reason | Count | Districts | Segments | Latest | Latest location |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    result.topReasons.forEach((summary) => {
      const latestLocation =
        summary.latestSegmentName && summary.latestSegmentId
          ? `${summary.latestDistrictId ?? '-'} / ${summary.latestSegmentName} (${summary.latestSegmentId})`
          : summary.latestSegmentId
            ? `${summary.latestDistrictId ?? '-'} / ${summary.latestSegmentId}`
            : summary.latestDistrictId ?? '-'
      lines.push(
        `| ${summary.reasonCode} | ${summary.count} | ${summary.districtCount} | ${summary.segmentCount} | ${summary.latestCreatedAt ?? '-'} | ${escapeCell(latestLocation)} |`,
      )
    })
  }

  lines.push('')
  lines.push('Summary by scope/district:')
  lines.push('')
  lines.push('| Scope | District | Count | Latest | Example |')
  lines.push('| --- | --- | --- | --- | --- |')
  result.summaries.forEach((summary) => {
    lines.push(
      `| ${summary.scope} | ${summary.districtId} | ${summary.count} | ${summary.latestCreatedAt ?? '-'} | ${escapeCell(summary.latestSummary ?? '-')} |`,
    )
  })

  if (result.segmentSummaries.length > 0) {
    lines.push('')
    lines.push('Summary by segment:')
    lines.push('')
    lines.push('| Scope | District | Segment | Tier | Count | Latest | Example |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    result.segmentSummaries.forEach((summary) => {
      const segmentLabel =
        summary.segmentName && summary.segmentId
          ? `${summary.segmentName} (${summary.segmentId})`
          : summary.segmentName ?? summary.segmentId
      lines.push(
        `| ${summary.scope} | ${summary.districtId} | ${escapeCell(segmentLabel)} | ${summary.segmentTier ?? '-'} | ${summary.count} | ${summary.latestCreatedAt ?? '-'} | ${escapeCell(summary.latestSummary ?? '-')} |`,
      )
    })
  }

  lines.push('')
  lines.push(
    `Recent issue reports (showing ${result.issues.length} of ${result.filteredCount}):`,
  )
  lines.push('')
  lines.push('| Created | Scope | District | Segment | Tier | HHMM | Summary |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  result.issues.forEach((issue) => {
    const segmentLabel =
      issue.segmentName && issue.segmentId
        ? `${issue.segmentName} (${issue.segmentId})`
        : issue.segmentName ?? issue.segmentId ?? '-'
    lines.push(
      `| ${issue.createdAt} | ${issue.scope} | ${issue.districtId} | ${escapeCell(segmentLabel)} | ${issue.segmentTier ?? '-'} | ${issue.reportHhmm ?? '-'} | ${escapeCell(issue.summary)} |`,
    )
  })

  return lines.join('\n')
}

export const renderIssueReportSummaryWithPublishGate = (
  result: IssueReportSummaryResult,
  publishGateSummary: NightlyPublishGateSummary | null,
) => {
  const base = renderIssueReportSummary(result)
  if (!publishGateSummary) {
    return base
  }

  const lines = [base, '', 'Publish gate summary:', '']
  lines.push('| Mode | Exit code | INFO | WARN | FAIL | Allow fail | Override reason |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')
  lines.push(
    `| ${publishGateSummary.mode} | ${publishGateSummary.exitCode} | ${publishGateSummary.totals.info} | ${publishGateSummary.totals.warn} | ${publishGateSummary.totals.fail} | ${publishGateSummary.allowFail ? 'yes' : 'no'} | ${escapeCell(publishGateSummary.overrideReason ?? '-')} |`,
  )

  if (publishGateSummary.topDistricts.length > 0) {
    const publishGateHotspots = buildIssueReportPublishGateHotspots(
      result.topSegments,
      publishGateSummary,
    )
    lines.push('')
    lines.push('Top publish gate districts:')
    lines.push('')
    lines.push(
      '| District | WARN | FAIL | Direct overrides | Spatial overrides | Unmatched named | Top issue hotspot |',
    )
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    publishGateHotspots.forEach((district) => {
      lines.push(
        `| ${district.districtId} | ${district.warn} | ${district.fail} | ${district.directOverrideMatches ?? '-'} | ${district.spatialOverrideMatches ?? '-'} | ${district.unmatchedNamedOverrides ?? '-'} | ${escapeCell(district.issueHotspotSegmentLabel ?? '-')} |`,
      )
    })
  }

  return lines.join('\n')
}

export const renderIssueReportSummaryArtifactsHandoff = (
  summaryPath: string,
  summary: IssueReportSummaryJsonOutput,
) => {
  const surfaceSummary = buildIssueReportSummaryJsonSurfaceSummary({
    summaryPath,
    summary,
  })
  const lines = [
    'Artifact handoff:',
    '',
    `Input surface: ${surfaceSummary.artifactType}`,
    `Canonical full-index handoff: ${surfaceSummary.artifactIndexRelativePath ?? '-'}`,
    `Canonical full-index URL: ${surfaceSummary.artifactIndexUrl ?? '-'}`,
    `Preferred portable input: ${surfaceSummary.manualManifestRelativePath ?? '-'}`,
    `Preferred portable input URL: ${surfaceSummary.manualManifestUrl ?? '-'}`,
    `Fallback compatibility input: ${surfaceSummary.artifactIndexRelativePath ?? '-'}`,
    `Fallback compatibility input URL: ${surfaceSummary.artifactIndexUrl ?? '-'}`,
  ]

  return lines.join('\n')
}

export const renderIssueReportSummaryBundleHandoff = (
  summary: IssueReportSummaryJsonOutput,
) => {
  const sections: string[] = []

  if (summary.artifacts.summaryPath) {
    sections.push(
      renderIssueReportSummaryArtifactsHandoff(summary.artifacts.summaryPath, summary),
    )
  }

  if (summary.artifacts.packetRootPath || summary.artifacts.packetManifestPath) {
    const {
      packetRootUrl,
      packetBaseUrl: legacyPacketBaseUrl,
    } = resolveIssueReportArtifactRootUrls({
      packetRootUrl: summary.artifacts.packetRootUrl,
      packetLegacyBaseUrl: summary.artifacts.packetBaseUrl,
      csvRootUrl: null,
    })
    const { packetManifestUrl, packetSummaryUrl } =
      resolveIssueReportArtifactBundleUrls({
        packetRootUrl,
        csvRootUrl: null,
        preferredCsvUrl: null,
        preferredCsvRelativePath: null,
        packetSummaryUrl: summary.artifacts.packetSummaryUrl,
        packetSummaryRelativePath: summary.artifacts.packetSummaryRelativePath,
        packetManifestUrl: summary.artifacts.packetManifestUrl,
        packetManifestRelativePath: summary.artifacts.packetManifestRelativePath,
      })
    const packetLines = [
      'Packet handoff:',
      '',
      `Preferred portable input: ${summary.artifacts.packetManifestPath ?? '-'}`,
      `Preferred portable input URL: ${packetManifestUrl ?? '-'}`,
      `Human packet index: ${summary.artifacts.packetSummaryPath ?? '-'}`,
      `Human packet index URL: ${packetSummaryUrl ?? '-'}`,
      `Packet root: ${summary.artifacts.packetRootPath ?? '-'}`,
      `Packet root URL: ${packetRootUrl ?? '-'}`,
      ...(legacyPacketBaseUrl ? [`Legacy packet base URL: ${legacyPacketBaseUrl}`] : []),
      `Packet entry count: ${summary.artifacts.packetPaths.length}`,
    ]
    sections.push(packetLines.join('\n'))
  }

  if (summary.artifacts.csvRootPath || summary.artifacts.csvPaths.length > 0) {
    const {
      csvRootUrl,
      csvBaseUrl: legacyCsvBaseUrl,
    } = resolveIssueReportArtifactRootUrls({
      packetRootUrl: null,
      csvRootUrl: summary.artifacts.csvRootUrl,
      csvLegacyBaseUrl: summary.artifacts.csvBaseUrl,
    })
    const preferredCsvExport = pickPreferredCsvExport(summary)
    const { preferredCsvUrl } = resolveIssueReportArtifactBundleUrls({
      packetRootUrl: null,
      csvRootUrl,
      preferredCsvUrl: summary.artifacts.preferredCsvUrl,
      preferredCsvRelativePath: preferredCsvExport?.relativePath ?? null,
      packetSummaryUrl: null,
      packetSummaryRelativePath: null,
      packetManifestUrl: null,
      packetManifestRelativePath: null,
    })
    const csvLines = [
      'CSV handoff:',
      '',
      `Exchange root: ${summary.artifacts.csvRootPath ?? '-'}`,
      `Exchange root URL: ${csvRootUrl ?? '-'}`,
      ...(legacyCsvBaseUrl ? [`Legacy CSV base URL: ${legacyCsvBaseUrl}`] : []),
      `Preferred join file: ${summary.artifacts.preferredCsvPath ?? preferredCsvExport?.path ?? '-'}`,
      `Preferred join file URL: ${preferredCsvUrl ?? '-'}`,
      `CSV file count: ${summary.artifacts.csvPaths.length}`,
    ]
    sections.push(csvLines.join('\n'))
  }

  return sections.join('\n\n')
}

export const renderIssueReportSummaryWithArtifacts = (params: {
  result: IssueReportSummaryResult
  publishGateSummary: NightlyPublishGateSummary | null
  summaryPath: string | null
  summary: IssueReportSummaryJsonOutput
}) => {
  const base = renderIssueReportSummaryWithPublishGate(
    params.result,
    params.publishGateSummary,
  )
  if (!params.summaryPath) {
    return base
  }

  return [base, '', renderIssueReportSummaryBundleHandoff(params.summary)].join('\n')
}
