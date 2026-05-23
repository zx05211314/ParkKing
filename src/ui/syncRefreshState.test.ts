import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSavedPlansRevision } from '../api/savedPlansPersistence'
import { getReportsRevision, writeReports } from '../feedback/reports'
import type { SavedPlan } from './savedPlanTypes'
import { applySyncRefreshTransportResult } from './syncRefreshState'

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

const createLocalStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    clear: () => {
      values.clear()
    },
  }
}

describe('syncRefreshState', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: createLocalStorage(),
    })
    writeReports([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies refresh payloads for both resources', () => {
    const setSavedPlans = vi.fn()
    const setSavedPlanConflictUrls = vi.fn()
    const setReportVersion = vi.fn()
    const mergeSavedPlanConflictDetails = vi.fn()
    const mergeSavedPlanConflictSharedPlans = vi.fn()
    const savedPlan = createSavedPlan()
    const remoteReports = [
      {
        schemaVersion: 1,
        districtId: 'xinyi',
        segmentId: 'seg-1',
        status: 'LEGAL' as const,
        note: null,
        createdAt: '2026-03-17T01:00:00.000Z',
      },
    ]

    applySyncRefreshTransportResult({
      transportResult: {
        savedPlans: {
          remoteSavedPlans: [savedPlan],
          revisionTarget: {
            endpoint: '/saved-plans',
            revision: 3,
          },
        },
        reports: {
          remoteReports,
          revisionTarget: {
            endpoint: '/reports',
            revision: 5,
          },
        },
      },
      savedPlanLimit: 20,
      setReportVersion,
      setSavedPlanConflictUrls,
      setSavedPlans,
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
    })

    expect(setSavedPlans).toHaveBeenCalledTimes(1)
    expect(typeof setSavedPlans.mock.calls[0]?.[0]).toBe('function')
    expect(setReportVersion).toHaveBeenCalledTimes(1)
    expect(getSavedPlansRevision('/saved-plans')).toBe(3)
    expect(getReportsRevision('/reports')).toBe(5)
  })

  it('skips missing refresh resources', () => {
    const setSavedPlans = vi.fn()
    const setSavedPlanConflictUrls = vi.fn()
    const setReportVersion = vi.fn()
    const mergeSavedPlanConflictDetails = vi.fn()
    const mergeSavedPlanConflictSharedPlans = vi.fn()

    applySyncRefreshTransportResult({
      transportResult: {
        savedPlans: null,
        reports: null,
      },
      savedPlanLimit: 20,
      setReportVersion,
      setSavedPlanConflictUrls,
      setSavedPlans,
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
    })

    expect(setSavedPlans).not.toHaveBeenCalled()
    expect(setSavedPlanConflictUrls).not.toHaveBeenCalled()
    expect(setReportVersion).not.toHaveBeenCalled()
    expect(mergeSavedPlanConflictDetails).not.toHaveBeenCalled()
    expect(mergeSavedPlanConflictSharedPlans).not.toHaveBeenCalled()
  })
})
