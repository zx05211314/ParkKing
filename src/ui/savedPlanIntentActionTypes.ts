import type { Dispatch, SetStateAction } from 'react'
import type {
  SavedPlan,
  SavedPlanIntent,
  SavedPlanIntentFilter,
  SavedPlanIntentSuggestionFilter,
} from './savedPlanTypes'
import type { TripBoardActionStatus } from './tripBoardActionStatus'

export type SavedPlanIntentLabels = Record<SavedPlanIntent, string>

export type FormatSavedPlanIntentSummary = (
  counts: Record<SavedPlanIntent, number>,
  unassigned: number,
) => string

export interface SavedPlanIntentMutationOptions {
  savedPlanLimit: number
  savedPlanIntentLabels: SavedPlanIntentLabels
  setSavedPlans: Dispatch<SetStateAction<SavedPlan[]>>
  setShareStatus: Dispatch<SetStateAction<TripBoardActionStatus | null>>
  clearSavedPlanConflictsForUrls: (urls: string[]) => void
}

export interface SavedPlanIntentFilterControlOptions {
  tripBoardIntentFilter: SavedPlanIntentFilter
  tripBoardSuggestionFilter: SavedPlanIntentSuggestionFilter
  setTripBoardIntentFilter: Dispatch<SetStateAction<SavedPlanIntentFilter>>
  setTripBoardSuggestionFilter: Dispatch<
    SetStateAction<SavedPlanIntentSuggestionFilter>
  >
}
