import type {
  IssueReportPublishGateHotspot,
  IssueReportSegmentPacket,
  SyncIssueReportSegmentSummary,
} from './issueReportSummaryTypes'
import type { NightlyPublishGateSummary } from './notifyNightlyTypes'

type DistrictIssueHotspot = Pick<
  SyncIssueReportSegmentSummary | IssueReportSegmentPacket,
  'districtId' | 'segmentId' | 'segmentName'
>

export const findDistrictIssueHotspot = <T extends DistrictIssueHotspot>(
  hotspots: readonly T[],
  districtId: string,
): T | null => hotspots.find((hotspot) => hotspot.districtId === districtId) ?? null

export const formatDistrictIssueHotspotLabel = (
  hotspot:
    | (Pick<DistrictIssueHotspot, 'segmentId' | 'segmentName'>
      & Partial<Pick<DistrictIssueHotspot, 'districtId'>>)
    | null,
) => {
  if (!hotspot) {
    return '-'
  }

  return hotspot.segmentName
    ? `${hotspot.segmentName} (${hotspot.segmentId})`
    : hotspot.segmentId
}

export const buildIssueReportPublishGateHotspots = (
  hotspots: readonly DistrictIssueHotspot[],
  publishGateSummary: NightlyPublishGateSummary | null,
): IssueReportPublishGateHotspot[] => {
  const topDistricts = publishGateSummary?.topDistricts ?? []

  return topDistricts.map((district) => {
    const hotspot = findDistrictIssueHotspot(hotspots, district.districtId)
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
      issueHotspotSegmentLabel: formatDistrictIssueHotspotLabel(hotspot),
    }
  })
}
