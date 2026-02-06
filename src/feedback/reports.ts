export type ReportStatus = 'LEGAL' | 'ILLEGAL' | 'UNCLEAR'

export interface SegmentReport {
  schemaVersion: number
  districtId: string
  segmentId: string
  status: ReportStatus
  note?: string | null
  createdAt: string
}

interface ReportStore {
  schemaVersion: number
  reports: SegmentReport[]
}

const REPORTS_SCHEMA_VERSION = 1
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

const readStore = (): ReportStore => {
  if (!isBrowser()) {
    return { schemaVersion: REPORTS_SCHEMA_VERSION, reports: [] }
  }
  try {
    const raw = window.localStorage.getItem(REPORTS_STORAGE_KEY)
    if (!raw) {
      return { schemaVersion: REPORTS_SCHEMA_VERSION, reports: [] }
    }
    const parsed = JSON.parse(raw) as Partial<ReportStore>
    if (!parsed || !Array.isArray(parsed.reports)) {
      return { schemaVersion: REPORTS_SCHEMA_VERSION, reports: [] }
    }
    return {
      schemaVersion: parsed.schemaVersion ?? REPORTS_SCHEMA_VERSION,
      reports: (parsed.reports.filter(Boolean) as SegmentReport[]).map((report) =>
        withSchemaVersion(report),
      ),
    }
  } catch {
    return { schemaVersion: REPORTS_SCHEMA_VERSION, reports: [] }
  }
}

const writeStore = (store: ReportStore) => {
  if (!isBrowser()) {
    return
  }
  try {
    window.localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore write failures
  }
}

export const readReports = (): SegmentReport[] => {
  return readStore().reports
}

export const appendReport = (entry: {
  districtId: string
  segmentId: string
  status: ReportStatus
  note?: string | null
  createdAt?: string
}): SegmentReport => {
  const store = readStore()
  const report: SegmentReport = {
    schemaVersion: REPORTS_SCHEMA_VERSION,
    districtId: entry.districtId,
    segmentId: normalizeReportSegmentId(entry.segmentId),
    status: entry.status,
    note: normalizeNote(entry.note),
    createdAt: entry.createdAt ?? new Date().toISOString(),
  }
  const next = {
    schemaVersion: REPORTS_SCHEMA_VERSION,
    reports: [...store.reports, report],
  }
  writeStore(next)
  return report
}

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
    const candidate = withSchemaVersion({ ...report, segmentId: normalizedId })
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
