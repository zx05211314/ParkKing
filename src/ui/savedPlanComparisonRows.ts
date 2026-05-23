import type { SavedPlan, SavedPlanComparisonRow } from './savedPlanTypes'
import {
  compareComparisonValue,
  formatSavedPlanComparisonDuration,
} from './savedPlanComparisonFormatting'

export const buildSavedPlanComparisonRows = (
  leftPlan: SavedPlan,
  rightPlan: SavedPlan,
): SavedPlanComparisonRow[] => {
  const rows = [
    {
      label: 'District',
      left: compareComparisonValue(leftPlan.datasetId, 'Unassigned'),
      right: compareComparisonValue(rightPlan.datasetId, 'Unassigned'),
    },
    {
      label: 'Address',
      left: compareComparisonValue(leftPlan.addressLabel),
      right: compareComparisonValue(rightPlan.addressLabel),
    },
    {
      label: 'Segment',
      left: compareComparisonValue(leftPlan.segmentName),
      right: compareComparisonValue(rightPlan.segmentName),
    },
    {
      label: 'Target',
      left: compareComparisonValue(leftPlan.targetLabel),
      right: compareComparisonValue(rightPlan.targetLabel),
    },
    {
      label: 'Intent',
      left: compareComparisonValue(leftPlan.intent),
      right: compareComparisonValue(rightPlan.intent),
    },
    {
      label: 'Legality',
      left: compareComparisonValue(leftPlan.allowedAction),
      right: compareComparisonValue(rightPlan.allowedAction),
    },
    {
      label: 'Spaces',
      left:
        typeof leftPlan.parkingSpaceCount === 'number'
          ? String(leftPlan.parkingSpaceCount)
          : '-',
      right:
        typeof rightPlan.parkingSpaceCount === 'number'
          ? String(rightPlan.parkingSpaceCount)
          : '-',
    },
    {
      label: 'Tier',
      left: compareComparisonValue(leftPlan.tier),
      right: compareComparisonValue(rightPlan.tier),
    },
    {
      label: 'Pinned',
      left: leftPlan.pinned ? 'Yes' : 'No',
      right: rightPlan.pinned ? 'Yes' : 'No',
    },
    {
      label: 'Rank',
      left: compareComparisonValue(leftPlan.recommendationRankMode),
      right: compareComparisonValue(rightPlan.recommendationRankMode),
    },
    {
      label: 'Route',
      left: compareComparisonValue(leftPlan.routeProfile),
      right: compareComparisonValue(rightPlan.routeProfile),
    },
    {
      label: 'Risk',
      left: compareComparisonValue(leftPlan.riskMode),
      right: compareComparisonValue(rightPlan.riskMode),
    },
    {
      label: 'Time',
      left: compareComparisonValue(leftPlan.mode),
      right: compareComparisonValue(rightPlan.mode),
    },
    {
      label: 'Radius',
      left:
        typeof leftPlan.radiusMeters === 'number' ? `${leftPlan.radiusMeters} m` : '-',
      right:
        typeof rightPlan.radiusMeters === 'number'
          ? `${rightPlan.radiusMeters} m`
          : '-',
    },
    {
      label: 'Action',
      left: compareComparisonValue(leftPlan.actionFilter),
      right: compareComparisonValue(rightPlan.actionFilter),
    },
    {
      label: 'Walk ETA',
      left: formatSavedPlanComparisonDuration(
        leftPlan.walkingDurationSeconds,
        leftPlan.walkingEstimated,
      ),
      right: formatSavedPlanComparisonDuration(
        rightPlan.walkingDurationSeconds,
        rightPlan.walkingEstimated,
      ),
    },
    {
      label: 'Drive ETA',
      left: formatSavedPlanComparisonDuration(
        leftPlan.drivingDurationSeconds,
        leftPlan.drivingEstimated,
      ),
      right: formatSavedPlanComparisonDuration(
        rightPlan.drivingDurationSeconds,
        rightPlan.drivingEstimated,
      ),
    },
  ]

  return rows.map((row) => ({
    ...row,
    same: row.left === row.right,
  }))
}
