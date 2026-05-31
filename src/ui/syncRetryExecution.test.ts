import { describe, expect, it, vi } from 'vitest'
import {
  applyRetrySavedPlansResult,
  buildRetrySyncResultStatus,
  retrySyncResources,
} from './syncRetryExecution'
import type { SavedPlan, SavedPlanConflictDetail } from './savedPlanTypes'

const createSavedPlan = (overrides: Partial<SavedPlan> = {}): SavedPlan => ({
  key: 'plan-1',
  title: 'One',
  url: 'one',
  datasetId: 'xinyi',
  addressLabel: 'Addr',
  segmentName: 'Segment',
  targetLabel: null,
  createdAt: '2026-03-17T00:00:00.000Z',
  ...overrides,
})

describe('syncRetryExecution', () => {
  it('retries only active resources with enabled endpoints', async () => {
    const savedPlan = createSavedPlan()
    const saveSavedPlansFn = vi.fn().mockResolvedValue({
      plans: [savedPlan],
      conflictedUrls: [],
      conflictDetails: [],
      remoteSynced: true,
    })
    const retryReportsSyncFn = vi.fn().mockResolvedValue({
      attemptedCount: 1,
      syncedCount: 1,
      remoteSynced: true,
    })
    const retryIssueReportsSyncFn = vi.fn().mockResolvedValue({
      attemptedCount: 1,
      syncedCount: 1,
      remoteSynced: true,
    })

    await expect(
      retrySyncResources({
        activeResources: ['savedPlans'],
        savedPlans: [savedPlan],
        savedPlansConfig: { endpoint: '/saved-plans' },
        reportsConfig: { endpoint: '/reports' },
        issueReportsConfig: { endpoint: '/issues' },
        saveSavedPlansFn,
        retryReportsSyncFn,
        retryIssueReportsSyncFn,
      }),
    ).resolves.toEqual({
      savedPlansResult: {
        plans: [savedPlan],
        conflictedUrls: [],
        conflictDetails: [],
        remoteSynced: true,
      },
      reportRetryResult: null,
      issueReportRetryResult: null,
    })
    expect(retryReportsSyncFn).not.toHaveBeenCalled()
    expect(retryIssueReportsSyncFn).not.toHaveBeenCalled()
  })

  it('retries issue reports when they are active and the endpoint is enabled', async () => {
    const savedPlan = createSavedPlan()
    const saveSavedPlansFn = vi.fn()
    const retryReportsSyncFn = vi.fn()
    const retryIssueReportsSyncFn = vi.fn().mockResolvedValue({
      attemptedCount: 2,
      syncedCount: 2,
      remoteSynced: true,
    })

    await expect(
      retrySyncResources({
        activeResources: ['issueReports'],
        savedPlans: [savedPlan],
        savedPlansConfig: { endpoint: '/saved-plans' },
        reportsConfig: { endpoint: '/reports' },
        issueReportsConfig: { endpoint: '/issues' },
        saveSavedPlansFn,
        retryReportsSyncFn,
        retryIssueReportsSyncFn,
      }),
    ).resolves.toEqual({
      savedPlansResult: null,
      reportRetryResult: null,
      issueReportRetryResult: {
        attemptedCount: 2,
        syncedCount: 2,
        remoteSynced: true,
      },
    })
    expect(saveSavedPlansFn).not.toHaveBeenCalled()
    expect(retryReportsSyncFn).not.toHaveBeenCalled()
    expect(retryIssueReportsSyncFn).toHaveBeenCalledWith({
      config: { endpoint: '/issues' },
    })
  })

  it('applies saved-plan retry results and merges conflict state', () => {
    const setSavedPlans = vi.fn()
    const mergeSavedPlanConflictUrls = vi.fn()
    const mergeSavedPlanConflictDetails = vi.fn()
    const mergeSavedPlanConflictSharedPlans = vi.fn()
    const savedPlan = createSavedPlan()
    const conflictDetails: SavedPlanConflictDetail[] = [
      {
        url: 'one',
        fields: [
          {
            label: 'Title',
            keptValue: 'Local',
            sharedValue: 'Remote',
          },
        ],
        sharedPlan: createSavedPlan({
          title: 'Remote',
        }),
      },
    ]

    applyRetrySavedPlansResult({
      result: {
        plans: [savedPlan],
        conflictedUrls: ['one'],
        conflictDetails,
        remoteSynced: false,
      },
      setSavedPlans,
      mergeSavedPlanConflictUrls,
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
    })

    expect(setSavedPlans).toHaveBeenCalledWith([savedPlan])
    expect(mergeSavedPlanConflictUrls).toHaveBeenCalledWith(['one'])
    expect(mergeSavedPlanConflictDetails).toHaveBeenCalledWith(conflictDetails)
    expect(mergeSavedPlanConflictSharedPlans).toHaveBeenCalledWith(conflictDetails)
  })

  it('builds a success status when all retried resources are remotely synced', () => {
    const savedPlan = createSavedPlan()

    expect(
      buildRetrySyncResultStatus({
        activeResources: ['savedPlans', 'reports'],
        savedPlansResult: {
          plans: [savedPlan],
          conflictedUrls: [],
          conflictDetails: [],
          remoteSynced: true,
        },
        reportRetryResult: {
          attemptedCount: 1,
          syncedCount: 1,
          remoteSynced: true,
        },
        issueReportRetryResult: null,
      }),
    ).toEqual({
      kind: 'success',
      message: 'Retried sync. saved plans and reports are confirmed remotely.',
    })
  })

  it('builds an outcome status when any retried resource still falls back locally', () => {
    const savedPlan = createSavedPlan()

    expect(
      buildRetrySyncResultStatus({
        activeResources: ['savedPlans', 'reports'],
        savedPlansResult: {
          plans: [savedPlan],
          conflictedUrls: [],
          conflictDetails: [],
          remoteSynced: false,
        },
        reportRetryResult: {
          attemptedCount: 1,
          syncedCount: 1,
          remoteSynced: true,
        },
        issueReportRetryResult: null,
      }),
    ).toEqual({
      kind: 'error',
      message:
        'Retried sync. saved plans still using local fallback; reports synced.',
    })
  })

  it('includes issue report retry outcomes in the retry status', () => {
    expect(
      buildRetrySyncResultStatus({
        activeResources: ['issueReports'],
        savedPlansResult: null,
        reportRetryResult: null,
        issueReportRetryResult: {
          attemptedCount: 1,
          syncedCount: 0,
          remoteSynced: false,
        },
      }),
    ).toEqual({
      kind: 'error',
      message: 'Retried sync. issue reports still using local fallback.',
    })
  })
})
