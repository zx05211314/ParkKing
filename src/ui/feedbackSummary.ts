import {
  REPORT_STATUS_LABELS,
  formatReportTimestamp,
  type SegmentReport,
} from '../feedback/reports'

export const formatSegmentFeedbackSummary = (report?: SegmentReport | null) => {
  if (!report) {
    return null
  }

  const parts = [
    REPORT_STATUS_LABELS[report.status],
    formatReportTimestamp(report.createdAt),
    report.note ?? null,
  ].filter(Boolean)
  return parts.join(' | ')
}
