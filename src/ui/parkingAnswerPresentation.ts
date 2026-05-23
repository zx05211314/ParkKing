import type { ParkingAnswer } from '../domain/answers/parkingAnswer'

export type ParkingAnswerTrustTone = 'strong' | 'caution' | 'blocked' | 'unknown'

export interface ParkingAnswerTrustSummary {
  trustLabel: string
  trustTone: ParkingAnswerTrustTone
  evidenceStrength: string
  nextStep: string
  fieldChecks: string[]
}

const unique = (items: string[]) => Array.from(new Set(items))

const hasCaveatMatching = (answer: ParkingAnswer, pattern: RegExp) =>
  answer.caveats.some((caveat) => pattern.test(caveat))

const hasReasonCode = (answer: ParkingAnswer, reasonCode: string) =>
  answer.primary?.reasonCodes.includes(reasonCode as never) ?? false

const buildFieldChecks = (answer: ParkingAnswer): string[] => {
  if (!answer.primary) {
    return [
      'Move the pin to a mapped curb or choose one of the nearby ranked targets.',
      'Do not infer legality from an empty map result.',
    ]
  }

  const checks: string[] = []
  if (answer.kind === 'PARK') {
    checks.push('Confirm the posted curb signs still allow parking at this time.')
  } else if (answer.kind === 'TEMP_STOP') {
    checks.push('Do not leave the vehicle parked here; treat this as temporary stopping only.')
  } else if (answer.kind === 'NO_STOP') {
    checks.push('Choose another curb; this pinned point is mapped as no-stop or no-parking.')
  }

  if (answer.evidence.kind === 'MARKED_SPACE') {
    checks.push('Confirm the marked space still exists and is not blocked by temporary signs.')
  }
  if (answer.evidence.kind === 'CURB_RULE') {
    checks.push('Check for posted sign overrides because no official marked-space evidence is mapped.')
  }
  if (answer.evidence.kind === 'INFERRED') {
    checks.push('Treat this inferred curb as a lead, not a confirmed legal parking space.')
  }
  if (hasReasonCode(answer, 'DATA_FRESHNESS_STALE')) {
    checks.push('Verify current curb paint because the mapped curb data may be stale.')
  }
  if (hasReasonCode(answer, 'DATA_FRESHNESS_UNKNOWN')) {
    checks.push('Verify current curb paint because the data freshness is unknown.')
  }
  if (hasCaveatMatching(answer, /no reviewed sign overrides/i)) {
    checks.push('Be extra conservative: this district has no reviewed sign overrides yet.')
  }
  if (answer.primary.finalConfidence === 'LOW') {
    checks.push('Use this only as a low-confidence hint until signs are checked on-site.')
  }

  return unique(checks)
}

export const buildParkingAnswerTrustSummary = (
  answer: ParkingAnswer,
): ParkingAnswerTrustSummary => {
  const fieldChecks = buildFieldChecks(answer)

  if (!answer.primary) {
    return {
      trustLabel: 'No answer',
      trustTone: 'unknown',
      evidenceStrength: 'No mapped curb or marked-space evidence matched this pin.',
      nextStep: 'Move the pin or use a nearby ranked target before deciding.',
      fieldChecks,
    }
  }

  if (answer.kind === 'NO_STOP') {
    return {
      trustLabel:
        answer.primary.finalConfidence === 'LOW'
          ? 'Blocked, low-confidence map'
          : 'Blocked',
      trustTone: 'blocked',
      evidenceStrength:
        answer.evidence.kind === 'MARKED_SPACE'
          ? 'Marked-space data exists nearby, but the active curb rule blocks parking.'
          : answer.evidence.label,
      nextStep: 'Do not stop or park at this pinned curb.',
      fieldChecks,
    }
  }

  if (answer.kind === 'TEMP_STOP') {
    return {
      trustLabel: 'No parking now',
      trustTone: 'caution',
      evidenceStrength: answer.evidence.label,
      nextStep: 'Treat this as a temporary stopping lead only.',
      fieldChecks,
    }
  }

  const lowConfidence =
    answer.primary.finalConfidence === 'LOW' || answer.evidence.kind === 'INFERRED'
  const strongParkingEvidence =
    answer.evidence.kind === 'MARKED_SPACE' &&
    answer.primary.finalConfidence === 'HIGH' &&
    !hasReasonCode(answer, 'DATA_FRESHNESS_STALE') &&
    !hasReasonCode(answer, 'DATA_FRESHNESS_UNKNOWN')

  if (lowConfidence) {
    return {
      trustLabel: 'Verify first',
      trustTone: 'caution',
      evidenceStrength: answer.evidence.label,
      nextStep: 'Do not rely on this answer until posted signs are checked.',
      fieldChecks,
    }
  }

  if (strongParkingEvidence) {
    return {
      trustLabel: 'High trust',
      trustTone: 'strong',
      evidenceStrength: answer.evidence.label,
      nextStep: 'Likely parkable if the current curb signs still match.',
      fieldChecks,
    }
  }

  return {
    trustLabel: 'Sign check needed',
    trustTone: 'caution',
    evidenceStrength: answer.evidence.label,
    nextStep: 'Park only after confirming the posted curb signs on-site.',
    fieldChecks,
  }
}
