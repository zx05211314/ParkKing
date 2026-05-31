import { useSavedPlanConflictActions } from './useSavedPlanConflictActions'
import { useSavedPlanIntentActions } from './useSavedPlanIntentActions'
import { useSavedPlanCrudActions } from './useSavedPlanCrudActions'
import { useTripBoardFilterActions } from './useTripBoardFilterActions'
import {
  buildSavedPlanConflictActionOptions,
  buildSavedPlanCrudActionOptions,
  buildSavedPlanIntentActionOptions,
  buildTripBoardFilterActionOptions,
} from './tripBoardManagementActionOptions'
import type {
  UseTripBoardManagementActionsOptions,
  UseTripBoardManagementActionsResult,
} from './tripBoardManagementActionTypes'
export type { UseTripBoardManagementActionsResult } from './tripBoardManagementActionTypes'

export const useTripBoardManagementActions = ({
  ...options
}: UseTripBoardManagementActionsOptions): UseTripBoardManagementActionsResult => {
  const {
    savedPlanConflictResolutionHistoryCount,
    clearSavedPlanConflictsForUrls,
    resetSavedPlanConflictResolutionHistory,
    ...conflictActions
  } = useSavedPlanConflictActions(buildSavedPlanConflictActionOptions(options))
  const filterActions = useTripBoardFilterActions(
    buildTripBoardFilterActionOptions(options),
  )
  const intentActions = useSavedPlanIntentActions(
    buildSavedPlanIntentActionOptions({
      ...options,
      clearSavedPlanConflictsForUrls,
    }),
  )
  const crudActions = useSavedPlanCrudActions(
    buildSavedPlanCrudActionOptions({
      ...options,
      clearSavedPlanConflictsForUrls,
      resetSavedPlanConflictResolutionHistory,
    }),
  )

  return {
    savedPlanConflictResolutionHistoryCount,
    ...filterActions,
    ...crudActions,
    ...intentActions,
    ...conflictActions,
  }
}
