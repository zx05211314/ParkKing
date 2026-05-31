import {
  normalizeReportSegmentId,
  REPORTS_SCHEMA_VERSION,
} from './reportStore'
import { REPORT_STATUS_PRIORITY, type ReportStatus, type SegmentReport } from './reportTypes'

const withSchemaVersion = (report: SegmentReport): SegmentReport => ({
  ...report,
  schemaVersion:
    typeof report.schemaVersion === 'number'
      ? report.schemaVersion
      : REPORTS_SCHEMA_VERSION,
})

export const getLatestReportsBySegment = (
  reports: SegmentReport[],
  districtId: string,
): Record<string, SegmentReport> => {
  const latest: Record<string, SegmentReport> = {}
  reports
    .filter((report) => report.districtId === districtId)
    .forEach((report) => {
      const normalized = normalizeReportSegmentId(report.segmentId)
      const candidate = { ...report, segmentId: normalized }
      const existing = latest[normalized]
      if (!existing) {
        latest[normalized] = withSchemaVersion(candidate)
        return
      }
      if (candidate.createdAt > existing.createdAt) {
        latest[normalized] = withSchemaVersion(candidate)
      }
    })
  return latest
}

export const compareReportStatusPriority = (
  left: ReportStatus | null | undefined,
  right: ReportStatus | null | undefined,
) => {
  const leftPriority = left ? REPORT_STATUS_PRIORITY[left] : 1
  const rightPriority = right ? REPORT_STATUS_PRIORITY[right] : 1
  return leftPriority - rightPriority
}

const isReportNewer = (next: SegmentReport, current: SegmentReport) => {
  if (next.createdAt !== current.createdAt) {
    return next.createdAt > current.createdAt
  }
  if (next.status !== current.status) {
    return next.status.localeCompare(current.status) > 0
  }
  const nextNote = next.note ?? ''
  const currentNote = current.note ?? ''
  if (nextNote !== currentNote) {
    return nextNote.localeCompare(currentNote) > 0
  }
  return next.schemaVersion > current.schemaVersion
}

export const getLatestReports = (reports: SegmentReport[]) => {
  const latest = new Map<string, SegmentReport>()
  reports.forEach((report) => {
    const normalizedId = normalizeReportSegmentId(report.segmentId)
    const candidate = {
      ...report,
      schemaVersion:
        typeof report.schemaVersion === 'number'
          ? report.schemaVersion
          : REPORTS_SCHEMA_VERSION,
      segmentId: normalizedId,
    }
    const key = `${candidate.districtId}::${candidate.segmentId}`
    const existing = latest.get(key)
    if (!existing || isReportNewer(candidate, existing)) {
      latest.set(key, candidate)
    }
  })

  return Array.from(latest.values()).sort((a, b) => {
    const byDistrict = a.districtId.localeCompare(b.districtId)
    if (byDistrict !== 0) {
      return byDistrict
    }
    const bySegment = a.segmentId.localeCompare(b.segmentId)
    if (bySegment !== 0) {
      return bySegment
    }
    const byTime = a.createdAt.localeCompare(b.createdAt)
    if (byTime !== 0) {
      return byTime
    }
    const byStatus = a.status.localeCompare(b.status)
    if (byStatus !== 0) {
      return byStatus
    }
    return (a.note ?? '').localeCompare(b.note ?? '')
  })
}

export const formatReportTimestamp = (value?: string | null) => {
  if (!value) {
    return 'Unknown'
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}
