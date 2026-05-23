import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'
import {
  useSavedPlanEditActions,
  type UseSavedPlanEditActionsResult,
} from './useSavedPlanEditActions'
import {
  useSavedPlanImportExportActions,
  type UseSavedPlanImportExportActionsResult,
} from './useSavedPlanImportExportActions'

interface UseSavedPlanCrudActionsOptions {
  savedPlans: SavedPlan[]
  editingSavedPlanUrl: string | null
  savedPlanDraftTitle: string
  savedPlanImportRef: RefObject<HTMLInputElement | null>
  savedPlanLimit: number
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setSavedPlanConflictDetailsByUrl: Dispatch<
    SetStateAction<Record<string, SavedPlanConflictFieldDetail[]>>
  >
  setSavedPlanConflictSharedByUrl: Dispatch<SetStateAction<Record<string, SavedPlan>>>
  setSavedPlanConflictUrls: Dispatch<SetStateAction<string[]>>
  setTripBoardQuery: Dispatch<SetStateAction<string>>
  setEditingSavedPlanUrl: Dispatch<SetStateAction<string | null>>
  setSavedPlanDraftTitle: Dispatch<SetStateAction<string>>
  setComparedSavedPlanUrls: Dispatch<SetStateAction<string[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
  resetSavedPlanConflictResolutionHistory: () => void
}

export interface UseSavedPlanCrudActionsResult {
  handleExportSavedPlans: UseSavedPlanImportExportActionsResult['handleExportSavedPlans']
  handleTriggerSavedPlanImport: UseSavedPlanImportExportActionsResult['handleTriggerSavedPlanImport']
  handleImportSavedPlans: UseSavedPlanImportExportActionsResult['handleImportSavedPlans']
  handleStartSavedPlanRename: UseSavedPlanEditActionsResult['handleStartSavedPlanRename']
  handleCancelSavedPlanRename: UseSavedPlanEditActionsResult['handleCancelSavedPlanRename']
  handleCommitSavedPlanRename: UseSavedPlanEditActionsResult['handleCommitSavedPlanRename']
  handleToggleSavedPlanPinned: UseSavedPlanEditActionsResult['handleToggleSavedPlanPinned']
  handleRemoveSavedPlan: UseSavedPlanEditActionsResult['handleRemoveSavedPlan']
  handleClearSavedPlans: UseSavedPlanImportExportActionsResult['handleClearSavedPlans']
}

export const useSavedPlanCrudActions = ({
  savedPlans,
  editingSavedPlanUrl,
  savedPlanDraftTitle,
  savedPlanImportRef,
  savedPlanLimit,
  setSavedPlans,
  setSavedPlanConflictDetailsByUrl,
  setSavedPlanConflictSharedByUrl,
  setSavedPlanConflictUrls,
  setTripBoardQuery,
  setEditingSavedPlanUrl,
  setSavedPlanDraftTitle,
  setComparedSavedPlanUrls,
  setShareStatus,
  clearSavedPlanConflictsForUrls,
  resetSavedPlanConflictResolutionHistory,
}: UseSavedPlanCrudActionsOptions): UseSavedPlanCrudActionsResult => {
  const {
    handleExportSavedPlans,
    handleTriggerSavedPlanImport,
    handleImportSavedPlans,
    handleClearSavedPlans,
  } = useSavedPlanImportExportActions({
    savedPlans,
    savedPlanImportRef,
    savedPlanLimit,
    setSavedPlans,
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
    setTripBoardQuery,
    setEditingSavedPlanUrl,
    setSavedPlanDraftTitle,
    setComparedSavedPlanUrls,
    setShareStatus,
    clearSavedPlanConflictsForUrls,
    resetSavedPlanConflictResolutionHistory,
  })

  const {
    handleStartSavedPlanRename,
    handleCancelSavedPlanRename,
    handleCommitSavedPlanRename,
    handleToggleSavedPlanPinned,
    handleRemoveSavedPlan,
  } = useSavedPlanEditActions({
    editingSavedPlanUrl,
    savedPlanDraftTitle,
    savedPlanLimit,
    setSavedPlans,
    setEditingSavedPlanUrl,
    setSavedPlanDraftTitle,
    setShareStatus,
    clearSavedPlanConflictsForUrls,
  })

  return {
    handleExportSavedPlans,
    handleTriggerSavedPlanImport,
    handleImportSavedPlans,
    handleStartSavedPlanRename,
    handleCancelSavedPlanRename,
    handleCommitSavedPlanRename,
    handleToggleSavedPlanPinned,
    handleRemoveSavedPlan,
    handleClearSavedPlans,
  }
}
