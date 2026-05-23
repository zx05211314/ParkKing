import { useCallback, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { mergeSavedPlansValue } from './savedPlanMutations'
import { normalizeSavedPlansValue } from './savedPlanNormalization'
import type { SavedPlan, SavedPlanConflictFieldDetail } from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

interface UseSavedPlanImportExportActionsOptions {
  savedPlans: SavedPlan[]
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

export interface UseSavedPlanImportExportActionsResult {
  handleExportSavedPlans: () => void
  handleTriggerSavedPlanImport: () => void
  handleImportSavedPlans: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  handleClearSavedPlans: () => void
}

export const useSavedPlanImportExportActions = ({
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
}: UseSavedPlanImportExportActionsOptions): UseSavedPlanImportExportActionsResult => {
  const handleExportSavedPlans = useCallback(() => {
    if (typeof window === 'undefined' || savedPlans.length === 0) {
      setShareStatus({
        kind: 'error',
        message: 'No saved plans to export.',
      })
      return
    }

    const blob = new Blob([`${JSON.stringify(savedPlans, null, 2)}\n`], {
      type: 'application/json',
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `parkking-trip-board-${dateStamp}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    setShareStatus({
      kind: 'success',
      message: 'Trip board exported.',
    })
  }, [savedPlans, setShareStatus])

  const handleTriggerSavedPlanImport = useCallback(() => {
    savedPlanImportRef.current?.click()
  }, [savedPlanImportRef])

  const handleImportSavedPlans = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      try {
        const payload = JSON.parse(await file.text())
        const importedPlans = normalizeSavedPlansValue(payload, savedPlanLimit)
        if (importedPlans.length === 0) {
          throw new Error('No saved plans found in that file.')
        }

        setSavedPlans((current) =>
          mergeSavedPlansValue(importedPlans, current, savedPlanLimit),
        )
        clearSavedPlanConflictsForUrls(importedPlans.map((plan) => plan.url))
        setTripBoardQuery('')
        setEditingSavedPlanUrl(null)
        setSavedPlanDraftTitle('')
        resetSavedPlanConflictResolutionHistory()
        setShareStatus({
          kind: 'success',
          message: `Imported ${importedPlans.length} saved plan${importedPlans.length === 1 ? '' : 's'}.`,
        })
      } catch (error) {
        setShareStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Trip board import failed.',
        })
      } finally {
        event.target.value = ''
      }
    },
    [
      clearSavedPlanConflictsForUrls,
      resetSavedPlanConflictResolutionHistory,
      savedPlanLimit,
      setEditingSavedPlanUrl,
      setSavedPlanDraftTitle,
      setSavedPlans,
      setShareStatus,
      setTripBoardQuery,
    ],
  )

  const handleClearSavedPlans = useCallback(() => {
    setSavedPlans([])
    setSavedPlanConflictDetailsByUrl({})
    setSavedPlanConflictSharedByUrl({})
    setSavedPlanConflictUrls([])
    setTripBoardQuery('')
    setComparedSavedPlanUrls([])
    setEditingSavedPlanUrl(null)
    setSavedPlanDraftTitle('')
    resetSavedPlanConflictResolutionHistory()
  }, [
    resetSavedPlanConflictResolutionHistory,
    setComparedSavedPlanUrls,
    setEditingSavedPlanUrl,
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
    setSavedPlanDraftTitle,
    setSavedPlans,
    setTripBoardQuery,
  ])

  return {
    handleExportSavedPlans,
    handleTriggerSavedPlanImport,
    handleImportSavedPlans,
    handleClearSavedPlans,
  }
}
