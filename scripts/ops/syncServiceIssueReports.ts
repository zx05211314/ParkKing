import { DEFAULT_SYNC_MAX_ISSUE_REPORTS } from './syncServiceConfig'
import { ensureSyncServiceBucket } from './syncServiceState'
import type { SyncServiceStore } from './syncServiceTypes'

const dedupeSyncIssueReports = (issues: unknown[]) => {
  const unique = new Map<string, unknown>()
  issues.forEach((issue, index) => {
    const issueId =
      issue &&
      typeof issue === 'object' &&
      'issueId' in issue &&
      typeof issue.issueId === 'string' &&
      issue.issueId.trim().length > 0
        ? issue.issueId
        : JSON.stringify(issue) ?? `issue-${index}`
    unique.set(issueId, issue)
  })
  return Array.from(unique.values())
}

const retainNewestSyncIssueReports = (
  issues: unknown[],
  maxIssueReports: number,
) =>
  issues.length > maxIssueReports
    ? issues.slice(issues.length - maxIssueReports)
    : issues

export function assertSyncIssueReport(
  issue: unknown,
): asserts issue is object {
  if (!issue || typeof issue !== 'object') {
    throw new Error('Issue payload must include an issue object.')
  }
}

export const readSyncIssueReportsState = (
  store: SyncServiceStore,
  scope: string | null | undefined,
  defaultScope: string,
) => {
  const bucket = ensureSyncServiceBucket(store, scope, defaultScope).bucket
  return {
    issues: bucket.issueReports,
    revision: bucket.issueReportsRevision,
  }
}

export const appendSyncIssueReport = (params: {
  store: SyncServiceStore
  scope: string | null | undefined
  defaultScope: string
  issue: unknown
  updatedAt: string
  maxIssueReports?: number
}) => {
  const {
    store,
    scope,
    defaultScope,
    issue,
    updatedAt,
    maxIssueReports = DEFAULT_SYNC_MAX_ISSUE_REPORTS,
  } = params
  assertSyncIssueReport(issue)

  const bucket = ensureSyncServiceBucket(store, scope, defaultScope).bucket
  const nextIssues = retainNewestSyncIssueReports(
    dedupeSyncIssueReports([...bucket.issueReports, issue]),
    maxIssueReports,
  )
  if (JSON.stringify(nextIssues) === JSON.stringify(bucket.issueReports)) {
    return {
      changed: false,
      result: {
        issue,
        revision: bucket.issueReportsRevision,
      },
    }
  }

  bucket.issueReports = nextIssues
  bucket.issueReportsRevision += 1
  bucket.issueReportsUpdatedAt = updatedAt
  return {
    changed: true,
    result: {
      issue,
      revision: bucket.issueReportsRevision,
    },
  }
}
