import type { SavedPlan, SavedPlanMetricLeader, TripBoardSortMode } from './savedPlanTypes'

const scoreAllowedAction = (value?: SavedPlan['allowedAction']) => {
  if (value === 'PARK') {
    return 3
  }
  if (value === 'TEMP_STOP') {
    return 2
  }
  if (value === 'NO_STOP') {
    return 1
  }
  return 0
}

const scoreTier = (value?: SavedPlan['tier']) => {
  if (value === 'GREEN') {
    return 3
  }
  if (value === 'YELLOW') {
    return 2
  }
  if (value === 'RED') {
    return 1
  }
  return 0
}

const compareRecentFirst = (left: SavedPlan, right: SavedPlan) =>
  right.createdAt.localeCompare(left.createdAt)

const comparePinnedFirst = (left: SavedPlan, right: SavedPlan) =>
  Number(Boolean(right.pinned)) - Number(Boolean(left.pinned))

export const compareDuration = (
  left: number | undefined,
  right: number | undefined,
) => {
  if (left === undefined && right === undefined) {
    return 0
  }
  if (left === undefined) {
    return 1
  }
  if (right === undefined) {
    return -1
  }
  return left - right
}

export const compareParkingQuality = (left: SavedPlan, right: SavedPlan) => {
  const allowedDelta =
    scoreAllowedAction(right.allowedAction) - scoreAllowedAction(left.allowedAction)
  if (allowedDelta !== 0) {
    return allowedDelta
  }
  const spaceDelta = (right.parkingSpaceCount ?? 0) - (left.parkingSpaceCount ?? 0)
  if (spaceDelta !== 0) {
    return spaceDelta
  }
  const tierDelta = scoreTier(right.tier) - scoreTier(left.tier)
  if (tierDelta !== 0) {
    return tierDelta
  }
  const walkEtaDelta = compareDuration(
    left.walkingDurationSeconds,
    right.walkingDurationSeconds,
  )
  if (walkEtaDelta !== 0) {
    return walkEtaDelta
  }
  const driveEtaDelta = compareDuration(
    left.drivingDurationSeconds,
    right.drivingDurationSeconds,
  )
  if (driveEtaDelta !== 0) {
    return driveEtaDelta
  }
  return 0
}

export const compareSavedPlansByMode = (
  left: SavedPlan,
  right: SavedPlan,
  mode: TripBoardSortMode,
) => {
  if (mode === 'WALK_ETA') {
    const walkEtaDelta = compareDuration(
      left.walkingDurationSeconds,
      right.walkingDurationSeconds,
    )
    if (walkEtaDelta !== 0) {
      return walkEtaDelta
    }
    const qualityDelta = compareParkingQuality(left, right)
    if (qualityDelta !== 0) {
      return qualityDelta
    }
    return compareRecentFirst(left, right)
  }

  if (mode === 'DRIVE_ETA') {
    const driveEtaDelta = compareDuration(
      left.drivingDurationSeconds,
      right.drivingDurationSeconds,
    )
    if (driveEtaDelta !== 0) {
      return driveEtaDelta
    }
    const qualityDelta = compareParkingQuality(left, right)
    if (qualityDelta !== 0) {
      return qualityDelta
    }
    return compareRecentFirst(left, right)
  }

  if (mode === 'QUALITY') {
    const qualityDelta = compareParkingQuality(left, right)
    if (qualityDelta !== 0) {
      return qualityDelta
    }
    return compareRecentFirst(left, right)
  }

  return compareRecentFirst(left, right)
}

export const sortSavedPlans = (
  plans: SavedPlan[],
  mode: TripBoardSortMode,
) => {
  return [...plans].sort((left, right) => {
    const pinDelta = comparePinnedFirst(left, right)
    if (pinDelta !== 0) {
      return pinDelta
    }
    return compareSavedPlansByMode(left, right, mode)
  })
}

export const getSavedPlanMetricLeaders = (
  plans: SavedPlan[],
): SavedPlanMetricLeader[] => {
  const metricConfigs: Array<Pick<SavedPlanMetricLeader, 'key' | 'label'>> = [
    { key: 'WALK_ETA', label: 'Best walk' },
    { key: 'DRIVE_ETA', label: 'Best drive' },
    { key: 'QUALITY', label: 'Best parking quality' },
  ]

  return metricConfigs.flatMap((metric) => {
    const leader = [...plans].sort((left, right) =>
      compareSavedPlansByMode(left, right, metric.key),
    )[0]
    return leader ? [{ ...metric, plan: leader }] : []
  })
}

export const getSavedPlanLeaderCandidates = (
  plans: SavedPlan[],
  limit = 2,
): SavedPlan[] => {
  if (limit <= 0) {
    return []
  }

  const selected: SavedPlan[] = []
  const seen = new Set<string>()

  getSavedPlanMetricLeaders(plans).forEach((leader) => {
    if (selected.length >= limit || seen.has(leader.plan.url)) {
      return
    }
    selected.push(leader.plan)
    seen.add(leader.plan.url)
  })

  plans.forEach((plan) => {
    if (selected.length >= limit || seen.has(plan.url)) {
      return
    }
    selected.push(plan)
    seen.add(plan.url)
  })

  return selected
}
