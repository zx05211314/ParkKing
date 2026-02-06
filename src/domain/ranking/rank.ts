import type { EvaluatedSegment } from '../../ui/types'

export type RiskMode = 'CONSERVATIVE' | 'NEUTRAL' | 'AGGRESSIVE'

const tierWeight: Record<EvaluatedSegment['tier'], number> = {
  GREEN: 3,
  YELLOW: 1,
  RED: -3,
}

const confidenceWeight: Record<EvaluatedSegment['finalConfidence'], number> = {
  HIGH: 2,
  MED: 1,
  LOW: 0,
}

const riskTagPenalty: Record<string, number> = {
  HARD_ZONE_DENSE: -1.5,
  HARD_ZONE_MEDIUM: -0.9,
  HARD_ZONE_NEAR: -0.4,
  MAJOR_ROAD: -0.6,
  WIDE_ROAD: -0.4,
}

const riskModeConfig: Record<
  RiskMode,
  { riskPenaltyMultiplier: number; inferredPenalty: number }
> = {
  CONSERVATIVE: { riskPenaltyMultiplier: 1.4, inferredPenalty: -2.8 },
  NEUTRAL: { riskPenaltyMultiplier: 1, inferredPenalty: -2 },
  AGGRESSIVE: { riskPenaltyMultiplier: 0.6, inferredPenalty: -1.2 },
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

export const computeDistanceWeight = (distanceMeters?: number) => {
  if (distanceMeters === undefined) {
    return 0
  }
  const normalized = 1.6 - distanceMeters / 400
  return clamp(normalized, 0, 1.6)
}

export const computeFreshnessBonus = (freshnessDays: number | null) => {
  if (freshnessDays === null) {
    return -0.4
  }
  if (freshnessDays <= 30) {
    return 1
  }
  if (freshnessDays <= 90) {
    return 0.5
  }
  if (freshnessDays <= 365) {
    return 0.2
  }
  return -0.3
}

export const computeZoneDensityPenalty = (
  riskTags?: string[],
  riskMode: RiskMode = 'NEUTRAL',
) => {
  if (!riskTags || riskTags.length === 0) {
    return 0
  }
  const penalty = riskTags.reduce((sum, tag) => sum + (riskTagPenalty[tag] ?? 0), 0)
  const multiplier = riskModeConfig[riskMode]?.riskPenaltyMultiplier ?? 1
  return clamp(penalty * multiplier, -3, 0)
}

export interface RankBreakdown {
  distanceWeight: number
  tierWeight: number
  confidenceWeight: number
  inferredPenalty: number
  freshnessBonus: number
  zoneDensityPenalty: number
  total: number
}

export const getRankBreakdown = (
  segment: EvaluatedSegment,
  distanceMeters?: number,
  riskMode: RiskMode = 'NEUTRAL',
): RankBreakdown => {
  const distanceWeight = computeDistanceWeight(distanceMeters)
  const tierScore = tierWeight[segment.tier]
  const confidenceScore = confidenceWeight[segment.finalConfidence]
  const inferredPenaltyValue =
    riskModeConfig[riskMode]?.inferredPenalty ?? riskModeConfig.NEUTRAL.inferredPenalty
  const inferredPenalty =
    segment.source === 'INFERRED_CENTERLINE_OFFSET' || segment.sourceType === 'INFERRED'
      ? inferredPenaltyValue
      : 0
  const freshnessBonus = computeFreshnessBonus(segment.dataFreshnessDays ?? null)
  const zoneDensityPenalty = computeZoneDensityPenalty(segment.riskTags, riskMode)

  const total =
    distanceWeight +
    tierScore +
    confidenceScore +
    inferredPenalty +
    freshnessBonus +
    zoneDensityPenalty

  return {
    distanceWeight,
    tierWeight: tierScore,
    confidenceWeight: confidenceScore,
    inferredPenalty,
    freshnessBonus,
    zoneDensityPenalty,
    total,
  }
}

export const computeRankScore = (
  segment: EvaluatedSegment,
  distanceMeters?: number,
  riskMode: RiskMode = 'NEUTRAL',
): number => {
  return getRankBreakdown(segment, distanceMeters, riskMode).total
}

export const rankSegments = <T extends EvaluatedSegment & { distanceMeters?: number }>(
  segments: T[],
  options?: { riskMode?: RiskMode },
): Array<T & { rankScore: number }> => {
  const riskMode = options?.riskMode ?? 'NEUTRAL'
  const scored = segments.map((segment) => ({
    ...segment,
    rankScore: computeRankScore(segment, segment.distanceMeters, riskMode),
  }))

  return scored.sort((a, b) => {
    if (b.rankScore !== a.rankScore) {
      return b.rankScore - a.rankScore
    }
    const distA = a.distanceMeters ?? Number.POSITIVE_INFINITY
    const distB = b.distanceMeters ?? Number.POSITIVE_INFINITY
    if (distA !== distB) {
      return distA - distB
    }
    return a.id.localeCompare(b.id, undefined, { numeric: true })
  })
}
