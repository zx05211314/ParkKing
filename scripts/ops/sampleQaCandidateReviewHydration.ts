import * as fs from 'node:fs/promises'
import { resolveOverrideReportsPath } from '../ingest/overrideReportsPath'
import {
  normalizeSegmentId,
  sanitizeSegmentReport,
} from './exportOverrideNormalization'
import type { SegmentReport } from './exportOverrideTypes'
import type { QaCandidateRow } from './sampleQaCandidateTypes'

const parseTimestamp = (value: string) => {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

const latestReportBySegment = (reports: SegmentReport[], districtId: string) => {
  const bySegment = new Map<string, SegmentReport>()
  reports
    .map((report) => sanitizeSegmentReport(report))
    .filter((report): report is SegmentReport => Boolean(report))
    .filter((report) => report.districtId === districtId)
    .forEach((report) => {
      const key = normalizeSegmentId(report.segmentId)
      const existing = bySegment.get(key)
      if (!existing || parseTimestamp(report.createdAt) >= parseTimestamp(existing.createdAt)) {
        bySegment.set(key, report)
      }
    })
  return bySegment
}

const isAllowedNowConsistentWithStatus = (
  row: QaCandidateRow,
  status: SegmentReport['status'],
) => {
  const allowedNow = row.allowedNow.trim().toUpperCase()
  if (status === 'LEGAL') {
    return allowedNow !== 'NO_STOP'
  }
  if (status === 'ILLEGAL') {
    return allowedNow === 'NO_STOP'
  }
  return true
}

const findHydrationCandidate = (
  rows: QaCandidateRow[],
  segmentId: string,
  report: SegmentReport,
) =>
  rows.find(
    (row) =>
      !row.reviewStatus &&
      normalizeSegmentId(row.segmentId) === segmentId &&
      isAllowedNowConsistentWithStatus(row, report.status),
  ) ?? null

export const hydrateQaRowsWithReviewReports = (
  rows: QaCandidateRow[],
  districtId: string,
  reports: SegmentReport[],
) => {
  if (reports.length === 0 || rows.length === 0) {
    return rows
  }

  const reportsBySegment = latestReportBySegment(reports, districtId)
  if (reportsBySegment.size === 0) {
    return rows
  }

  const nextRows = rows.map((row) => ({ ...row }))
  reportsBySegment.forEach((report, segmentId) => {
    const candidate = findHydrationCandidate(nextRows, segmentId, report)
    if (!candidate) {
      return
    }

    candidate.reviewStatus = report.status
    candidate.reviewNote = report.note
    candidate.createdAt = report.createdAt
    candidate.reviewSource = 'stored_override'
  })

  return nextRows
}

const parseJsonlReports = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as SegmentReport]
      } catch {
        return []
      }
    })

export const loadStoredOverrideReports = async (
  districtId: string,
  cwd = process.cwd(),
) => {
  try {
    const raw = await fs.readFile(resolveOverrideReportsPath(districtId, cwd), 'utf-8')
    return parseJsonlReports(raw)
  } catch (error) {
    if (error instanceof Error && (error as { code?: unknown }).code === 'ENOENT') {
      return []
    }
    throw error
  }
}

export const hydrateQaRowsWithStoredOverrides = async (
  rows: QaCandidateRow[],
  districtId: string,
) => hydrateQaRowsWithReviewReports(rows, districtId, await loadStoredOverrideReports(districtId))
