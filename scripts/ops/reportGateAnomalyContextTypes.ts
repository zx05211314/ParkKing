import type { GateAnomalyReport } from './reportGateAnomalyTypes'

export type GateAnomalyDistrictDiff = ReturnType<
  typeof import('./reportGateAnomalyIssues').extractDistrictDiff
>

export interface GateAnomalyPackContext {
  districtId: string
  packPath: string
  outPath: string
  meta: Record<string, unknown>
  diffReportPath: GateAnomalyReport['diffReportPath']
  districtDiff: GateAnomalyDistrictDiff
  prevPackPath: GateAnomalyReport['prevPackPath']
  nextPackPath: GateAnomalyReport['nextPackPath']
  prevPublishedAt: GateAnomalyReport['prevPublishedAt']
  nextPublishedAt: GateAnomalyReport['nextPublishedAt']
  prevDistrictIds: GateAnomalyReport['prevDistrictIds']
  nextDistrictIds: GateAnomalyReport['nextDistrictIds']
}

export interface GateAnomalyContext extends GateAnomalyPackContext {
  parsingFallbacks: GateAnomalyReport['parsingFallbacks']
}
