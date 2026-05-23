import { reasonText } from '../domain/reasons/reasonText'
import { getParkingSpaceBackedDetail } from './parkingEvidencePresentation'
import type { SegmentSheetProps } from './segmentSheetTypes'
import {
  formatDistance,
  formatFreshness,
  formatParkingSpaceCount,
  formatScore,
  riskModeLabel,
} from './segmentSheetFormatting'

type SegmentSheetSummarySectionProps = Pick<
  SegmentSheetProps,
  'segment' | 'rankBreakdown' | 'riskMode' | 'distanceMeters'
>

export function SegmentSheetSummarySection({
  segment,
  rankBreakdown,
  riskMode,
  distanceMeters,
}: SegmentSheetSummarySectionProps) {
  if (!segment) {
    return null
  }

  const parkingEvidenceNote = getParkingSpaceBackedDetail(segment)

  return (
    <>
      <div className="segment-sheet-grid">
        <div>
          <div className="segment-sheet-label">Allowed now</div>
          <div className="segment-sheet-value">
            {segment.allowedNow.replace('_', ' ')}
          </div>
        </div>
        <div>
          <div className="segment-sheet-label">Tier</div>
          <div className={`tier-pill tier-${segment.tier.toLowerCase()}`}>
            {segment.tier}
          </div>
        </div>
        <div>
          <div className="segment-sheet-label">Curb marking</div>
          <div className="segment-sheet-value">{segment.curbMarking}</div>
        </div>
        <div>
          <div className="segment-sheet-label">Coverage</div>
          <div className="segment-sheet-value">{segment.coverageConfidence}</div>
        </div>
        <div>
          <div className="segment-sheet-label">Override confidence</div>
          <div className="segment-sheet-value">{segment.overrideConfidence}</div>
        </div>
        <div>
          <div className="segment-sheet-label">Final confidence</div>
          <div className="segment-sheet-value">{segment.finalConfidence}</div>
        </div>
        <div>
          <div className="segment-sheet-label">Reliability</div>
          <div className="segment-sheet-value">{segment.sourceReliability}</div>
        </div>
        <div>
          <div className="segment-sheet-label">Freshness</div>
          <div className="segment-sheet-value">
            {formatFreshness(segment.dataFreshnessDays)}
          </div>
        </div>
        <div>
          <div className="segment-sheet-label">Marked spaces</div>
          <div className="segment-sheet-value">
            {formatParkingSpaceCount(segment.parkingSpaceCount)}
          </div>
        </div>
      </div>

      {parkingEvidenceNote ? (
        <div className="segment-sheet-section">
          <div className="segment-sheet-label">Why this is green</div>
          <div className="control-meta">{parkingEvidenceNote}</div>
        </div>
      ) : null}

      <div className="segment-sheet-section">
        <div className="segment-sheet-label">Triggered rules</div>
        <ul>
          {segment.reasonCodes && segment.reasonCodes.length > 0 ? (
            segment.reasonCodes.map((code) => (
              <li key={code}>
                {code}: {reasonText(code)}
              </li>
            ))
          ) : segment.reasons && segment.reasons.length > 0 ? (
            segment.reasons.map((reason) => <li key={reason}>{reason}</li>)
          ) : (
            <li>-</li>
          )}
        </ul>
      </div>

      {rankBreakdown ? (
        <div className="segment-sheet-section">
          <div className="segment-sheet-label">
            Penalties &amp; bonuses
            {riskMode ? ` (${riskModeLabel(riskMode)})` : ''}
          </div>
          <ul>
            <li>Distance weight: {formatScore(rankBreakdown.distanceWeight)}</li>
            <li>Tier weight: {formatScore(rankBreakdown.tierWeight)}</li>
            <li>Confidence weight: {formatScore(rankBreakdown.confidenceWeight)}</li>
            <li>Inferred penalty: {formatScore(rankBreakdown.inferredPenalty)}</li>
            <li>Freshness bonus: {formatScore(rankBreakdown.freshnessBonus)}</li>
            <li>Zone density penalty: {formatScore(rankBreakdown.zoneDensityPenalty)}</li>
            <li>Total score: {formatScore(rankBreakdown.total)}</li>
            <li>Distance: {formatDistance(distanceMeters)}</li>
          </ul>
        </div>
      ) : null}
    </>
  )
}
