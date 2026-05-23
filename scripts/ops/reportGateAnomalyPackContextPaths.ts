import * as path from 'node:path'
import type { PackDiffReport } from './diffPackTypes'
import { fileExists } from './diffPackFiles'
import { resolveDiffReport, resolvePackPath } from './reportGateAnomalyPack'
import type { GateAnomalyReport } from './reportGateAnomalyTypes'

const resolveExistingPackPath = async (
  reportedPath: string,
  districtId: string,
  fallbackPath: string,
) => {
  if (
    (await fileExists(path.resolve(reportedPath, 'dataset_meta.json'))) ||
    (await fileExists(path.resolve(reportedPath, districtId, 'dataset_meta.json')))
  ) {
    return reportedPath
  }
  return fallbackPath
}

export interface GateAnomalyResolvedPackPaths {
  districtId: string
  packPath: string
  outPath: string
  diffReportPath: GateAnomalyReport['diffReportPath']
  diffReport: PackDiffReport | null
  prevPackPath: string | null
  nextPackPath: string
}

export const resolveGateAnomalyPackPaths = async (params: {
  districtId: string
  packPath?: string | null
  outPath?: string | null
}): Promise<GateAnomalyResolvedPackPaths> => {
  const districtId = params.districtId.trim()
  if (!districtId) {
    throw new Error('--district <id> is required')
  }

  const packPath = await resolvePackPath(districtId, params.packPath ?? null)
  const outPath = path.resolve(
    params.outPath ?? path.resolve('reports', `gate_anomalies_${districtId}.json`),
  )
  const { path: diffReportPath, report: diffReport } = await resolveDiffReport(
    districtId,
    packPath,
  )
  const reportedPrevPackPath =
    diffReport?.prevPath && diffReport.prevPath.trim().length > 0
      ? path.resolve(diffReport.prevPath)
      : null
  const reportedNextPackPath =
    diffReport?.nextPath && diffReport.nextPath.trim().length > 0
      ? path.resolve(diffReport.nextPath)
      : packPath
  const nextPackPath = await resolveExistingPackPath(
    reportedNextPackPath,
    districtId,
    packPath,
  )

  return {
    districtId,
    packPath,
    outPath,
    diffReportPath,
    diffReport,
    prevPackPath: reportedPrevPackPath,
    nextPackPath,
  }
}
