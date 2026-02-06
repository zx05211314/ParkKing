import type { Confidence, ConfidenceLevel, Segment } from '../../ui/types'

const confidenceRank: Record<ConfidenceLevel, number> = {
  HIGH: 3,
  MED: 2,
  LOW: 1,
}

const downgrade = (
  level: ConfidenceLevel,
  target: ConfidenceLevel,
): ConfidenceLevel => {
  return confidenceRank[level] <= confidenceRank[target] ? level : target
}

const mapCoverageConfidence = (confidence: Confidence): ConfidenceLevel => {
  switch (confidence) {
    case 'HIGH':
      return 'HIGH'
    case 'MEDIUM':
      return 'MED'
    case 'LOW':
      return 'LOW'
  }
}

export const computeCoverageScore = (segment: Segment): ConfidenceLevel => {
  return mapCoverageConfidence(segment.confidence)
}

export const computeOverrideScore = (segment: Segment): ConfidenceLevel => {
  return segment.signOverride?.confidence ?? 'HIGH'
}

export const computeSourceReliability = (segment: Segment): ConfidenceLevel => {
  if (segment.sourceReliability) {
    return segment.sourceReliability
  }

  switch (segment.curbMarking) {
    case 'RED':
    case 'YELLOW':
      return 'HIGH'
    case 'WHITE_EDGE':
    case 'NONE':
      return 'MED'
    case 'UNKNOWN':
      return 'LOW'
  }
}

export const computeFinalConfidence = (
  coverage: ConfidenceLevel,
  override: ConfidenceLevel,
  reliability: ConfidenceLevel,
  dataFreshnessDays: number | null,
): ConfidenceLevel => {
  let final = coverage

  if (confidenceRank[override] < confidenceRank[final]) {
    final = override
  }

  if (confidenceRank[reliability] < confidenceRank[final]) {
    final = reliability
  }

  if (dataFreshnessDays === null) {
    return final
  }

  if (dataFreshnessDays > 730) {
    return downgrade(final, 'LOW')
  }

  if (dataFreshnessDays > 365) {
    return downgrade(final, 'MED')
  }

  return final
}
