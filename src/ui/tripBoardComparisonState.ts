import {
  buildSavedPlanComparisonHighlights,
  buildSavedPlanComparisonRows,
} from './savedPlanComparison'
import { getSavedPlanMetricLeaders, sortSavedPlans } from './savedPlanSort'
import type {
  SavedPlan,
  SavedPlanComparisonHighlight,
  SavedPlanComparisonRow,
  SavedPlanMetricLeader,
  TripBoardSortMode,
} from './savedPlanTypes'

interface BuildTripBoardComparisonStateOptions {
  savedPlans: SavedPlan[]
  comparedSavedPlanUrls: string[]
  visibleSavedPlans: SavedPlan[]
  tripBoardSortMode: TripBoardSortMode
  formatSavedPlanComparisonValue: (label: string, value: string) => string
}

export interface TripBoardComparisonState {
  comparedSavedPlans: SavedPlan[]
  savedPlanComparisonRows: SavedPlanComparisonRow[]
  savedPlanComparisonHighlights: SavedPlanComparisonHighlight[]
  comparedSavedPlanLeader: SavedPlan | null
  savedPlanMetricLeaders: SavedPlanMetricLeader[]
  savedPlanMetricLeaderBadges: Map<string, string[]>
  compareBoardActionLabel: string
}

export const buildTripBoardComparisonState = ({
  savedPlans,
  comparedSavedPlanUrls,
  visibleSavedPlans,
  tripBoardSortMode,
  formatSavedPlanComparisonValue,
}: BuildTripBoardComparisonStateOptions): TripBoardComparisonState => {
  const comparedSavedPlans = comparedSavedPlanUrls.flatMap((url) => {
    const plan = savedPlans.find((entry) => entry.url === url)
    return plan ? [plan] : []
  })

  const savedPlanComparisonRows =
    comparedSavedPlans.length < 2
      ? []
      : buildSavedPlanComparisonRows(comparedSavedPlans[0], comparedSavedPlans[1]).map(
          (row) => ({
            ...row,
            left: formatSavedPlanComparisonValue(row.label, row.left),
            right: formatSavedPlanComparisonValue(row.label, row.right),
          }),
        )

  const savedPlanComparisonHighlights =
    comparedSavedPlans.length < 2
      ? []
      : buildSavedPlanComparisonHighlights(comparedSavedPlans[0], comparedSavedPlans[1])

  const comparedSavedPlanLeader =
    comparedSavedPlans.length < 2
      ? null
      : sortSavedPlans(comparedSavedPlans, tripBoardSortMode)[0] ?? null

  const savedPlanMetricLeaders = getSavedPlanMetricLeaders(visibleSavedPlans)
  const savedPlanMetricLeaderBadges = new Map<string, string[]>()
  savedPlanMetricLeaders.forEach((leader) => {
    const existing = savedPlanMetricLeaderBadges.get(leader.plan.url) ?? []
    existing.push(leader.label)
    savedPlanMetricLeaderBadges.set(leader.plan.url, existing)
  })

  return {
    comparedSavedPlans,
    savedPlanComparisonRows,
    savedPlanComparisonHighlights,
    comparedSavedPlanLeader,
    savedPlanMetricLeaders,
    savedPlanMetricLeaderBadges,
    compareBoardActionLabel:
      comparedSavedPlans.length === 1 ? 'Fill compare' : 'Compare visible',
  }
}
