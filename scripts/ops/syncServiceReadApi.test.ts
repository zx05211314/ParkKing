import { describe, expect, it, vi } from 'vitest'
import { createSyncServiceReadApi } from './syncServiceReadApi'
import type { SyncServiceStore } from './syncServiceTypes'
import type { SyncServiceRuntime } from './syncServiceRuntime'

const createRuntime = (
  store: SyncServiceStore,
): SyncServiceRuntime & { ensureStore: ReturnType<typeof vi.fn> } => ({
  ensureStore: vi.fn().mockResolvedValue(store),
  persistStore: vi.fn().mockResolvedValue(undefined),
})

describe('syncServiceReadApi', () => {
  it('returns scoped sync snapshots and resource-filtered bootstrap state', async () => {
    const runtime = createRuntime({
      schemaVersion: 1,
      buckets: {
        workspace: {
          savedPlans: [{ key: 'plan-a', url: '/?a' }],
          reports: [{ id: 'report-a' }],
          issueReports: [{ issueId: 'issue-a' }],
          savedPlansRevision: 2,
          reportsRevision: 3,
          issueReportsRevision: 4,
          savedPlansUpdatedAt: '2026-03-20T00:00:00.000Z',
          reportsUpdatedAt: '2026-03-20T01:00:00.000Z',
          issueReportsUpdatedAt: '2026-03-20T02:00:00.000Z',
        },
      },
    })
    const service = createSyncServiceReadApi(
      {
        path: '/api/sync',
        port: 8789,
        storageFile: 'sync.json',
        defaultScope: 'default',
      },
      runtime,
    )

    await expect(service.getSyncStatus('workspace')).resolves.toEqual({
      scope: 'workspace',
      savedPlansRevision: 2,
      reportsRevision: 3,
      issueReportsRevision: 4,
      savedPlansCount: 1,
      reportsCount: 1,
      issueReportsCount: 1,
      savedPlansUpdatedAt: '2026-03-20T00:00:00.000Z',
      reportsUpdatedAt: '2026-03-20T01:00:00.000Z',
      issueReportsUpdatedAt: '2026-03-20T02:00:00.000Z',
    })
    await expect(
      service.getBootstrapState('workspace', ['reports']),
    ).resolves.toEqual({
      reports: [{ id: 'report-a' }],
      reportsRevision: 3,
    })
    await expect(service.getSavedPlans('workspace')).resolves.toEqual([
      { key: 'plan-a', url: '/?a' },
    ])
    await expect(service.getIssueReportsState('workspace')).resolves.toEqual({
      issues: [{ issueId: 'issue-a' }],
      revision: 4,
    })
  })
})
