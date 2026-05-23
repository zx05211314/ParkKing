import { normalizeOptionalText } from '../api/client'
import type { SegmentReport } from './reportTypes'

interface ReportStore {
  schemaVersion: number
  reports: SegmentReport[]
}

interface ReportsEnvelope {
  reports?: unknown
  revision?: unknown
  reportsRevision?: unknown
}

interface ParsedReportsPayload {
  valid: boolean
  reports: SegmentReport[]
}

export const REPORTS_SCHEMA_VERSION = 1
export const REPORTS_STORAGE_KEY = 'pk.segmentReports.v1'

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const normalizeNote = (note?: string | null) => {
  if (!note) {
    return null
  }
  const trimmed = note.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const normalizeReportSegmentId = (segmentId: string) => {
  return segmentId.replace(/-part-\d+$/i, '')
}

const withSchemaVersion = (report: SegmentReport): SegmentReport => {
  const schemaVersion =
    typeof report.schemaVersion === 'number' ? report.schemaVersion : REPORTS_SCHEMA_VERSION
  return { ...report, schemaVersion }
}

const normalizeReport = (value: unknown): SegmentReport | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<SegmentReport>
  const districtId = normalizeOptionalText(candidate.districtId)
  const segmentId = normalizeOptionalText(candidate.segmentId)
  const status =
    candidate.status === 'LEGAL' || candidate.status === 'ILLEGAL' || candidate.status === 'UNCLEAR'
      ? candidate.status
      : null
  const createdAt = normalizeOptionalText(candidate.createdAt)
  if (!districtId || !segmentId || !status || !createdAt) {
    return null
  }

  return withSchemaVersion({
    schemaVersion:
      typeof candidate.schemaVersion === 'number'
        ? candidate.schemaVersion
        : REPORTS_SCHEMA_VERSION,
    districtId,
    segmentId: normalizeReportSegmentId(segmentId),
    status,
    note: normalizeNote(candidate.note),
    createdAt,
  })
}

const dedupeReports = (reports: SegmentReport[]) => {
  const unique = new Map<string, SegmentReport>()
  reports.forEach((report) => {
    const normalized = normalizeReport(report)
    if (!normalized) {
      return
    }
    const key = [
      normalized.districtId,
      normalized.segmentId,
      normalized.status,
      normalized.createdAt,
      normalized.note ?? '',
      normalized.schemaVersion,
    ].join('::')
    unique.set(key, normalized)
  })

  return Array.from(unique.values()).sort((left, right) => {
    const byTime = left.createdAt.localeCompare(right.createdAt)
    if (byTime !== 0) {
      return byTime
    }
    const byDistrict = left.districtId.localeCompare(right.districtId)
    if (byDistrict !== 0) {
      return byDistrict
    }
    const bySegment = left.segmentId.localeCompare(right.segmentId)
    if (bySegment !== 0) {
      return bySegment
    }
    const byStatus = left.status.localeCompare(right.status)
    if (byStatus !== 0) {
      return byStatus
    }
    return (left.note ?? '').localeCompare(right.note ?? '')
  })
}

const normalizeStore = (value: unknown): ReportStore => {
  if (!value || typeof value !== 'object') {
    return { schemaVersion: REPORTS_SCHEMA_VERSION, reports: [] }
  }
  const parsed = value as Partial<ReportStore>
  return {
    schemaVersion:
      typeof parsed.schemaVersion === 'number'
        ? parsed.schemaVersion
        : REPORTS_SCHEMA_VERSION,
    reports: dedupeReports(Array.isArray(parsed.reports) ? parsed.reports : []),
  }
}

const normalizeRevision = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.floor(value)
}

export const readStore = (): ReportStore => {
  if (!isBrowser()) {
    return { schemaVersion: REPORTS_SCHEMA_VERSION, reports: [] }
  }
  try {
    const raw = window.localStorage.getItem(REPORTS_STORAGE_KEY)
    if (!raw) {
      return { schemaVersion: REPORTS_SCHEMA_VERSION, reports: [] }
    }
    return normalizeStore(JSON.parse(raw))
  } catch {
    return { schemaVersion: REPORTS_SCHEMA_VERSION, reports: [] }
  }
}

export const writeStore = (store: ReportStore) => {
  if (!isBrowser()) {
    return
  }
  try {
    window.localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore write failures
  }
}

export const readReportsRevision = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const envelope = payload as ReportsEnvelope
  return (
    normalizeRevision(envelope.revision) ??
    normalizeRevision(envelope.reportsRevision)
  )
}

export const parseRemoteReportsPayload = (payload: unknown): ParsedReportsPayload => {
  if (Array.isArray(payload)) {
    return {
      valid: true,
      reports: dedupeReports(payload as SegmentReport[]),
    }
  }
  if (payload && typeof payload === 'object') {
    const envelope = payload as ReportsEnvelope
    if ('reports' in envelope) {
      return {
        valid: true,
        reports: dedupeReports(Array.isArray(envelope.reports) ? (envelope.reports as SegmentReport[]) : []),
      }
    }
  }
  return {
    valid: false,
    reports: [],
  }
}

export const mergeReportLists = (left: SegmentReport[], right: SegmentReport[]) =>
  dedupeReports([...left, ...right])
