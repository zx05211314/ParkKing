import type { IngestAllReport, IngestDistrictSummary } from './ingestAllTypes'

export const logIngestBatchSummary = (
  summaries: IngestDistrictSummary[],
  logger: (message: string) => void = console.log,
) => {
  if (summaries.length === 0) {
    return
  }

  logger('Batch ingest summary:')
  summaries.forEach((summary) => {
    const counts = summary.counts
    const dayMs = summary.dayEval?.timingsMs.evalFirst ?? 0
    const nightMs = summary.nightEval?.timingsMs.evalFirst ?? 0
    const warningCount = summary.warnings.filter(
      (warning) => warning.severity !== 'INFO',
    ).length
    const countLabel = counts
      ? `segments ${counts.segments ?? 0} | zones ${counts.zones ?? 0} | inferred ${counts.inferredCandidates ?? 0}`
      : 'counts unavailable'
    const bboxLabel = summary.bbox
      ? `${summary.bbox.minX.toFixed(4)},${summary.bbox.minY.toFixed(4)} -> ${summary.bbox.maxX.toFixed(4)},${summary.bbox.maxY.toFixed(4)}`
      : 'unknown'
    logger(
      `${summary.label} | ${countLabel} | eval ms day ${dayMs} night ${nightMs} | warnings ${warningCount} | bbox ${bboxLabel} | hash ${summary.datasetHash}`,
    )
  })
}

export const logWarnSummaries = (
  summaries: IngestDistrictSummary[],
  logger: (message: string) => void = console.log,
) => {
  const warnSummaries = summaries.filter((summary) =>
    summary.warnings.some((warning) => warning.severity !== 'INFO'),
  )
  if (warnSummaries.length === 0) {
    return
  }

  logger('WARN summary:')
  warnSummaries.forEach((summary) => {
    const actionable = summary.warnings.filter((warning) => warning.severity !== 'INFO')
    const types = actionable.map((warning) => warning.code).join(', ')
    logger(`${summary.districtId}: ${actionable.length} issue(s) [${types}]`)
  })
}

export const buildIngestAllReport = (
  summaries: IngestDistrictSummary[],
  generatedAt = new Date().toISOString(),
): IngestAllReport => ({
  generatedAt,
  districts: summaries.map((summary) => ({
    districtId: summary.districtId,
    districtName: summary.districtName ?? summary.label,
    datasetHash: summary.datasetHash,
    schemaVersion: summary.schemaVersion,
    generatedAt: summary.generatedAt,
    counts: summary.counts,
    bbox: summary.bbox,
    intersectionsReport: summary.intersectionsReport,
    riskTagCounts: summary.riskTagCounts,
    evaluations: {
      day: summary.dayEval,
      night: summary.nightEval,
    },
    reasonCodes:
      summary.dayEval && summary.nightEval
        ? {
            day: summary.dayEval.reasonCodes,
            night: summary.nightEval.reasonCodes,
          }
        : null,
    thresholds: summary.thresholds,
    ...(summary.validation ? { validation: summary.validation } : {}),
    baselineStatus: summary.baselineStatus,
    baselineCandidate: summary.baselineCandidate,
    warnings: summary.warnings,
  })),
})
