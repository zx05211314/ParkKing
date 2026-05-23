import { compareDuration, compareParkingQuality } from './savedPlanSort'
import type {
  SavedPlan,
  SavedPlanComparisonHighlight,
} from './savedPlanTypes'
import {
  describeSavedPlanParkingQuality,
  formatSavedPlanComparisonDuration,
} from './savedPlanComparisonFormatting'

export const buildSavedPlanComparisonHighlights = (
  leftPlan: SavedPlan,
  rightPlan: SavedPlan,
): SavedPlanComparisonHighlight[] => {
  const highlights: SavedPlanComparisonHighlight[] = []
  const walkEtaDelta = compareDuration(
    leftPlan.walkingDurationSeconds,
    rightPlan.walkingDurationSeconds,
  )
  if (
    walkEtaDelta !== 0 &&
    (leftPlan.walkingDurationSeconds !== undefined ||
      rightPlan.walkingDurationSeconds !== undefined)
  ) {
    const winner = walkEtaDelta < 0 ? 'left' : 'right'
    const winnerPlan = winner === 'left' ? leftPlan : rightPlan
    const otherPlan = winner === 'left' ? rightPlan : leftPlan
    highlights.push({
      label: 'Walk ETA',
      winner,
      summary:
        winnerPlan.walkingDurationSeconds !== undefined &&
        otherPlan.walkingDurationSeconds !== undefined
          ? `${winnerPlan.title} has the faster walk ETA (${formatSavedPlanComparisonDuration(winnerPlan.walkingDurationSeconds, winnerPlan.walkingEstimated)} vs ${formatSavedPlanComparisonDuration(otherPlan.walkingDurationSeconds, otherPlan.walkingEstimated)}).`
          : `${winnerPlan.title} is the only compared plan with walk ETA ready.`,
    })
  }

  const driveEtaDelta = compareDuration(
    leftPlan.drivingDurationSeconds,
    rightPlan.drivingDurationSeconds,
  )
  if (
    driveEtaDelta !== 0 &&
    (leftPlan.drivingDurationSeconds !== undefined ||
      rightPlan.drivingDurationSeconds !== undefined)
  ) {
    const winner = driveEtaDelta < 0 ? 'left' : 'right'
    const winnerPlan = winner === 'left' ? leftPlan : rightPlan
    const otherPlan = winner === 'left' ? rightPlan : leftPlan
    highlights.push({
      label: 'Drive ETA',
      winner,
      summary:
        winnerPlan.drivingDurationSeconds !== undefined &&
        otherPlan.drivingDurationSeconds !== undefined
          ? `${winnerPlan.title} has the faster drive ETA (${formatSavedPlanComparisonDuration(winnerPlan.drivingDurationSeconds, winnerPlan.drivingEstimated)} vs ${formatSavedPlanComparisonDuration(otherPlan.drivingDurationSeconds, otherPlan.drivingEstimated)}).`
          : `${winnerPlan.title} is the only compared plan with drive ETA ready.`,
    })
  }

  const parkingQualityDelta = compareParkingQuality(leftPlan, rightPlan)
  if (
    parkingQualityDelta !== 0 &&
    (leftPlan.allowedAction ||
      rightPlan.allowedAction ||
      leftPlan.parkingSpaceCount !== undefined ||
      rightPlan.parkingSpaceCount !== undefined ||
      leftPlan.tier ||
      rightPlan.tier)
  ) {
    const winner = parkingQualityDelta < 0 ? 'left' : 'right'
    const winnerPlan = winner === 'left' ? leftPlan : rightPlan
    const otherPlan = winner === 'left' ? rightPlan : leftPlan
    highlights.push({
      label: 'Parking quality',
      winner,
      summary: `${winnerPlan.title} has the stronger parking quality (${describeSavedPlanParkingQuality(winnerPlan)} vs ${describeSavedPlanParkingQuality(otherPlan)}).`,
    })
  }

  return highlights
}
