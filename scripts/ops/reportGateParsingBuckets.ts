import type { ParsingFallbackBucket } from './reportGateAnomalyTypes'

export const toParsingFallbackBucket = (evidence: Set<string>): ParsingFallbackBucket => ({
  used: evidence.size > 0,
  evidence: Array.from(evidence).sort((a, b) => a.localeCompare(b)),
})
