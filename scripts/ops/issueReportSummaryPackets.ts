import type {
  IssueReportPacketReasonCount,
  IssueReportReasonPacket,
  IssueReportSegmentPacket,
  IssueReportSummaryResult,
  IssueReportTriagePacketBundle,
  SyncIssueReportDistrictSummary,
  SyncIssueReportRawIssue,
  SyncIssueReportSegmentSummary,
} from './issueReportSummaryTypes'
import type { NightlyPublishGateSummary } from './notifyNightlyTypes'

const compareNullableDescending = (left: string | null, right: string | null) => {
  if (left && right) {
    return right.localeCompare(left)
  }
  if (left) {
    return -1
  }
  if (right) {
    return 1
  }
  return 0
}

const sortDistrictSummaries = (summaries: SyncIssueReportDistrictSummary[]) =>
  [...summaries].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count
    }
    const byLatest = compareNullableDescending(left.latestCreatedAt, right.latestCreatedAt)
    if (byLatest !== 0) {
      return byLatest
    }
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope)
    }
    return left.districtId.localeCompare(right.districtId)
  })

const sortSegmentSummaries = (summaries: SyncIssueReportSegmentSummary[]) =>
  [...summaries].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count
    }
    const byLatest = compareNullableDescending(left.latestCreatedAt, right.latestCreatedAt)
    if (byLatest !== 0) {
      return byLatest
    }
    if (left.scope !== right.scope) {
      return left.scope.localeCompare(right.scope)
    }
    if (left.districtId !== right.districtId) {
      return left.districtId.localeCompare(right.districtId)
    }
    return left.segmentId.localeCompare(right.segmentId)
  })

const buildPacketId = (parts: Array<string | null>) =>
  parts
    .filter((part): part is string => Boolean(part))
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const summarizeReasonCounts = (
  issues: SyncIssueReportRawIssue[],
): IssueReportPacketReasonCount[] => {
  const counts = new Map<string, number>()
  issues.forEach((issue) => {
    issue.reasonCodes.forEach((reasonCode) => {
      counts.set(reasonCode, (counts.get(reasonCode) ?? 0) + 1)
    })
  })

  return Array.from(counts.entries())
    .map(([reasonCode, count]) => ({ reasonCode, count }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count
      }
      return left.reasonCode.localeCompare(right.reasonCode)
    })
}

const buildSegmentPackets = (
  result: IssueReportSummaryResult,
  packetIssueLimit: number,
): IssueReportSegmentPacket[] =>
  result.topSegments.map((summary, index) => {
    const matchingIssues = result.rawIssues.filter(
      (issue) =>
        issue.scope === summary.scope &&
        issue.districtId === summary.districtId &&
        issue.segmentId === summary.segmentId,
    )

    return {
      packetKind: 'segment',
      rank: index + 1,
      packetId: buildPacketId([summary.scope, summary.districtId, summary.segmentId]),
      scope: summary.scope,
      districtId: summary.districtId,
      segmentId: summary.segmentId,
      segmentName: summary.segmentName,
      segmentTier: summary.segmentTier,
      count: summary.count,
      latestCreatedAt: summary.latestCreatedAt,
      latestSummary: summary.latestSummary,
      reasonCounts: summarizeReasonCounts(matchingIssues),
      recentIssues: matchingIssues.slice(0, packetIssueLimit),
    }
  })

const buildReasonPackets = (
  result: IssueReportSummaryResult,
  packetIssueLimit: number,
): IssueReportReasonPacket[] =>
  result.topReasons.map((summary, index) => {
    const matchingIssues = result.rawIssues.filter((issue) =>
      issue.reasonCodes.includes(summary.reasonCode),
    )
    const relatedDistrictKeys = new Set(
      matchingIssues.map((issue) => `${issue.scope}::${issue.districtId}`),
    )
    const relatedSegmentKeys = new Set(
      matchingIssues
        .filter((issue) => issue.segmentId)
        .map((issue) => `${issue.scope}::${issue.districtId}::${issue.segmentId}`),
    )

    return {
      packetKind: 'reason',
      rank: index + 1,
      packetId: buildPacketId([summary.reasonCode]),
      reasonCode: summary.reasonCode,
      count: summary.count,
      districtCount: summary.districtCount,
      segmentCount: summary.segmentCount,
      latestCreatedAt: summary.latestCreatedAt,
      latestDistrictId: summary.latestDistrictId,
      latestSegmentId: summary.latestSegmentId,
      latestSegmentName: summary.latestSegmentName,
      relatedDistricts: sortDistrictSummaries(
        result.summaries.filter((district) =>
          relatedDistrictKeys.has(`${district.scope}::${district.districtId}`),
        ),
      ).slice(0, packetIssueLimit),
      relatedSegments: sortSegmentSummaries(
        result.segmentSummaries.filter((segment) =>
          relatedSegmentKeys.has(
            `${segment.scope}::${segment.districtId}::${segment.segmentId}`,
          ),
        ),
      ).slice(0, packetIssueLimit),
      recentIssues: matchingIssues.slice(0, packetIssueLimit),
    }
  })

export const buildIssueReportTriagePacketBundle = (
  result: IssueReportSummaryResult,
  packetIssueLimit: number,
  publishGateSummary: NightlyPublishGateSummary | null = null,
  generatedAt = new Date().toISOString(),
): IssueReportTriagePacketBundle => ({
  generatedAt,
  storageFile: result.storageFile,
  filters: result.filters,
  totalCount: result.totalCount,
  filteredCount: result.filteredCount,
  publishGateSummary,
  segmentPackets: buildSegmentPackets(result, packetIssueLimit),
  reasonPackets: buildReasonPackets(result, packetIssueLimit),
})
