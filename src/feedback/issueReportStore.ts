import { normalizeOptionalText } from '../api/client'
import {
  ISSUE_REPORTS_SCHEMA_VERSION,
  type IssueReport,
} from './issueReportTypes'

interface IssueReportStore {
  schemaVersion: number
  issues: IssueReport[]
}

export const ISSUE_REPORTS_STORAGE_KEY = 'pk.issueReports.v1'

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const normalizeIssueId = (value: unknown) => normalizeOptionalText(value)

const normalizeIssueReport = (value: unknown): IssueReport | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<IssueReport>
  const issueId = normalizeIssueId(candidate.issueId)
  const summary = normalizeOptionalText(candidate.summary)
  const createdAt = normalizeOptionalText(candidate.createdAt)
  if (!issueId || !summary || !createdAt) {
    return null
  }

  return {
    schemaVersion:
      typeof candidate.schemaVersion === 'number'
        ? candidate.schemaVersion
        : ISSUE_REPORTS_SCHEMA_VERSION,
    issueId,
    districtId: normalizeOptionalText(candidate.districtId),
    segmentId: normalizeOptionalText(candidate.segmentId),
    summary,
    createdAt,
    bundle: candidate.bundle ?? null,
  }
}

const dedupeIssueReports = (issues: IssueReport[]) => {
  const unique = new Map<string, IssueReport>()
  issues.forEach((issue) => {
    const normalized = normalizeIssueReport(issue)
    if (!normalized) {
      return
    }
    unique.set(normalized.issueId, normalized)
  })

  return Array.from(unique.values()).sort((left, right) => {
    const byTime = left.createdAt.localeCompare(right.createdAt)
    if (byTime !== 0) {
      return byTime
    }
    return left.issueId.localeCompare(right.issueId)
  })
}

const normalizeStore = (value: unknown): IssueReportStore => {
  if (!value || typeof value !== 'object') {
    return { schemaVersion: ISSUE_REPORTS_SCHEMA_VERSION, issues: [] }
  }

  const candidate = value as Partial<IssueReportStore>
  return {
    schemaVersion:
      typeof candidate.schemaVersion === 'number'
        ? candidate.schemaVersion
        : ISSUE_REPORTS_SCHEMA_VERSION,
    issues: dedupeIssueReports(Array.isArray(candidate.issues) ? candidate.issues : []),
  }
}

export const mergeIssueReportLists = (left: IssueReport[], right: IssueReport[]) =>
  dedupeIssueReports([...left, ...right])

export const readIssueReportStore = (): IssueReportStore => {
  if (!isBrowser()) {
    return { schemaVersion: ISSUE_REPORTS_SCHEMA_VERSION, issues: [] }
  }
  try {
    const raw = window.localStorage.getItem(ISSUE_REPORTS_STORAGE_KEY)
    if (!raw) {
      return { schemaVersion: ISSUE_REPORTS_SCHEMA_VERSION, issues: [] }
    }
    return normalizeStore(JSON.parse(raw))
  } catch {
    return { schemaVersion: ISSUE_REPORTS_SCHEMA_VERSION, issues: [] }
  }
}

export const writeIssueReportStore = (store: IssueReportStore) => {
  if (!isBrowser()) {
    return
  }
  try {
    window.localStorage.setItem(ISSUE_REPORTS_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore write failures
  }
}

