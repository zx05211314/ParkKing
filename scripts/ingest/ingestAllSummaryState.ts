import * as path from 'node:path'
import type { BenchmarkResult } from '../bench/benchEvaluate'
import {
  compareWithBaseline,
} from '../ops/compareBaseline'
import type { BBox } from './ingestAllArtifacts'
import type { IngestDistrictSummary } from './ingestAllTypes'
import type { ResolvedConfig } from './readConfig'
import {
  buildBaselineCandidate,
  buildCurrentMetrics,
  loadBaselineMetrics,
} from './ingestAllBaselineState'

export const buildIngestDistrictSummary = async (params: {
  config: ResolvedConfig
  label: string
  meta: Record<string, unknown>
  bbox: BBox | null
  dayEval: BenchmarkResult
  nightEval: BenchmarkResult
  cwd?: string
}): Promise<IngestDistrictSummary> => {
  const { config, label, meta, bbox, dayEval, nightEval } = params
  const counts = (meta.counts as Record<string, number>) ?? null
  const districtId =
    (meta.districtId as string) ??
    path.basename(config.outputs.generatedDir) ??
    label.replace(path.extname(label), '')

  const baseline = await loadBaselineMetrics(districtId, params.cwd)
  const currentMetrics = buildCurrentMetrics({
    meta,
    counts,
    dayEval,
    nightEval,
  })
  const warnings = compareWithBaseline(currentMetrics, baseline, config.ops.thresholds)

  return {
    districtId,
    label,
    datasetHash: (meta.datasetHash as string) ?? 'unknown',
    counts,
    bbox,
    dayEval,
    nightEval,
    intersectionsReport: (meta.intersectionsReport as Record<string, unknown>) ?? null,
    riskTagCounts: (meta.inferredRiskCounts as Record<string, number>) ?? null,
    districtName: (meta.districtName as string) ?? null,
    schemaVersion: typeof meta.schemaVersion === 'number' ? meta.schemaVersion : null,
    generatedAt: (meta.generatedAt as string) ?? null,
    warnings,
    baselineStatus: baseline ? 'loaded' : 'missing',
    baselineCandidate: baseline
      ? null
      : buildBaselineCandidate(currentMetrics, dayEval, nightEval),
    thresholds: config.ops.thresholds,
    retention: config.ops.retention,
    validation: config.validation,
    config,
    baselineUsed: baseline
      ? {
          baselineDatasetHash: baseline.baselineDatasetHash,
          baselineCreatedAt: baseline.baselineCreatedAt,
        }
      : undefined,
  }
}
