import { useState } from 'react'
import {
  formatReportTimestamp,
  REPORT_STATUS_LABELS,
  type ReportStatus,
} from '../feedback/reports'
import type { SegmentSheetProps } from './segmentSheetTypes'

type SegmentSheetFeedbackSectionProps = Pick<
  SegmentSheetProps,
  'segment' | 'latestReport' | 'onReport'
>

export function SegmentSheetFeedbackSection({
  segment,
  latestReport,
  onReport,
}: SegmentSheetFeedbackSectionProps) {
  const [note, setNote] = useState('')

  const handleReport = (status: ReportStatus) => {
    if (!onReport) {
      return
    }
    onReport(status, note)
    setNote('')
  }

  return (
    <div className="segment-sheet-section">
      <div className="segment-sheet-label">Report feedback</div>
      {latestReport ? (
        <>
          <div className={`feedback-badge feedback-${latestReport.status.toLowerCase()}`}>
            {REPORT_STATUS_LABELS[latestReport.status]}
          </div>
          <div className="segment-report-status">
            Latest: {formatReportTimestamp(latestReport.createdAt)}
            {latestReport.note ? ` | ${latestReport.note}` : ''}
          </div>
        </>
      ) : (
        <div className="segment-report-status">No reports yet</div>
      )}
      <div className="segment-report-actions">
        <button
          type="button"
          onClick={() => handleReport('LEGAL')}
          disabled={!segment || !onReport}
        >
          Legal
        </button>
        <button
          type="button"
          onClick={() => handleReport('ILLEGAL')}
          disabled={!segment || !onReport}
        >
          Illegal
        </button>
        <button
          type="button"
          onClick={() => handleReport('UNCLEAR')}
          disabled={!segment || !onReport}
        >
          Unclear
        </button>
      </div>
      <textarea
        rows={3}
        value={note}
        placeholder="Optional note"
        onChange={(event) => setNote(event.target.value)}
        disabled={!segment || !onReport}
      />
    </div>
  )
}
