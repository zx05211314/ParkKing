import { describe, expect, it, vi } from 'vitest'
import {
  loadSyncRefreshResources,
  normalizeSyncRefreshResources,
} from './syncRefreshTransport'

describe('syncRefreshTransport', () => {
  it('normalizes refresh resources with defaults and dedupe', () => {
    expect(normalizeSyncRefreshResources()).toEqual(['savedPlans', 'reports'])
    expect(
      normalizeSyncRefreshResources(['savedPlans', 'reports', 'savedPlans']),
    ).toEqual(['savedPlans', 'reports'])
  })

  it('loads refresh resources from bootstrap when available', async () => {
    const fetchSyncBootstrapSnapshotFn = vi.fn().mockResolvedValue({
      savedPlans: [{ url: 'one', title: 'One' }],
      reports: [],
      savedPlansRevision: 7,
      reportsRevision: 9,
    })

    await expect(
      loadSyncRefreshResources({
        resources: ['savedPlans'],
        bootstrapConfig: {
          endpoint: '/api/sync/bootstrap',
          savedPlansEndpoint: '/api/sync/saved-plans',
          reportsEndpoint: '/api/sync/reports',
        },
        fetchSyncBootstrapSnapshotFn,
      }),
    ).resolves.toEqual({
      savedPlans: {
        remoteSavedPlans: [{ url: 'one', title: 'One' }],
        revisionTarget: {
          endpoint: '/api/sync/saved-plans',
          revision: 7,
        },
      },
      reports: null,
    })
  })

  it('loads refresh resources from legacy endpoints when bootstrap is disabled', async () => {
    const loadSavedPlansFn = vi.fn().mockResolvedValue([{ url: 'two', title: 'Two' }])
    const loadReportsFn = vi.fn().mockResolvedValue([
      {
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL',
        createdAt: '2026-03-17T00:00:00.000Z',
      },
    ])

    await expect(
      loadSyncRefreshResources({
        resources: ['savedPlans', 'reports'],
        bootstrapConfig: {
          endpoint: null,
          savedPlansEndpoint: null,
          reportsEndpoint: null,
        },
        savedPlansConfig: {
          endpoint: '/saved-plans',
        },
        reportsConfig: {
          endpoint: '/reports',
        },
        loadSavedPlansFn,
        loadReportsFn,
      }),
    ).resolves.toEqual({
      savedPlans: {
        remoteSavedPlans: [{ url: 'two', title: 'Two' }],
      },
      reports: {
        remoteReports: [
          {
            schemaVersion: 1,
            districtId: 'xinyi',
            segmentId: 'seg-1',
            status: 'LEGAL',
            createdAt: '2026-03-17T00:00:00.000Z',
          },
        ],
      },
    })
  })

  it('throws when bootstrap is enabled but unavailable', async () => {
    await expect(
      loadSyncRefreshResources({
        bootstrapConfig: {
          endpoint: '/api/sync/bootstrap',
          savedPlansEndpoint: '/api/sync/saved-plans',
          reportsEndpoint: '/api/sync/reports',
        },
        fetchSyncBootstrapSnapshotFn: vi.fn().mockResolvedValue(null),
      }),
    ).rejects.toThrow('Shared sync is unavailable.')
  })
})
