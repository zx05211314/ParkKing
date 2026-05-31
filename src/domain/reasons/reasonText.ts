import type { ReasonCode } from './reasonCodes'

const REASON_TEXT: Record<ReasonCode, string> = {
  ZONE_BUS_STOP: 'zone restriction: bus stop',
  ZONE_HYDRANT: 'zone restriction: hydrant',
  ZONE_INTERSECTION: 'zone restriction: intersection',
  ZONE_CROSSWALK: 'zone restriction: crosswalk',
  PARKING_SPACE_EVIDENCE: 'official marked parking spaces mapped along this curb',
  OVERRIDE_APPLIED: 'reviewed sign evidence applied to this curb',
  OVERRIDE_LOW_CONFIDENCE: 'reviewed sign evidence has low confidence',
  OVERRIDE_STATUS_LEGAL:
    'reviewed sign evidence confirms parking is allowed here',
  OVERRIDE_STATUS_ILLEGAL:
    'reviewed sign evidence confirms parking is not allowed here',
  OVERRIDE_STATUS_UNCLEAR: 'reviewed sign evidence is unclear',
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
