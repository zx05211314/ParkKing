import { buildBaselineBenchmarkSections } from './generateBaselineRecordBenchmarks'
import { buildBaselineCounts } from './generateBaselineRecordCounts'
import { sha256Text } from './generateBaselineRecordHash'
import type { BuildBaselineRecordParams } from './generateBaselineRecordTypes'

export const buildBaselineRecord = (params: BuildBaselineRecordParams) => {
  const benchmarkSections = buildBaselineBenchmarkSections(params)
  return {
    baselineCreatedAt: new Date().toISOString(),
    baselineDatasetHash:
      params.entry.datasetHash ?? (params.meta.datasetHash as string) ?? 'unknown',
    baselineSchemaVersion:
      params.entry.schemaVersion ?? (params.meta.schemaVersion as number) ?? 0,
    baselineSourceMetaSha256: params.entry.metaSha256 ?? sha256Text(params.metaRaw),
    baselineDistrictName: params.entry.districtName ?? (params.meta.districtName as string),
    generatedAt: new Date().toISOString(),
    districtId: params.entry.districtId,
    datasetHash: params.entry.datasetHash,
    counts: buildBaselineCounts(params.meta),
    ...benchmarkSections,
  }
}
