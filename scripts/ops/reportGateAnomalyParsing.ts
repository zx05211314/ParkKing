import * as path from 'node:path'
import { fileExists } from './diffPackFiles'
import { analyzeCsvFallbackFile } from './reportGateCsvFallbacks'
import { toParsingFallbackBucket } from './reportGateParsingBuckets'
import type { ParsingFallbackSummary } from './reportGateAnomalyTypes'

export const analyzeParsingFallbacks = async (
  sourceFiles: string[],
): Promise<ParsingFallbackSummary> => {
  const big5Evidence = new Set<string>()
  const tabEvidence = new Set<string>()
  const headerEvidence = new Set<string>()
  const missingPrjEvidence = new Set<string>()

  for (const sourcePath of sourceFiles) {
    const normalizedPath = path.resolve(sourcePath)
    const ext = path.extname(normalizedPath).toLowerCase()
    if (ext === '.csv' && (await fileExists(normalizedPath))) {
      const csvFallbacks = await analyzeCsvFallbackFile(normalizedPath)
      if (csvFallbacks.big5Fallback) {
        big5Evidence.add(normalizedPath)
      }
      if (csvFallbacks.tabDelimiter) {
        tabEvidence.add(normalizedPath)
      }
      if (csvFallbacks.headerMatchFallback) {
        headerEvidence.add(normalizedPath)
      }
      continue
    }

    if (ext === '.shp') {
      const prjPath = normalizedPath.replace(/\.shp$/i, '.prj')
      if (!(await fileExists(prjPath))) {
        missingPrjEvidence.add(normalizedPath)
      }
    }
  }

  return {
    big5Fallback: toParsingFallbackBucket(big5Evidence),
    tabDelimiter: toParsingFallbackBucket(tabEvidence),
    headerMatchFallback: toParsingFallbackBucket(headerEvidence),
    missingPrjHeuristic: toParsingFallbackBucket(missingPrjEvidence),
  }
}
