import type { DistrictDiff } from './diffPackTypes'
import type { GateAnomalyReport } from './reportGateAnomalyTypes'
import {
  buildBoundaryDiffAnomalies,
  sortBoundaryAnomalies,
} from './reportGateBoundaryDiffAnomalies'
import { buildBoundaryMetaAnomalies } from './reportGateBoundaryMetaAnomalies'

export const boundaryAnomalies = (
  meta: Record<string, unknown>,
  districtDiff: DistrictDiff | null,
) => {
  const anomalies: GateAnomalyReport['bboxCenterAnomalies'] = [
    ...buildBoundaryMetaAnomalies(meta),
    ...buildBoundaryDiffAnomalies(districtDiff),
  ]

  return sortBoundaryAnomalies(anomalies)
}
