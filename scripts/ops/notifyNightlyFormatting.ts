import type {
  NightlyAlert,
  NightlyIssueArtifactOutputs,
  NightlyIssueReasonHotspot,
  NightlyIssueReportSummary,
  NightlyIssueSegmentHotspot,
  NightlyPublishGateSummary,
} from './notifyNightlyTypes'

const formatSigned = (value: number | null, decimals = 1, suffix = '') => {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toFixed(decimals)}${suffix}`
}

const formatPercent = (value: number | null) =>
  formatSigned(value === null ? null : value * 100, 1, '%')

const formatPoints = (value: number | null) =>
  formatSigned(value === null ? null : value * 100, 1, 'pp')

const formatCount = (value: number | null) => formatSigned(value, 0)

const formatArtifactReference = (params: {
  label: string
  url: string | null
  path: string | null
  detail?: string | null
}) => {
  const suffix =
    params.detail && params.detail.trim().length > 0
      ? ` (${params.detail})`
      : ''
  if (params.url) {
    return `- ${params.label}: [download artifact](${params.url})${suffix}`
  }
  if (params.path) {
    return `- ${params.label}: ${params.path}${suffix}`
  }
  return null
}

export const buildNightlyIssueBody = (params: {
  alerts: NightlyAlert[]
  issueReports?: NightlyIssueReportSummary[]
  topIssueSegments?: NightlyIssueSegmentHotspot[]
  topIssueReasons?: NightlyIssueReasonHotspot[]
  issueArtifacts?: NightlyIssueArtifactOutputs
  publishGateSummary?: NightlyPublishGateSummary | null
  runUrl?: string | null
}) => {
  const lines: string[] = []
  lines.push(`Date: ${new Date().toISOString()}`)
  if (params.runUrl) {
    lines.push(`Run: ${params.runUrl}`)
  }
  lines.push('')

  if (params.publishGateSummary) {
    lines.push('Publish gate summary:')
    lines.push('')
    lines.push('| Mode | Exit code | INFO | WARN | FAIL | Allow fail | Override reason |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    lines.push(
      `| ${params.publishGateSummary.mode} | ${params.publishGateSummary.exitCode} | ${params.publishGateSummary.totals.info} | ${params.publishGateSummary.totals.warn} | ${params.publishGateSummary.totals.fail} | ${params.publishGateSummary.allowFail ? 'yes' : 'no'} | ${(params.publishGateSummary.overrideReason ?? '-').replace(/\|/g, '\\|')} |`,
    )

    if (params.publishGateSummary.topDistricts.length > 0) {
      lines.push('')
      lines.push('Top publish gate districts:')
      lines.push('')
      lines.push(
        '| District | WARN | FAIL | Top WARN | Top FAIL | Direct overrides | Spatial overrides | Unmatched named |',
      )
      lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
      params.publishGateSummary.topDistricts.forEach((district) => {
        lines.push(
          `| ${district.districtId} | ${district.warn} | ${district.fail} | ${district.topWarnCodes.join(', ') || '-'} | ${district.topFailCodes.join(', ') || '-'} | ${formatCount(district.signOverrideBreakdown?.matchedBySegmentId ?? null)} | ${formatCount(district.signOverrideBreakdown?.matchedBySpatial ?? null)} | ${formatCount(district.signOverrideBreakdown?.unmatchedNamed ?? null)} |`,
        )
      })
    }

    const publishGateReference = formatArtifactReference({
      label: 'Publish gate summary',
      url: params.publishGateSummary.summaryUrl,
      path: params.publishGateSummary.summaryPath,
    })
    if (publishGateReference) {
      lines.push('')
      lines.push(publishGateReference)
    }
    lines.push('')
  }

  if (params.alerts.length > 0) {
    lines.push(
      '| District | Severity | Segments delta % | Direct override match ? | Spatial override match ? | Unmatched named overrides ? | Curb known delta | Restriction delta |',
    )
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |')
    params.alerts.forEach((alert) => {
      lines.push(
        `| ${alert.districtId} | ${alert.severity} | ${formatPercent(alert.segmentsDeltaPct)} | ${formatCount(alert.directOverrideMatchesDelta)} | ${formatCount(alert.spatialOverrideMatchesDelta)} | ${formatCount(alert.unmatchedNamedOverridesDelta)} | ${formatPoints(alert.curbKnownDelta)} | ${formatPoints(alert.restrictionDelta)} |`,
      )
    })
  } else {
    lines.push('No WARN/FAIL districts found in diff reports.')
  }

  if ((params.issueReports?.length ?? 0) > 0) {
    lines.push('')
    lines.push('Synced user issue reports:')
    lines.push('')
    lines.push('| Scope | District | Count | Latest | Example |')
    lines.push('| --- | --- | --- | --- | --- |')
    params.issueReports?.forEach((issueReport) => {
      lines.push(
        `| ${issueReport.scope} | ${issueReport.districtId} | ${issueReport.count} | ${issueReport.latestCreatedAt ?? '-'} | ${(issueReport.latestSummary ?? '-').replace(/\|/g, '\\|')} |`,
      )
    })
  }

  if ((params.topIssueSegments?.length ?? 0) > 0) {
    lines.push('')
    lines.push('Top recurring issue segments:')
    lines.push('')
    lines.push('| Scope | District | Segment | Tier | Count | Latest | Example |')
    lines.push('| --- | --- | --- | --- | --- | --- | --- |')
    params.topIssueSegments?.forEach((segment) => {
      const segmentLabel =
        segment.segmentName && segment.segmentId
          ? `${segment.segmentName} (${segment.segmentId})`
          : segment.segmentName ?? segment.segmentId
      lines.push(
        `| ${segment.scope} | ${segment.districtId} | ${segmentLabel.replace(/\|/g, '\\|')} | ${segment.segmentTier ?? '-'} | ${segment.count} | ${segment.latestCreatedAt ?? '-'} | ${(segment.latestSummary ?? '-').replace(/\|/g, '\\|')} |`,
      )
    })
  }

  if ((params.topIssueReasons?.length ?? 0) > 0) {
    lines.push('')
    lines.push('Top recurring issue reasons:')
    lines.push('')
    lines.push('| Reason | Count | Districts | Segments | Latest | Latest location |')
    lines.push('| --- | --- | --- | --- | --- | --- |')
    params.topIssueReasons?.forEach((reason) => {
      const latestLocation =
        reason.latestSegmentName && reason.latestSegmentId
          ? `${reason.latestDistrictId ?? '-'} / ${reason.latestSegmentName} (${reason.latestSegmentId})`
          : reason.latestSegmentId
            ? `${reason.latestDistrictId ?? '-'} / ${reason.latestSegmentId}`
            : reason.latestDistrictId ?? '-'
      lines.push(
        `| ${reason.reasonCode} | ${reason.count} | ${reason.districtCount} | ${reason.segmentCount} | ${reason.latestCreatedAt ?? '-'} | ${latestLocation.replace(/\|/g, '\\|')} |`,
      )
    })
  }

  if (
    params.issueArtifacts?.indexUrl ||
    params.issueArtifacts?.packetRootPath ||
    params.issueArtifacts?.csvRootPath ||
    params.issueArtifacts?.workflowSummaryUrl ||
    params.issueArtifacts?.workflowSummaryPath ||
    params.issueArtifacts?.indexSummaryUrl ||
    params.issueArtifacts?.indexSummaryPath ||
    params.issueArtifacts?.indexSummaryJsonUrl ||
    params.issueArtifacts?.indexSummaryJsonPath ||
    params.issueArtifacts?.indexSurfaceUrl ||
    params.issueArtifacts?.indexSurfacePath ||
    params.issueArtifacts?.packetSummaryUrl ||
    params.issueArtifacts?.packetSummaryPath ||
    params.issueArtifacts?.packetRootUrl ||
    params.issueArtifacts?.packetUrl ||
    params.issueArtifacts?.csvRootUrl ||
    params.issueArtifacts?.csvUrl
  ) {
    lines.push('')
    lines.push('Issue triage artifacts:')
    lines.push('')
    const indexReference = formatArtifactReference({
      label: 'Issue index',
      url: params.issueArtifacts.indexUrl,
      path: params.issueArtifacts.indexPath,
    })
    const workflowSummaryReference = formatArtifactReference({
      label: 'Issue workflow summary',
      url: params.issueArtifacts.workflowSummaryUrl,
      path: params.issueArtifacts.workflowSummaryPath,
      detail: params.issueArtifacts.workflowSummaryRelativePath,
    })
    const indexSummaryReference = formatArtifactReference({
      label: 'Issue index summary',
      url: params.issueArtifacts.indexSummaryUrl,
      path: params.issueArtifacts.indexSummaryPath,
      detail: params.issueArtifacts.indexSummaryRelativePath,
    })
    const indexSummaryJsonReference = formatArtifactReference({
      label: 'Issue index summary json',
      url: params.issueArtifacts.indexSummaryJsonUrl,
      path: params.issueArtifacts.indexSummaryJsonPath,
      detail: params.issueArtifacts.indexSummaryJsonRelativePath,
    })
    const indexSurfaceReference = formatArtifactReference({
      label: 'Issue index surface',
      url: params.issueArtifacts.indexSurfaceUrl,
      path: params.issueArtifacts.indexSurfacePath,
      detail: params.issueArtifacts.indexSurfaceRelativePath,
    })
    const packetSummaryReference = formatArtifactReference({
      label: 'Packet summary',
      url: params.issueArtifacts.packetSummaryUrl,
      path: params.issueArtifacts.packetSummaryPath,
      detail: params.issueArtifacts.packetSummaryRelativePath,
    })
    const packetManifestReference = formatArtifactReference({
      label: 'Packet preferred portable input',
      url: params.issueArtifacts.packetManifestUrl,
      path: params.issueArtifacts.packetManifestPath,
      detail: params.issueArtifacts.packetManifestRelativePath,
    })
    const packetRootReference = formatArtifactReference({
      label: 'Packet root',
      url: null,
      path: params.issueArtifacts.packetRootPath,
    })
    const packetReference = formatArtifactReference({
      label: 'Packet root URL',
      url: params.issueArtifacts.packetRootUrl ?? params.issueArtifacts.packetUrl,
      path: null,
    })
    const csvRootReference = formatArtifactReference({
      label: 'CSV exchange root',
      url: null,
      path: params.issueArtifacts.csvRootPath,
    })
    const csvReference = formatArtifactReference({
      label: 'CSV exchange root URL',
      url: params.issueArtifacts.csvRootUrl ?? params.issueArtifacts.csvUrl,
      path: null,
    })
    const preferredCsvReference = formatArtifactReference({
      label: 'Preferred CSV join file',
      url: params.issueArtifacts.preferredCsvUrl,
      path: params.issueArtifacts.preferredCsvPath,
      detail: params.issueArtifacts.preferredCsvRelativePath,
    })
    if (indexReference) {
      lines.push(indexReference)
    }
    if (workflowSummaryReference) {
      lines.push(workflowSummaryReference)
    }
    if (indexSummaryReference) {
      lines.push(indexSummaryReference)
    }
    if (indexSummaryJsonReference) {
      lines.push(indexSummaryJsonReference)
    }
    if (indexSurfaceReference) {
      lines.push(indexSurfaceReference)
    }
    if (packetSummaryReference) {
      lines.push(packetSummaryReference)
    }
    if (packetManifestReference) {
      lines.push(packetManifestReference)
    }
    if (packetRootReference) {
      lines.push(packetRootReference)
    }
    if (packetReference) {
      lines.push(packetReference)
    }
    if (csvRootReference) {
      lines.push(csvRootReference)
    }
    if (csvReference) {
      lines.push(csvReference)
    }
    if (preferredCsvReference) {
      lines.push(preferredCsvReference)
    }
  }

  return lines.join('\n')
}
