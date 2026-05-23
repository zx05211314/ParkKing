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
}) => {
  const { store, scope, defaultScope, issue, updatedAt } = params
  if (!issue || typeof issue !== 'object') {
    throw new Error('Issue payload must include an issue object.')
  }

  const bucket = ensureSyncServiceBucket(store, scope, defaultScope).bucket
  const nextIssues = dedupeSyncIssueReports([...bucket.issueReports, issue])
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
