import type { ReasonCode } from './reasonCodes'

const REASON_TEXT: Record<ReasonCode, string> = {
  ZONE_BUS_STOP: 'zone restriction: bus stop',
  ZONE_HYDRANT: 'zone restriction: hydrant',
  ZONE_INTERSECTION: 'zone restriction: intersection',
  ZONE_CROSSWALK: 'zone restriction: crosswalk',
  OVERRIDE_APPLIED: 'sign override applied',
  OVERRIDE_LOW_CONFIDENCE: 'override confidence not high',
  INFERRED_CAPPED: 'Inferred candidate: not officially marked; verify signage on-site.',
  INFERRED_RISK_NARROW_ROAD: 'inferred risk: narrow road',
  INFERRED_RISK_ARTERIAL: 'inferred risk: arterial road',
  INFERRED_RISK_HIGH_ZONE_DENSITY: 'inferred risk: nearby hard zones',
  DATA_FRESHNESS_UNKNOWN: 'data freshness unknown',
  DATA_FRESHNESS_STALE: 'data may be stale',
  COVERAGE_LOW: 'coverage confidence low',
  COVERAGE_MED: 'coverage confidence medium',
  RULE_YELLOW_DAY_NO_PARK: 'no parking daytime',
  RULE_YELLOW_NIGHT_PARK_POSSIBLE: 'night parking allowed',
  RULE_RED_NO_STOP: 'red curb',
  RULE_NEEDS_SIGNS_CHECK: 'needs statutory + signs check later',
  UNKNOWN_MARKING: 'unknown marking',
}

export const reasonText = (code: ReasonCode): string => {
  return REASON_TEXT[code] ?? code
}

export const reasonTexts = (codes: ReasonCode[]): string[] => {
  return codes.map((code) => reasonText(code))
}
