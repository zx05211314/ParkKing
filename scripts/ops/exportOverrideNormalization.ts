import {
  REPORT_SCHEMA_VERSION,
  type ReportStatus,
  type SegmentReport,
} from './exportOverrideTypes'
import { normalizeReviewTimestamp } from './reviewTimestamp'

export const normalizeDistrictId = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length === 0) {
    return 'district'
  }
  const dashed = trimmed.replace(/[\s_]+/g, '-')
  const normalized = dashed.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  return normalized.replace(/^-+|-+$/g, '') || 'district'
}

export const normalizeSegmentId = (value: string) => {
  return value.replace(/-part-\d+$/i, '')
}

export const normalizeNote = (note?: string | null) => {
  if (!note) {
    return null
  }
  const trimmed = note.trim()
  return trimmed.length > 0 ? trimmed : null
}

const isReportStatus = (value: string): value is ReportStatus => {
  return value === 'LEGAL' || value === 'ILLEGAL' || value === 'UNCLEAR'
}

export const sanitizeSegmentReport = (report: SegmentReport): SegmentReport | null => {
  if (!report || typeof report !== 'object') {
    return null
  }
  const districtId = typeof report.districtId === 'string' ? report.districtId.trim() : ''
  const segmentId = typeof report.segmentId === 'string' ? report.segmentId.trim() : ''
  const status = typeof report.status === 'string' ? report.status.trim().toUpperCase() : ''
  const createdAt = normalizeReviewTimestamp(report.createdAt) ?? ''
  const note = normalizeNote(report.note)
  if (!districtId || !segmentId || !createdAt || !note || !isReportStatus(status)) {
    return null
  }
  const parsedSchema =
    typeof report.schemaVersion === 'number'
      ? report.schemaVersion
      : typeof report.schemaVersion === 'string'
        ? Number(report.schemaVersion)
        : NaN
  const schemaVersion =
    Number.isFinite(parsedSchema) && parsedSchema >= 1
      ? parsedSchema
      : REPORT_SCHEMA_VERSION
  return {
    schemaVersion,
    districtId,
    segmentId: normalizeSegmentId(segmentId),
    status,
    note,
    createdAt,
  }
}
