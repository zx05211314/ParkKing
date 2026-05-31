import type { GateAnomalyContext } from './reportGateAnomalyContext'
import { loadGateAnomalyContext } from './reportGateAnomalyContext'
import { buildInvalidGeometrySummary } from './reportGateAnomalyInvalidGeometry'
import {
  buildBoundaryCenterAnomalySummary,
  buildThresholdDeltaSummary,
} from './reportGateAnomalyThresholds'
import type { GateAnomalyReport } from './reportGateAnomalyTypes'

export interface GateAnomalyReportState {
  context: GateAnomalyContext
  invalidGeometry: GateAnomalyReport['invalidGeometry']
  thresholdSummary: ReturnType<typeof buildThresholdDeltaSummary>
  bboxCenterAnomalies: GateAnomalyReport['bboxCenterAnomalies']
}

export const loadGateAnomalyReportState = async (params: {
  districtId: string
  packPath?: string | null
  outPath?: string | null
}): Promise<GateAnomalyReportState> => {
  const context = await loadGateAnomalyContext(params)
  return {
    context,
    invalidGeometry: await buildInvalidGeometrySummary(context.packPath),
    thresholdSummary: buildThresholdDeltaSummary(
      (context.districtDiff?.meta ?? {}) as Record<
        string,
        Record<string, unknown> | undefined
      >,
      context.districtDiff?.issues ?? [],
    ),
    bboxCenterAnomalies: buildBoundaryCenterAnomalySummary(
      context.meta,
      context.districtDiff,
    ),
  }
}
