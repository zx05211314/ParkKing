import type { GateAnomalyReport } from './reportGateAnomalyTypes'
import type { GateAnomalyReportState } from './reportGateAnomalyReportState'

export const createGateAnomalyReport = (params: {
  state: GateAnomalyReportState
  generatedAt?: string
}): GateAnomalyReport => {
  const { context, invalidGeometry, thresholdSummary, bboxCenterAnomalies } = params.state

  return {
    schemaVersion: 1,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    districtId: context.districtId,
    packPath: context.packPath,
    outPath: context.outPath,
    diffReportPath: context.diffReportPath,
    prevPackPath: context.prevPackPath,
    nextPackPath: context.nextPackPath,
    prevPublishedAt: context.prevPublishedAt,
    nextPublishedAt: context.nextPublishedAt,
    prevDistrictIds: context.prevDistrictIds,
    nextDistrictIds: context.nextDistrictIds,
    parsingFallbacks: context.parsingFallbacks,
    invalidGeometry,
    thresholdDeltas: {
      issues: thresholdSummary.issues,
      deltas: thresholdSummary.deltas,
    },
    bboxCenterAnomalies,
    topOffenders: thresholdSummary.topOffenders,
  }
}
