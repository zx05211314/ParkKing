export type Tier = 'GREEN' | 'YELLOW' | 'RED'
export type AllowedAction = 'PARK' | 'TEMP_STOP' | 'NO_STOP'
export type CurbMarking = 'RED' | 'YELLOW' | 'WHITE_EDGE' | 'NONE' | 'UNKNOWN'
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type ConfidenceLevel = 'HIGH' | 'MED' | 'LOW'
export type SignConfidence = ConfidenceLevel
export type SegmentSourceType = 'CURB' | 'INFERRED'
export type SignOverrideStatus = 'LEGAL' | 'ILLEGAL' | 'UNCLEAR'

export interface TimeWindow {
  label: string
  startHHMM: string
  endHHMM: string
}

export interface SignOverride {
  timeWindows: TimeWindow[]
  note: string
  confidence: SignConfidence
  status?: SignOverrideStatus
  source?: 'segmentId' | 'spatial' | 'dataset'
  verifiedAt?: string
  reviewedSegmentId?: string
  reviewedHhmm?: string
}

export interface Segment {
  id: string
  name: string
  curbMarking: CurbMarking
  confidence: Confidence
  path: [number, number][]
  parkingSpaceCount?: number
  signOverride?: SignOverride
  sourceReliability?: ConfidenceLevel
  dataFreshnessDays?: number | null
  sourceType?: SegmentSourceType
  source?: string
  riskTags?: string[]
}

export interface EvaluatedSegment extends Segment {
  tier: Tier
  allowedNow: AllowedAction
  reasonCodes: ReasonCode[]
  reasons: string[]
  timeWindows: TimeWindow[]
  coverageConfidence: ConfidenceLevel
  overrideConfidence: ConfidenceLevel
  finalConfidence: ConfidenceLevel
  sourceReliability: ConfidenceLevel
  dataFreshnessDays: number | null
}
import type { ReasonCode } from '../domain/reasons/reasonCodes'
