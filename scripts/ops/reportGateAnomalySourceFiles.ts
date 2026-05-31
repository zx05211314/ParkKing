import { analyzeParsingFallbacks } from './reportGateAnomalyParsing'
import type { ParsingFallbackSummary } from './reportGateAnomalyTypes'

export const extractGateAnomalySourceFiles = (
  meta: Record<string, unknown>,
): string[] => {
  if (!Array.isArray(meta.sourceFiles)) {
    return []
  }

  return meta.sourceFiles
    .map((entry) => (typeof entry === 'object' && entry ? entry.path : undefined))
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export const loadGateAnomalyParsingFallbacks = async (
  meta: Record<string, unknown>,
): Promise<ParsingFallbackSummary> => {
  return analyzeParsingFallbacks(extractGateAnomalySourceFiles(meta))
}
