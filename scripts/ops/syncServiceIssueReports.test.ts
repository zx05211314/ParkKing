import { describe, expect, it } from 'vitest'
import { appendSyncIssueReport, readSyncIssueReportsState } from './syncServiceIssueReports'
import { createLegacySyncServiceStore } from './syncServiceStoreState'

describe('syncServiceIssueReports', () => {
  it('reads issue reports from the scoped bucket', () => {
    const store = createLegacySyncServiceStore([], [], 'workspace')
    store.buckets.workspace.issueReports = [{ issueId: 'issue-a' }]
    store.buckets.workspace.issueReportsRevision = 2

    expect(readSyncIssueReportsState(store, 'workspace', 'default')).toEqual({
      issues: [{ issueId: 'issue-a' }],
      revision: 2,
    })
  })

  it('dedupes repeated issue reports by issueId', () => {
    const store = createLegacySyncServiceStore([], [], 'workspace')

    const first = appendSyncIssueReport({
      store,
      scope: 'workspace',
      defaultScope: 'default',
      issue: { issueId: 'issue-a', summary: 'first' },
      updatedAt: '2026-04-02T00:00:00.000Z',
    })
    const second = appendSyncIssueReport({
      store,
      scope: 'workspace',
      defaultScope: 'default',
      issue: { issueId: 'issue-a', summary: 'first' },
      updatedAt: '2026-04-02T01:00:00.000Z',
    })

    expect(first).toEqual({
      changed: true,
      result: {
        issue: { issueId: 'issue-a', summary: 'first' },
        revision: 1,
      },
    })
    expect(second).toEqual({
      changed: false,
      result: {
        issue: { issueId: 'issue-a', summary: 'first' },
        revision: 1,
      },
    })
    expect(store.buckets.workspace.issueReports).toEqual([
      { issueId: 'issue-a', summary: 'first' },
    ])
  })
})
