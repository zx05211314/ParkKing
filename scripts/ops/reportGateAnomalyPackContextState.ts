import { extractDistrictDiff } from './reportGateAnomalyIssues'
import type { GateAnomalyPackContext } from './reportGateAnomalyContextTypes'
import type { GateAnomalyResolvedPackPaths } from './reportGateAnomalyPackContextPaths'

export const buildGateAnomalyPackContext = (
  params: GateAnomalyResolvedPackPaths & {
    meta: Record<string, unknown>
    prevPublishedAt: string | null
    nextPublishedAt: string | null
    prevDistrictIds: string[]
    nextDistrictIds: string[]
  },
): GateAnomalyPackContext => ({
  districtId: params.districtId,
  packPath: params.packPath,
  outPath: params.outPath,
  meta: params.meta,
  diffReportPath: params.diffReportPath,
  districtDiff: extractDistrictDiff(params.diffReport, params.districtId),
  prevPackPath: params.prevPackPath,
  nextPackPath: params.nextPackPath,
  prevPublishedAt: params.prevPublishedAt,
  nextPublishedAt: params.nextPublishedAt,
  prevDistrictIds: params.prevDistrictIds,
  nextDistrictIds: params.nextDistrictIds,
})
