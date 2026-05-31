import { fallback } from './formatting'
import { buildDatasetInfoHealth } from './health'
import type { BuildDatasetInfoModelParams, DatasetInfoModel } from './types'

export type {
  BuildDatasetInfoModelParams,
  DatasetInfoModel,
  DatasetManifest,
  DatasetMetaSummary,
  HealthDelta,
  IngestReport,
  LatestPointer,
  MetricsHistoryEntry,
} from './types'

export const buildDatasetInfoModel = (
  params: BuildDatasetInfoModelParams,
): DatasetInfoModel => {
  const districtId = params.meta?.districtId ?? params.manifest?.districtId ?? '-'
  const districtName =
    params.meta?.districtName ?? params.manifest?.districtName ?? '-'
  const { anomalies, health, publishedAt } = buildDatasetInfoHealth({
    districtId,
    latest: params.latest,
    meta: params.meta,
    manifest: params.manifest,
    report: params.report,
    metricsHistory: params.metricsHistory,
  })

  return {
    districtId,
    districtName,
    dataSource: params.dataSource ?? '-',
    schemaVersion: fallback(
      params.meta?.schemaVersion ?? params.manifest?.schemaVersion,
    ),
    datasetHash: fallback(
      params.meta?.datasetHash ?? params.latest?.datasetHash ?? params.manifest?.datasetHash,
    ),
    configHash: fallback(params.meta?.configHash ?? params.manifest?.configHash),
    generatedAt: fallback(params.meta?.generatedAt ?? params.manifest?.generatedAt),
    publishedAt,
    metaSha256: fallback(params.manifest?.metaSha256),
    packSha256: fallback(params.manifest?.packSha256),
    totalBytes: fallback(
      params.manifest?.totalBytes ?? params.meta?.totalBytes ?? null,
    ),
    gateResult: fallback(params.manifest?.gateResult),
    anomalies: anomalies.length > 0 ? anomalies : ['-'],
    health,
  }
}
