import { useCallback, useEffect, useRef, useState } from 'react'
import { saveSavedPlans } from '../api/savedPlansPersistence'
import { readSetting, STORAGE_KEYS } from '../settings'
import { normalizeSavedPlanCollapsedGroups } from './savedPlanBoardState'
import {
  mergeSavedPlanConflictDetailsByUrlValue,
  mergeSavedPlanConflictSharedPlansByUrlValue,
  mergeSavedPlanConflictUrlsValue,
} from './savedPlanConflictState'
import { normalizeSavedPlansValue } from './savedPlanNormalization'
import {
  DEFAULT_SAVED_PLAN_LIMIT,
  type SavedPlan,
  type SavedPlanConflictFieldDetail,
} from './savedPlanTypes'

export const useSavedPlansUiState = () => {
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    return normalizeSavedPlansValue(
      readSetting<unknown>(STORAGE_KEYS.savedPlans, []),
      DEFAULT_SAVED_PLAN_LIMIT,
    )
  })
  const [collapsedSavedPlanGroups, setCollapsedSavedPlanGroups] = useState<string[]>(() =>
    normalizeSavedPlanCollapsedGroups(
      readSetting<unknown>(STORAGE_KEYS.tripBoardCollapsedGroups, []),
    ),
  )
  const [comparedSavedPlanUrls, setComparedSavedPlanUrls] = useState<string[]>([])
  const [editingSavedPlanUrl, setEditingSavedPlanUrl] = useState<string | null>(null)
  const [savedPlanDraftTitle, setSavedPlanDraftTitle] = useState('')
  const [savedPlanConflictUrls, setSavedPlanConflictUrls] = useState<string[]>([])
  const [savedPlanConflictDetailsByUrl, setSavedPlanConflictDetailsByUrl] = useState<
    Record<string, SavedPlanConflictFieldDetail[]>
  >({})
  const [savedPlanConflictSharedByUrl, setSavedPlanConflictSharedByUrl] = useState<
    Record<string, SavedPlan>
  >({})
  const initialSavedPlansJson = JSON.stringify(savedPlans)
  const initialSavedPlansJsonRef = useRef(initialSavedPlansJson)
  const lastPersistedSavedPlansJsonRef = useRef(initialSavedPlansJson)
  const [savedPlansHydrated, setSavedPlansHydrated] = useState(false)

  const hydrateSavedPlans = useCallback((loadedPlans: SavedPlan[]) => {
    const nextSavedPlans = normalizeSavedPlansValue(
      loadedPlans,
      DEFAULT_SAVED_PLAN_LIMIT,
    )
    const nextSavedPlansJson = JSON.stringify(nextSavedPlans)

    setSavedPlans((currentSavedPlans) => {
      const currentSavedPlansJson = JSON.stringify(currentSavedPlans)
      if (currentSavedPlansJson !== initialSavedPlansJsonRef.current) {
        return currentSavedPlans
      }

      lastPersistedSavedPlansJsonRef.current = nextSavedPlansJson
      return currentSavedPlansJson === nextSavedPlansJson
        ? currentSavedPlans
        : nextSavedPlans
    })
    setSavedPlanConflictUrls([])
    setSavedPlanConflictDetailsByUrl({})
    setSavedPlanConflictSharedByUrl({})
  }, [])

  useEffect(() => {
    if (!savedPlansHydrated) {
      return
    }

    const savedPlansJson = JSON.stringify(savedPlans)
    if (savedPlansJson === lastPersistedSavedPlansJsonRef.current) {
      return
    }

    lastPersistedSavedPlansJsonRef.current = savedPlansJson
    void saveSavedPlans(savedPlans).then((result) => {
      const persistedPlansJson = JSON.stringify(result.plans)
      lastPersistedSavedPlansJsonRef.current = persistedPlansJson

      setSavedPlans((currentSavedPlans) => {
        const currentSavedPlansJson = JSON.stringify(currentSavedPlans)
        if (currentSavedPlansJson !== savedPlansJson) {
          return currentSavedPlans
        }
        return currentSavedPlansJson === persistedPlansJson
          ? currentSavedPlans
          : result.plans
      })

      if (result.conflictedUrls.length > 0) {
        setSavedPlanConflictUrls((currentConflictUrls) =>
          mergeSavedPlanConflictUrlsValue(currentConflictUrls, result.conflictedUrls),
        )
        setSavedPlanConflictDetailsByUrl((currentConflictDetailsByUrl) =>
          mergeSavedPlanConflictDetailsByUrlValue(
            currentConflictDetailsByUrl,
            result.conflictDetails,
          ),
        )
        setSavedPlanConflictSharedByUrl((currentConflictSharedByUrl) =>
          mergeSavedPlanConflictSharedPlansByUrlValue(
            currentConflictSharedByUrl,
            result.conflictDetails,
          ),
        )
      }
    })
  }, [savedPlans, savedPlansHydrated])

  return {
    collapsedSavedPlanGroups,
    comparedSavedPlanUrls,
    editingSavedPlanUrl,
    savedPlanConflictDetailsByUrl,
    savedPlanConflictSharedByUrl,
    savedPlanDraftTitle,
    savedPlanConflictUrls,
    hydrateSavedPlans,
    setSavedPlansHydrated,
    savedPlansHydrated,
    savedPlans,
    setCollapsedSavedPlanGroups,
    setComparedSavedPlanUrls,
    setEditingSavedPlanUrl,
    setSavedPlanConflictDetailsByUrl,
    setSavedPlanConflictSharedByUrl,
    setSavedPlanConflictUrls,
    setSavedPlanDraftTitle,
    setSavedPlans,
  }
}
