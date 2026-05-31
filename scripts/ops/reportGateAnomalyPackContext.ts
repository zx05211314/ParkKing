import * as path from 'node:path'
import { readJson } from './diffPackFiles'
import { listDistrictIdsInPack, readPublishedAt } from './reportGateAnomalyPack'
import { buildGateAnomalyPackContext } from './reportGateAnomalyPackContextState'
import { resolveGateAnomalyPackPaths } from './reportGateAnomalyPackContextPaths'
import type { GateAnomalyPackContext } from './reportGateAnomalyContextTypes'

export const loadGateAnomalyPackContext = async (params: {
  districtId: string
  packPath?: string | null
  outPath?: string | null
}): Promise<GateAnomalyPackContext> => {
  const resolvedPaths = await resolveGateAnomalyPackPaths(params)
  const metaPath = path.resolve(resolvedPaths.packPath, 'dataset_meta.json')
  const meta = await readJson<Record<string, unknown>>(metaPath)

  const [prevPublishedAt, nextPublishedAt, prevDistrictIds, nextDistrictIds] =
    await Promise.all([
      readPublishedAt(resolvedPaths.prevPackPath, resolvedPaths.districtId),
      readPublishedAt(resolvedPaths.nextPackPath, resolvedPaths.districtId),
      listDistrictIdsInPack(resolvedPaths.prevPackPath),
      listDistrictIdsInPack(resolvedPaths.nextPackPath),
    ])

  return buildGateAnomalyPackContext({
    ...resolvedPaths,
    meta,
    prevPublishedAt,
    nextPublishedAt,
    prevDistrictIds,
    nextDistrictIds,
  })
}
