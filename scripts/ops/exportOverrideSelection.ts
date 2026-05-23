import type { SegmentReport } from './exportOverrideTypes'

export const isReportNewer = (next: SegmentReport, current: SegmentReport) => {
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
  const nextSchema = typeof next.schemaVersion === 'number' ? next.schemaVersion : 0
  const currentSchema =
    typeof current.schemaVersion === 'number' ? current.schemaVersion : 0
  return nextSchema > currentSchema
}

export const selectLatestReports = (reports: SegmentReport[]) => {
  const latest = new Map<string, SegmentReport>()
  reports.forEach((report) => {
    const key = `${report.districtId}::${report.segmentId}`
    const existing = latest.get(key)
    if (!existing || isReportNewer(report, existing)) {
      latest.set(key, report)
    }
  })
  return Array.from(latest.values())
}

export const groupReportsByDistrict = (reports: SegmentReport[]) => {
  const byDistrict = new Map<string, SegmentReport[]>()
  reports.forEach((report) => {
    const bucket = byDistrict.get(report.districtId) ?? []
    bucket.push(report)
    byDistrict.set(report.districtId, bucket)
  })
  return Array.from(byDistrict.entries()).sort((a, b) => a[0].localeCompare(b[0]))
}

export const sortDistrictReports = (reports: SegmentReport[]) => {
  return [...reports].sort((a, b) => {
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
