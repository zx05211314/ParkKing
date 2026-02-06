import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

type ReportStatus = 'LEGAL' | 'ILLEGAL' | 'UNCLEAR'

interface SegmentReport {
  schemaVersion?: number
  districtId: string
  segmentId: string
  status: ReportStatus
  note?: string | null
  createdAt: string
}

interface ReportStore {
  reports?: SegmentReport[]
}

const REPORTS_STORAGE_KEY = 'pk.segmentReports.v1'
const REPORT_SCHEMA_VERSION = 1

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const inputIndex = args.findIndex((arg) => arg === '--input')
  const outIndex = args.findIndex((arg) => arg === '--outDir')
  return {
    inputPath: inputIndex >= 0 ? args[inputIndex + 1] : null,
    outDir: outIndex >= 0 ? args[outIndex + 1] : path.resolve('data', 'overrides'),
  }
}

const normalizeDistrictId = (value: string) => {
  const trimmed = value.trim().toLowerCase()
  if (trimmed.length === 0) {
    return 'district'
  }
  const dashed = trimmed.replace(/[\s_]+/g, '-')
  const normalized = dashed.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  return normalized.replace(/^-+|-+$/g, '') || 'district'
}

const normalizeSegmentId = (value: string) => {
  return value.replace(/-part-\d+$/i, '')
}

const normalizeNote = (note?: string | null) => {
  if (!note) {
    return null
  }
  const trimmed = note.trim()
  return trimmed.length > 0 ? trimmed : null
}

const isReportStatus = (value: string): value is ReportStatus => {
  return value === 'LEGAL' || value === 'ILLEGAL' || value === 'UNCLEAR'
}

const parseReportPayload = (payload: unknown): SegmentReport[] => {
  if (!payload) {
    return []
  }
  if (Array.isArray(payload)) {
    return payload as SegmentReport[]
  }
  if (typeof payload === 'string') {
    try {
      const nested = JSON.parse(payload) as unknown
      return parseReportPayload(nested)
    } catch {
      return []
    }
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.reports)) {
      return record.reports as SegmentReport[]
    }
    const stored = record[REPORTS_STORAGE_KEY]
    if (typeof stored === 'string') {
      try {
        const parsed = JSON.parse(stored) as ReportStore
        return Array.isArray(parsed.reports) ? parsed.reports : []
      } catch {
        return []
      }
    }
  }
  return []
}

const parseInputFile = async (inputPath: string): Promise<SegmentReport[]> => {
  const raw = await fs.readFile(inputPath, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as unknown
    return parseReportPayload(parsed)
  } catch {
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const reports: SegmentReport[] = []
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as SegmentReport
        reports.push(parsed)
      } catch {
        continue
      }
    }
    return reports
  }
}

const sanitizeReport = (report: SegmentReport): SegmentReport | null => {
  if (!report || typeof report !== 'object') {
    return null
  }
  const districtId = typeof report.districtId === 'string' ? report.districtId.trim() : ''
  const segmentId = typeof report.segmentId === 'string' ? report.segmentId.trim() : ''
  const status = typeof report.status === 'string' ? report.status.trim().toUpperCase() : ''
  const createdRaw = report.createdAt
  const createdAt =
    typeof createdRaw === 'string'
      ? createdRaw
      : typeof createdRaw === 'number'
        ? new Date(createdRaw).toISOString()
        : ''
  if (!districtId || !segmentId || !createdAt || !isReportStatus(status)) {
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
    note: normalizeNote(report.note),
    createdAt,
  }
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
  const nextSchema = typeof next.schemaVersion === 'number' ? next.schemaVersion : 0
  const currentSchema =
    typeof current.schemaVersion === 'number' ? current.schemaVersion : 0
  return nextSchema > currentSchema
}

const selectLatestReports = (reports: SegmentReport[]) => {
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

export const exportOverrides = async (params: {
  inputPath: string
  outDir?: string
}) => {
  const inputPath = path.resolve(params.inputPath)
  const outDir = params.outDir ? path.resolve(params.outDir) : path.resolve('data', 'overrides')

  const rawReports = await parseInputFile(inputPath)
  const sanitized = rawReports
    .map((report) => sanitizeReport(report))
    .filter((report): report is SegmentReport => Boolean(report))

  if (sanitized.length === 0) {
    throw new Error('No valid reports found to export.')
  }

  const latestReports = selectLatestReports(sanitized)
  const byDistrict = new Map<string, SegmentReport[]>()
  latestReports.forEach((report) => {
    const bucket = byDistrict.get(report.districtId) ?? []
    bucket.push(report)
    byDistrict.set(report.districtId, bucket)
  })

  await fs.mkdir(outDir, { recursive: true })

  const districts = Array.from(byDistrict.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  )

  for (const [districtId, reports] of districts) {
    const sorted = [...reports].sort((a, b) => {
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

    const fileName = `${normalizeDistrictId(districtId)}.jsonl`
    const outputPath = path.resolve(outDir, fileName)
    const lines = sorted.map((entry) => JSON.stringify(entry)).join('\n')
    await fs.writeFile(outputPath, `${lines}\n`, 'utf-8')
    console.log(`Exported ${sorted.length} override reports to ${outputPath}`)
  }
}

const run = async () => {
  const args = parseArgs(process.argv)
  if (!args.inputPath) {
    throw new Error('Usage: tsx exportOverrides.ts --input <path-to-reports.json>')
  }
  await exportOverrides({ inputPath: args.inputPath, outDir: args.outDir ?? undefined })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
