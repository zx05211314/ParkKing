import type { HeaderPanelsProps } from './appPresentationBuilderTypes'
import { formatSavedPlanTimestamp } from './displayFormatting'
import {
  TRIP_BOARD_FILTER_LABELS,
  TRIP_BOARD_INTENT_FILTER_LABELS,
  TRIP_BOARD_SORT_MODE_LABELS,
  TRIP_BOARD_SUGGESTION_FILTER_LABELS,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
  getSavedPlanEtaSummary,
  getSavedPlanQualitySummary,
  getSavedPlanSettingChips,
} from './appPresentationConfig'
import { SAVED_PLAN_INTENTS } from './savedPlanTypes'

type TripBoardPanelProps = HeaderPanelsProps['tripBoardPanelProps']

type TripBoardComputedPropKeys =
  | 'tripBoardSortModeLabels'
  | 'tripBoardIntentFilterLabels'
  | 'savedPlanIntents'
  | 'tripBoardSuggestionFilterLabels'
  | 'tripBoardFilterLabels'
  | 'formatSavedPlanTimestamp'
  | 'formatSavedPlanIntentSummary'
  | 'formatSuggestionActionLabel'
  | 'getSavedPlanQualitySummary'
  | 'getSavedPlanEtaSummary'
  | 'getSavedPlanSettingChips'

export type BuildTripBoardPanelPropsOptions = Omit<
  TripBoardPanelProps,
  TripBoardComputedPropKeys
>

export const buildTripBoardPanelProps = ({
  tripBoardSortMode,
  tripBoardIntentFilter,
  tripBoardSuggestionFilter,
  ...options
}: BuildTripBoardPanelPropsOptions): TripBoardPanelProps => ({
  ...options,
  tripBoardSortMode,
  tripBoardSortModeLabels: TRIP_BOARD_SORT_MODE_LABELS,
  tripBoardIntentFilter,
  tripBoardIntentFilterLabels: TRIP_BOARD_INTENT_FILTER_LABELS,
  savedPlanIntents: SAVED_PLAN_INTENTS,
  tripBoardSuggestionFilter,
  tripBoardSuggestionFilterLabels: TRIP_BOARD_SUGGESTION_FILTER_LABELS,
  tripBoardFilterLabels: TRIP_BOARD_FILTER_LABELS,
  formatSavedPlanTimestamp,
  formatSavedPlanIntentSummary,
  formatSuggestionActionLabel,
  getSavedPlanQualitySummary,
  getSavedPlanEtaSummary,
  getSavedPlanSettingChips,
})
