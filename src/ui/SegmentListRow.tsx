import { reasonTexts } from '../domain/reasons/reasonText'
import { isParkingSpaceBackedGreenSegment } from './parkingEvidencePresentation'
import {
  formatReportTimestamp,
  REPORT_STATUS_LABELS,
  normalizeReportSegmentId,
  type SegmentReport,
} from '../feedback/reports'
import {
  formatEtaDuration,
  formatParkingSpaceCount,
  formatRecommendationLabel,
  formatWalkDistance,
  tierLabel,
} from './segmentListFormatting'
import type { SegmentListItem } from './segmentListTypes'

interface SegmentListRowProps {
  segment: SegmentListItem
  selectedId: string | null
  onSelect: (segment: SegmentListItem) => void
  onNavigate?: ((segment: SegmentListItem, mode: 'walking' | 'driving') => void) | null
  onSave?: ((segment: SegmentListItem) => void) | null
  reports?: Record<string, SegmentReport>
}

export const SegmentListRow = ({
  segment,
  selectedId,
  onSelect,
  onNavigate = null,
  onSave = null,
  reports,
}: SegmentListRowProps) => {
  const reasonSnippet = segment.reasonCodes && segment.reasonCodes.length > 0
    ? reasonTexts(segment.reasonCodes).slice(0, 2).join(' / ')
    : ''
  const distanceLabel =
    segment.distanceMeters !== undefined
      ? `${(segment.distanceMeters / 1).toFixed(0)} m`
      : '-'
  const report = reports ? reports[normalizeReportSegmentId(segment.id)] : null
  const isSpaceBacked = isParkingSpaceBackedGreenSegment(segment)
  const reportLabel = report
    ? `${REPORT_STATUS_LABELS[report.status]} | ${formatReportTimestamp(report.createdAt)}`
    : null
  const parkingSpaceLabel = formatParkingSpaceCount(segment.parkingSpaceCount)
  const recommendationLabel = formatRecommendationLabel(segment.recommendationRank)
  const walkDistanceLabel = formatWalkDistance(segment.recommendedWalkDistanceMeters)
  const walkEtaLabel = formatEtaDuration(segment.recommendedWalkingDurationSeconds)
  const driveEtaLabel = formatEtaDuration(segment.recommendedDrivingDurationSeconds)
  const routeEtaLabel = [walkEtaLabel, driveEtaLabel]
    .flatMap((value, index) => {
      if (!value) {
        return []
      }
      const prefix = index === 0 ? 'Walk' : 'Drive'
      const estimated =
        index === 0
          ? segment.recommendedWalkingEstimated
          : segment.recommendedDrivingEstimated
      return [`${prefix}${estimated ? ' est.' : ''} ${value}`]
    })
    .join(' | ')
  const targetMetadataLabel =
    segment.recommendedTargetMetadata && segment.recommendedTargetMetadata.length > 0
      ? segment.recommendedTargetMetadata.join(' | ')
      : null

  return (
    <div
      className={segment.id === selectedId ? 'segment-row selected' : 'segment-row'}
    >
      <div className={`tier-badge tier-${segment.tier.toLowerCase()}`}>
        {tierLabel[segment.tier]}
      </div>
      <div className="segment-row-main">
        <button
          type="button"
          className="segment-row-content"
          onClick={() => onSelect(segment)}
        >
          <div className="segment-row-title">{segment.name}</div>
          {recommendationLabel ? (
            <div className="segment-row-target-badge">{recommendationLabel}</div>
          ) : null}
          <div className="segment-row-meta">
            <span>{segment.allowedNow.replace('_', ' ')}</span>
            {segment.sourceType === 'INFERRED' ? <span>Inferred</span> : null}
            {isSpaceBacked ? <span>Space-backed</span> : null}
            {parkingSpaceLabel ? <span>{parkingSpaceLabel}</span> : null}
            {reasonSnippet ? <span>{reasonSnippet}</span> : null}
            <span>| {distanceLabel}</span>
          </div>
          {segment.recommendedTargetLabel ? (
            <div className="segment-row-target">
              Target: {segment.recommendedTargetLabel}
              {segment.recommendedTargetKind === 'PARKING_SPACE'
                ? ' (marked space)'
                : ' (curb target)'}
              {walkDistanceLabel ? ` | ${walkDistanceLabel}` : ''}
            </div>
          ) : null}
          {segment.recommendedTargetDescription ? (
            <div className="segment-row-target-detail">
              {segment.recommendedTargetDescription}
            </div>
          ) : null}
          {routeEtaLabel ? (
            <div className="segment-row-target-meta">{routeEtaLabel}</div>
          ) : null}
          {targetMetadataLabel ? (
            <div className="segment-row-target-meta">{targetMetadataLabel}</div>
          ) : null}
          {reportLabel ? (
            <div className={`feedback-badge feedback-${report?.status.toLowerCase()}`}>
              {reportLabel}
            </div>
          ) : null}
        </button>
        <div className="segment-row-actions">
          <button
            type="button"
            className="address-recommendations-action"
            onClick={() => onSelect(segment)}
          >
            Open
          </button>
          {segment.quickActionNavigationLinks ? (
            <>
              <a
                className="address-recommendations-action"
                href={segment.quickActionNavigationLinks.walking}
                target="_blank"
                rel="noreferrer"
                onClick={() => onNavigate?.(segment, 'walking')}
              >
                Walk
              </a>
              <a
                className="address-recommendations-action"
                href={segment.quickActionNavigationLinks.driving}
                target="_blank"
                rel="noreferrer"
                onClick={() => onNavigate?.(segment, 'driving')}
              >
                Drive
              </a>
            </>
          ) : null}
          {onSave ? (
            <button
              type="button"
              className="address-recommendations-action"
              onClick={() => onSave(segment)}
            >
              Save
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
