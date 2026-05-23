import type { EvaluatedSegment } from '../../ui/types'
import { rankSegments, type RiskMode } from './rank'
export type { RiskMode } from './rank'

export interface RankingPolicyOptions {
  includeInferred: boolean
  radiusMeters?: number
  riskMode?: RiskMode
}

export const isInferredSegment = (
  segment: Pick<EvaluatedSegment, 'source' | 'sourceType'>,
) => {
  return (
    segment.source === 'INFERRED_CENTERLINE_OFFSET' ||
    segment.sourceType === 'INFERRED'
  )
}

export const applyRankingPolicy = <T extends EvaluatedSegment & { distanceMeters?: number }>(
  segments: T[],
  options: RankingPolicyOptions,
): Array<T & { rankScore: number }> => {
  const radius = options.radiusMeters
  const withinRadius =
    radius && radius > 0
      ? segments.filter(
          (segment) =>
            segment.distanceMeters === undefined || segment.distanceMeters <= radius,
        )
      : segments

  const official = withinRadius.filter((segment) => !isInferredSegment(segment))
  const inferred = withinRadius.filter((segment) => isInferredSegment(segment))

  if (!options.includeInferred) {
    return rankSegments(official, { riskMode: options.riskMode })
  }

  return rankSegments([...official, ...inferred], { riskMode: options.riskMode })
}
