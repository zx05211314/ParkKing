import type { SavedPlan, SavedPlanGroup } from './savedPlanTypes'
import { getSavedPlanGroupStorageKey } from './savedPlanBoardState'
import {
  getSavedPlanIntentSuggestionAssignments,
  summarizeSavedPlanIntentSuggestions,
} from './savedPlanIntentSuggestions'
import {
  summarizeSavedPlanIntents,
  summarizeSavedPlans,
} from './savedPlanGrouping'
import {
  getSavedPlanLeaderCandidates,
  getSavedPlanMetricLeaders,
} from './savedPlanSort'

export const buildTripBoardSavedPlanGroupSectionState = ({
  group,
  datasetLabelById,
  collapsedSavedPlanGroups,
}: {
  group: SavedPlanGroup
  datasetLabelById: Map<string, string>
  collapsedSavedPlanGroups: string[]
}) => {
  const groupLabel = group.key ? datasetLabelById.get(group.key) ?? group.key : 'Unassigned'
  const groupSummary = summarizeSavedPlans(group.plans)
  const groupIntentSummary = summarizeSavedPlanIntents(group.plans)
  const groupSuggestionAssignments = getSavedPlanIntentSuggestionAssignments(
    group.plans.filter((plan) => !plan.intent),
  )
  const groupSuggestionSummary = summarizeSavedPlanIntentSuggestions(
    groupSuggestionAssignments,
  )
  const groupManualReviewCount =
    groupIntentSummary.unassignedCount - groupSuggestionSummary.totalCount
  const groupMetricLeaders = getSavedPlanMetricLeaders(group.plans)
  const groupLeaderCandidates = getSavedPlanLeaderCandidates(group.plans, 2)
  const topGroupPlan: SavedPlan | null = group.plans[0] ?? null
  const groupStorageKey = getSavedPlanGroupStorageKey(group.key)

  return {
    groupLabel,
    groupSummary,
    groupIntentSummary,
    groupSuggestionSummary,
    groupManualReviewCount,
    groupMetricLeaders,
    groupLeaderCandidates,
    topGroupPlan,
    groupStorageKey,
    groupCollapsed: collapsedSavedPlanGroups.includes(groupStorageKey),
  }
}
