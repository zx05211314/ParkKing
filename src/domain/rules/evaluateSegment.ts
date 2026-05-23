import type { EvaluatedSegment, Segment } from '../../ui/types'
import { getClippedLines } from '../geometry/clipCache'
import {
  computeCoverageScore,
  computeFinalConfidence,
  computeOverrideScore,
  computeSourceReliability,
} from '../scoring/confidence'
import { findIntersectingZonesForLine } from '../zones/zoneIntersect'
import type { ZoneIndex } from '../zones/zoneIndex'
import { queryZonesForLine } from '../zones/zoneIndex'
import type { ReasonCode } from '../reasons/reasonCodes'
import { reasonTexts } from '../reasons/reasonText'
import { isDaytime, YELLOW_TIME_WINDOWS } from './time'

export const evaluateSegment = (
  segment: Segment,
  nowHHMM: string,
): EvaluatedSegment => {
  const daytime = isDaytime(nowHHMM)
  const override = segment.signOverride
  const overrideReasonCodes: ReasonCode[] = []
  if (override) {
    overrideReasonCodes.push('OVERRIDE_APPLIED')
    if (override.status === 'LEGAL') {
      overrideReasonCodes.push('OVERRIDE_STATUS_LEGAL')
    } else if (override.status === 'ILLEGAL') {
      overrideReasonCodes.push('OVERRIDE_STATUS_ILLEGAL')
    } else if (override.status === 'UNCLEAR') {
      overrideReasonCodes.push('OVERRIDE_STATUS_UNCLEAR')
    }
  }
  const overrideWindows = override?.timeWindows ?? []
  const coverageConfidence = computeCoverageScore(segment)
  const overrideConfidence = computeOverrideScore(segment)
  const sourceReliability = computeSourceReliability(segment)
  const dataFreshnessDays = segment.dataFreshnessDays ?? null
  const parkingSpaceCount = segment.parkingSpaceCount ?? 0
  const hasMarkedParkingSpaces =
    parkingSpaceCount > 0 && segment.sourceType !== 'INFERRED'
  const parkingSpaceEvidenceEligible =
    hasMarkedParkingSpaces &&
    segment.curbMarking === 'YELLOW' &&
    coverageConfidence === 'HIGH' &&
    sourceReliability === 'HIGH'
  const strongParkingSpaceEvidenceEligible =
    parkingSpaceEvidenceEligible && parkingSpaceCount >= 2
  const computedFinalConfidence = computeFinalConfidence(
    coverageConfidence,
    overrideConfidence,
    sourceReliability,
    dataFreshnessDays,
  )
  const finalConfidence =
    // Multiple mapped parking spaces along the same curb are strong
    // corroborating evidence when old curb-paint timestamps would otherwise
    // suppress a clearly parkable yellow curb forever.
    strongParkingSpaceEvidenceEligible && computedFinalConfidence === 'LOW'
      ? 'HIGH'
      : parkingSpaceEvidenceEligible && computedFinalConfidence === 'MED'
      ? 'HIGH'
      : computedFinalConfidence
  const greenEligible =
    finalConfidence === 'HIGH' &&
    (dataFreshnessDays !== null ||
      (coverageConfidence === 'HIGH' &&
        overrideConfidence === 'HIGH' &&
        sourceReliability === 'HIGH'))
  const parkingEvidenceCodes: ReasonCode[] =
    parkingSpaceEvidenceEligible ? ['PARKING_SPACE_EVIDENCE'] : []

  const applyInferredCap = (result: EvaluatedSegment): EvaluatedSegment => {
    const isInferred =
      segment.source === 'INFERRED_CENTERLINE_OFFSET' ||
      segment.sourceType === 'INFERRED'
    if (!isInferred) {
      return result
    }
    const inferredCodes: ReasonCode[] = ['INFERRED_CAPPED']
    if (segment.riskTags?.includes('NARROW_ROAD')) {
      inferredCodes.push('INFERRED_RISK_NARROW_ROAD')
    }
    if (segment.riskTags?.includes('MAJOR_ROAD')) {
      inferredCodes.push('INFERRED_RISK_ARTERIAL')
    }
    if (
      segment.riskTags?.includes('HARD_ZONE_DENSE') ||
      segment.riskTags?.includes('HARD_ZONE_MEDIUM') ||
      segment.riskTags?.includes('HARD_ZONE_NEAR')
    ) {
      inferredCodes.push('INFERRED_RISK_HIGH_ZONE_DENSITY')
    }
    const reasonCodes = Array.from(
      new Set([...result.reasonCodes, ...inferredCodes]),
    )
    const reasons = reasonTexts(reasonCodes)
    if (result.tier === 'GREEN') {
      return { ...result, tier: 'YELLOW', reasonCodes, reasons }
    }
    return { ...result, reasonCodes, reasons }
  }

  const buildReasons = (codes: ReasonCode[]) => {
    const unique: ReasonCode[] = []
    codes.forEach((code) => {
      if (!unique.includes(code)) {
        unique.push(code)
      }
    })
    return {
      reasonCodes: unique,
      reasons: reasonTexts(unique),
    }
  }

  if (override && overrideConfidence !== 'HIGH') {
    overrideReasonCodes.push('OVERRIDE_LOW_CONFIDENCE')
  }

  const coverageCodes: ReasonCode[] = []
  if (coverageConfidence === 'LOW') {
    coverageCodes.push('COVERAGE_LOW')
  } else if (coverageConfidence === 'MED') {
    coverageCodes.push('COVERAGE_MED')
  }

  const freshnessCodes: ReasonCode[] = []
  if (dataFreshnessDays === null) {
    freshnessCodes.push('DATA_FRESHNESS_UNKNOWN')
  } else if (dataFreshnessDays > 365) {
    freshnessCodes.push('DATA_FRESHNESS_STALE')
  }

  if (override?.status === 'ILLEGAL') {
    const { reasonCodes, reasons } = buildReasons([
      'OVERRIDE_STATUS_ILLEGAL',
      ...overrideReasonCodes,
      ...coverageCodes,
      ...freshnessCodes,
    ])
    const result: EvaluatedSegment = {
      ...segment,
      tier: 'RED',
      allowedNow: 'NO_STOP',
      reasonCodes,
      reasons,
      timeWindows: overrideWindows,
      coverageConfidence,
      overrideConfidence,
      finalConfidence,
      sourceReliability,
      dataFreshnessDays,
    }
    return applyInferredCap(result)
  }

  if (override?.status === 'LEGAL') {
    const { reasonCodes, reasons } = buildReasons([
      'OVERRIDE_STATUS_LEGAL',
      ...overrideReasonCodes,
      ...parkingEvidenceCodes,
      ...coverageCodes,
      ...freshnessCodes,
    ])
    const result: EvaluatedSegment = {
      ...segment,
      tier: finalConfidence === 'LOW' ? 'YELLOW' : 'GREEN',
      allowedNow: 'PARK',
      reasonCodes,
      reasons,
      timeWindows: overrideWindows,
      coverageConfidence,
      overrideConfidence,
      finalConfidence,
      sourceReliability,
      dataFreshnessDays,
    }
    return applyInferredCap(result)
  }

  if (segment.curbMarking === 'RED') {
    const { reasonCodes, reasons } = buildReasons([
      'RULE_RED_NO_STOP',
      ...overrideReasonCodes,
      ...coverageCodes,
      ...freshnessCodes,
    ])
    const result: EvaluatedSegment = {
      ...segment,
      tier: 'RED',
      allowedNow: 'NO_STOP',
      reasonCodes,
      reasons,
      timeWindows: override ? overrideWindows : [],
      coverageConfidence,
      overrideConfidence,
      finalConfidence,
      sourceReliability,
      dataFreshnessDays,
    }
    return applyInferredCap(result)
  }

  if (segment.curbMarking === 'YELLOW') {
    const preferredWindows = override ? overrideWindows : YELLOW_TIME_WINDOWS
    const canBeGreen = finalConfidence === 'HIGH'
    if (daytime) {
      const { reasonCodes, reasons } = buildReasons([
        'RULE_YELLOW_DAY_NO_PARK',
        ...overrideReasonCodes,
        ...parkingEvidenceCodes,
        ...coverageCodes,
        ...freshnessCodes,
      ])
      const result: EvaluatedSegment = {
        ...segment,
        tier: 'YELLOW',
        allowedNow: 'TEMP_STOP',
        reasonCodes,
        reasons,
        timeWindows: preferredWindows,
        coverageConfidence,
        overrideConfidence,
        finalConfidence,
        sourceReliability,
        dataFreshnessDays,
      }
      return applyInferredCap(result)
    }

    const { reasonCodes, reasons } = buildReasons([
      'RULE_YELLOW_NIGHT_PARK_POSSIBLE',
      ...overrideReasonCodes,
      ...parkingEvidenceCodes,
      ...coverageCodes,
      ...freshnessCodes,
    ])
    const result: EvaluatedSegment = {
      ...segment,
      tier: canBeGreen && greenEligible ? 'GREEN' : 'YELLOW',
      allowedNow: 'PARK',
      reasonCodes,
      reasons,
      timeWindows: preferredWindows,
      coverageConfidence,
      overrideConfidence,
      finalConfidence,
      sourceReliability,
      dataFreshnessDays,
    }
    return applyInferredCap(result)
  }

  if (segment.curbMarking === 'WHITE_EDGE' || segment.curbMarking === 'NONE') {
    const { reasonCodes, reasons } = buildReasons([
      'RULE_NEEDS_SIGNS_CHECK',
      ...overrideReasonCodes,
      ...parkingEvidenceCodes,
      ...coverageCodes,
      ...freshnessCodes,
    ])
    const result: EvaluatedSegment = {
      ...segment,
      tier: 'YELLOW',
      allowedNow: 'PARK',
      reasonCodes,
      reasons,
      timeWindows: override ? overrideWindows : [],
      coverageConfidence,
      overrideConfidence,
      finalConfidence,
      sourceReliability,
      dataFreshnessDays,
    }
    return applyInferredCap(result)
  }

  const { reasonCodes, reasons } = buildReasons([
    'UNKNOWN_MARKING',
    ...overrideReasonCodes,
    ...parkingEvidenceCodes,
    ...coverageCodes,
    ...freshnessCodes,
  ])
  const result: EvaluatedSegment = {
    ...segment,
    tier: 'YELLOW',
    allowedNow: 'TEMP_STOP',
    reasonCodes,
    reasons,
    timeWindows: override ? overrideWindows : [],
    coverageConfidence,
    overrideConfidence,
    finalConfidence,
    sourceReliability,
    dataFreshnessDays,
  }
  return applyInferredCap(result)
}

export const evaluateSegmentWithZones = (
  segment: Segment,
  nowHHMM: string,
  zoneIndex: ZoneIndex | null,
): EvaluatedSegment[] => {
  const base = evaluateSegment(segment, nowHHMM)

  if (!zoneIndex) {
    return [base]
  }

  const candidateZones = queryZonesForLine(segment.path, zoneIndex)
  if (candidateZones.length === 0) {
    return [base]
  }

  const clipped = getClippedLines(
    zoneIndex.datasetHash,
    segment.id,
    zoneIndex.paramsVersion,
    segment.path,
    candidateZones.map((zone) => zone.polygon),
  )

  if (clipped.length === 0) {
    return [base]
  }

  return clipped.map((piece, index) => {
    const partId = `${segment.id}-part-${index + 1}`
    const partName = `${segment.name} - Part ${index + 1}`
    const intersectingZones = piece.insideAnyPolygon
      ? findIntersectingZonesForLine(piece.line, candidateZones)
      : []

    const zoneReasonCodes = intersectingZones.map((zone) => {
      switch (zone.type) {
        case 'BUS_STOP_BUFFER':
          return 'ZONE_BUS_STOP'
        case 'HYDRANT_BUFFER':
          return 'ZONE_HYDRANT'
        case 'INTERSECTION_BUFFER':
          return 'ZONE_INTERSECTION'
        case 'CROSSWALK_BUFFER':
          return 'ZONE_CROSSWALK'
        default:
          return 'ZONE_INTERSECTION'
      }
    }) as ReasonCode[]

    const reasonCodes = piece.insideAnyPolygon
      ? Array.from(new Set([...base.reasonCodes, ...zoneReasonCodes]))
      : base.reasonCodes
    const reasons = reasonTexts(reasonCodes)

    return {
      ...base,
      id: partId,
      name: partName,
      path: piece.line,
      reasonCodes,
      reasons,
      tier: piece.insideAnyPolygon ? 'RED' : base.tier,
      allowedNow: piece.insideAnyPolygon ? 'NO_STOP' : base.allowedNow,
    }
  })
}
