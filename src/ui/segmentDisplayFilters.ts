import { applyRankingPolicy, type RiskMode } from '../domain/ranking/policy'
import { normalizeReportSegmentId, type ReportStatus } from '../feedback/reports'
import { distanceMeters, getPathMidpoint } from '../map/geo'
import { filterSegmentsByAction, type SegmentActionFilter } from './segmentActionFilter'
import type { SegmentListItem } from './segmentListTypes'
import type { EvaluatedSegment } from './types'

export const buildSegmentsWithDistance = (
  evaluatedSegments: EvaluatedSegment[],
  activeDistanceLocation: [number, number] | null,
  includeInferred: boolean,
  radiusMeters: number,
  riskMode: RiskMode,
): SegmentListItem[] => {
  const withDistance: SegmentListItem[] = evaluatedSegments.map((segment) => ({
    ...segment,
    distanceMeters: activeDistanceLocation
      ? distanceMeters(activeDistanceLocation, getPathMidpoint(segment.path))
      : undefined,
  }))

  return applyRankingPolicy(withDistance, {
    includeInferred,
    radiusMeters,
    riskMode,
  })
}

export const countIllegalFeedbackHidden = (
  segmentsWithDistance: SegmentListItem[],
  hideReportedIllegal: boolean,
  reportsBySegment: Record<string, { status: ReportStatus }>,
) =>
  hideReportedIllegal
    ? segmentsWithDistance.filter(
        (segment) =>
          reportsBySegment[normalizeReportSegmentId(segment.id)]?.status === 'ILLEGAL',
      ).length
    : 0

export const filterFeedbackIllegalSegments = (
  segmentsWithDistance: SegmentListItem[],
  hideReportedIllegal: boolean,
  reportsBySegment: Record<string, { status: ReportStatus }>,
) =>
  hideReportedIllegal
    ? segmentsWithDistance.filter(
        (segment) =>
          reportsBySegment[normalizeReportSegmentId(segment.id)]?.status !== 'ILLEGAL',
      )
    : segmentsWithDistance

export const buildActionFilteredSegmentState = (
  feedbackFilteredSegments: SegmentListItem[],
  actionFilter: SegmentActionFilter,
) => {
  const actionFilteredSegments = filterSegmentsByAction(
    feedbackFilteredSegments,
    actionFilter,
  )

  return {
    actionFilteredSegments,
    actionFilterHiddenCount:
      feedbackFilteredSegments.length - actionFilteredSegments.length,
    actionFilteredMarkedSpaceSegmentCount: actionFilteredSegments.filter(
      (segment) => (segment.parkingSpaceCount ?? 0) > 0,
    ).length,
  }
}

export const getSearchableSegments = (
  actionFilteredSegments: SegmentListItem[],
  markedSpacesOnly: boolean,
) =>
  markedSpacesOnly
    ? actionFilteredSegments.filter((segment) => (segment.parkingSpaceCount ?? 0) > 0)
    : actionFilteredSegments
