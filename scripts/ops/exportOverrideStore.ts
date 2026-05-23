import * as fs from 'node:fs/promises'
import { parse as parseCsv } from 'csv-parse/sync'

import {
  REPORTS_STORAGE_KEY,
  type ReportStore,
  type SegmentReport,
} from './exportOverrideTypes'
import { REVIEW_TIMESTAMP_MESSAGE, isValidReviewTimestamp } from './reviewTimestamp'

const VALID_REPORT_STATUSES = ['LEGAL', 'ILLEGAL', 'UNCLEAR']

const getCsvValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()))
  for (const [key, value] of Object.entries(row)) {
    if (
      normalizedKeys.has(key.toLowerCase()) &&
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      return value.trim()
    }
  }
  return ''
}

const hasCsvKey = (row: Record<string, unknown>, keys: string[]) => {
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()))
  return Object.keys(row).some((key) => normalizedKeys.has(key.toLowerCase()))
}

const getReviewStatus = (row: Record<string, unknown>) => {
  const reviewStatusKeys = ['reviewStatus', 'status', 'overrideStatus']
  const explicitStatus = getCsvValue(row, reviewStatusKeys)
  if (explicitStatus || hasCsvKey(row, reviewStatusKeys)) {
    return explicitStatus
  }
  return getCsvValue(row, ['signOverrideStatus'])
}

const looksLikeReportCsv = (raw: string) => {
  const firstLine = raw.split(/\r?\n/).find((line) => line.trim().length > 0)
  if (!firstLine) {
    return false
  }
  const trimmed = firstLine.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || !trimmed.includes(',')) {
    return false
  }
  const headers = trimmed
    .split(',')
    .map((header) => header.trim().replace(/^"|"$/g, '').toLowerCase())
  return headers.includes('districtid') && headers.includes('segmentid')
}

export const parseReportCsvPayload = (raw: string): SegmentReport[] => {
  if (!looksLikeReportCsv(raw)) {
    return []
  }

  const rows = parseCsv(raw, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[]

  const errors: string[] = []
  const reports = rows
    .map((row, index) => {
      const status = getReviewStatus(row)
      if (!status) {
        return null
      }
      const normalizedStatus = status.trim().toUpperCase()
      const districtId = getCsvValue(row, ['districtId', 'district_id', 'district'])
      const segmentId = getCsvValue(row, ['segmentId', 'segment_id', 'segment'])
      const note = getCsvValue(row, ['reviewNote', 'note', 'overrideNote'])
      const createdAt = getCsvValue(row, ['createdAt', 'reviewedAt', 'verifiedAt'])
      const rowNumber = index + 2
      if (!VALID_REPORT_STATUSES.includes(normalizedStatus)) {
        errors.push(
          `row ${rowNumber}: invalid reviewStatus "${status}" (expected LEGAL, ILLEGAL, or UNCLEAR)`,
        )
      }
      if (!districtId) {
        errors.push(`row ${rowNumber}: districtId is required when reviewStatus is set`)
      }
      if (!segmentId) {
        errors.push(`row ${rowNumber}: segmentId is required when reviewStatus is set`)
      }
      if (!note) {
        errors.push(`row ${rowNumber}: reviewNote is required when reviewStatus is set`)
      }
      if (!createdAt) {
        errors.push(`row ${rowNumber}: createdAt is required when reviewStatus is set`)
      } else if (!isValidReviewTimestamp(createdAt)) {
        errors.push(`row ${rowNumber}: ${REVIEW_TIMESTAMP_MESSAGE} when reviewStatus is set`)
      }
      return {
        schemaVersion: 1,
        districtId,
        segmentId,
        status: normalizedStatus,
        note,
        createdAt,
      } satisfies SegmentReport
    })
    .filter((report): report is SegmentReport => Boolean(report))

  if (errors.length > 0) {
    throw new Error(`Invalid QA review CSV:\n- ${errors.join('\n- ')}`)
  }

  return reports
}

export const parseReportPayload = (payload: unknown): SegmentReport[] => {
  if (!payload) {
    return []
  }
  if (Array.isArray(payload)) {
    return payload as SegmentReport[]
  }
  if (typeof payload === 'string') {
    try {
      return parseReportPayload(JSON.parse(payload) as unknown)
    } catch {
      return []
    }
  }
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (
      typeof record.districtId === 'string' &&
      typeof record.segmentId === 'string' &&
      typeof record.status === 'string'
    ) {
      return [record as unknown as SegmentReport]
    }
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

export const parseReportInputFile = async (inputPath: string): Promise<SegmentReport[]> => {
  const raw = await fs.readFile(inputPath, 'utf-8')
  try {
    return parseReportPayload(JSON.parse(raw) as unknown)
  } catch {
    const csvReports = parseReportCsvPayload(raw)
    if (csvReports.length > 0) {
      return csvReports
    }

    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const reports: SegmentReport[] = []
    for (const line of lines) {
      try {
        reports.push(JSON.parse(line) as SegmentReport)
      } catch {
        continue
      }
    }
    return reports
  }
}
