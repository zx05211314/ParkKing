import type { EvaluatedSegment } from './types'
import {
  formatOverrideDate,
  formatOverrideSource,
} from './segmentSheetFormatting'
import { isDaytime } from '../domain/rules/time'

interface SegmentSheetOverrideSectionProps {
  signOverride: EvaluatedSegment['signOverride']
}

export function SegmentSheetOverrideSection({
  signOverride,
}: SegmentSheetOverrideSectionProps) {
  if (!signOverride) {
    return null
  }

  return (
    <div className="segment-sheet-section">
      <div className="segment-sheet-label">Override: {signOverride.note}</div>
      {signOverride.source ? (
        <div className="segment-sheet-value">
          Source: {formatOverrideSource(signOverride.source)}
        </div>
      ) : null}
      {signOverride.verifiedAt ? (
        <div className="segment-sheet-value">
          Verified: {formatOverrideDate(signOverride.verifiedAt)}
        </div>
      ) : null}
      {signOverride.reviewedSegmentId ? (
        <div className="segment-sheet-value">
          Reviewed target: {signOverride.reviewedSegmentId}
        </div>
      ) : null}
      {signOverride.reviewedHhmm ? (
        <div className="segment-sheet-value">
          Review context: {isDaytime(signOverride.reviewedHhmm) ? 'Day' : 'Night'} (
          {signOverride.reviewedHhmm})
        </div>
      ) : null}
      {signOverride.timeWindows.length === 0 ? (
        <div className="segment-sheet-value">No additional sign hours recorded.</div>
      ) : (
        <div className="time-windows">
          {signOverride.timeWindows.map((window) => (
            <div key={window.label} className="time-window">
              <span>{window.label}</span>
              <span>
                {window.startHHMM}-{window.endHHMM}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
