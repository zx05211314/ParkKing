import type { Dispatch, SetStateAction } from 'react'
import { setSavedPlansRevision } from '../api/savedPlansPersistence'
import {
  mergeReportLists,
  readReports,
  setReportsRevision,
  writeReports,
} from '../feedback/reports'
import type {
  SavedPlan,
  SavedPlanConflictDetail,
} from './savedPlanTypes'
import { mergeSavedPlansWithConflictsValue } from './savedPlanMutations'
import { applySavedPlanConflictState } from './savedPlanConflictState'
import type { SyncRefreshTransportResult } from './syncRefreshTransport'

export interface SyncRefreshRevisionTarget {
  endpoint: string
  revision: number
}

interface ApplyRemoteSavedPlansOptions {
  remoteSavedPlans: SavedPlan[]
  revisionTarget?: SyncRefreshRevisionTarget
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  mergeSavedPlanConflictDetails: (details: SavedPlanConflictDetail[]) => void
  mergeSavedPlanConflictSharedPlans: (details: SavedPlanConflictDetail[]) => void
}

interface ApplyRemoteReportsOptions {
  remoteReports: ReturnType<typeof readReports>
  revisionTarget?: SyncRefreshRevisionTarget
  setReportVersion: Dispatch<SetStateAction<number>>
}

interface ApplySyncRefreshTransportResultOptions {
  transportResult: SyncRefreshTransportResult
  savedPlanLimit: number
  setReportVersion: Dispatch<SetStateAction<number>>
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  mergeSavedPlanConflictDetails: (details: SavedPlanConflictDetail[]) => void
  mergeSavedPlanConflictSharedPlans: (details: SavedPlanConflictDetail[]) => void
}

export const applyRemoteSavedPlans = ({
  remoteSavedPlans,
  revisionTarget,
  savedPlanLimit,
  setSavedPlans,
  setSavedPlanConflictUrls,
  mergeSavedPlanConflictDetails,
  mergeSavedPlanConflictSharedPlans,
}: ApplyRemoteSavedPlansOptions) => {
  if (revisionTarget) {
    setSavedPlansRevision(revisionTarget.endpoint, revisionTarget.revision)
  }

  setSavedPlans((current) => {
    const mergedResult = mergeSavedPlansWithConflictsValue(
      current,
      remoteSavedPlans,
      savedPlanLimit,
    )
    applySavedPlanConflictState({
      conflictedUrls: mergedResult.conflictedUrls,
      conflictDetails: mergedResult.conflictDetails,
      mergeSavedPlanConflictUrls: (urls) => {
        setSavedPlanConflictUrls((currentConflictUrls) =>
          Array.from(new Set([...currentConflictUrls, ...urls])),
        )
      },
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
    })
    return mergedResult.plans
  })
}

export const applyRemoteReports = ({
  remoteReports,
  revisionTarget,
  setReportVersion,
}: ApplyRemoteReportsOptions) => {
  const currentReports = readReports()
  const mergedReports = mergeReportLists(currentReports, remoteReports)
  if (JSON.stringify(mergedReports) !== JSON.stringify(currentReports)) {
    writeReports(mergedReports)
    setReportVersion((value) => value + 1)
  }

  if (revisionTarget) {
    setReportsRevision(revisionTarget.endpoint, revisionTarget.revision)
  }
}

export const applySyncRefreshTransportResult = ({
  transportResult,
  savedPlanLimit,
  setReportVersion,
  setSavedPlanConflictUrls,
  setSavedPlans,
  mergeSavedPlanConflictDetails,
  mergeSavedPlanConflictSharedPlans,
}: ApplySyncRefreshTransportResultOptions) => {
  if (transportResult.savedPlans) {
    applyRemoteSavedPlans({
      ...transportResult.savedPlans,
      savedPlanLimit,
      setSavedPlans,
      setSavedPlanConflictUrls,
      mergeSavedPlanConflictDetails,
      mergeSavedPlanConflictSharedPlans,
    })
  }

  if (transportResult.reports) {
    applyRemoteReports({
      ...transportResult.reports,
      setReportVersion,
    })
  }
}
