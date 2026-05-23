import * as path from 'node:path'

import {
  detectMetricsPackLayout,
  resolvePreviousMetricsPackDir,
} from './writeMetricsHistoryFiles'
import type {
  PackLayout,
  WriteMetricsHistoryParams,
} from './writeMetricsHistoryTypes'

export interface MetricsHistoryRunState {
  packDir: string
  packLayout: PackLayout
  prevPackDir: string | null
  prevLayout: PackLayout | null
  packId: string
  districtIds: string[]
}

export const resolveMetricsHistoryRunState = async (
  params: WriteMetricsHistoryParams,
): Promise<MetricsHistoryRunState> => {
  const packDir = path.resolve(params.packDir)
  const packLayout = await detectMetricsPackLayout(packDir)
  let prevPackDir = params.prevPackDir ? path.resolve(params.prevPackDir) : null

  if (!prevPackDir) {
    prevPackDir = await resolvePreviousMetricsPackDir(packDir)
  }

  const prevLayout = prevPackDir ? await detectMetricsPackLayout(prevPackDir) : null
  const packId = path.basename(packDir)
  const districtIds = Array.from(packLayout.districts.keys()).sort((a, b) =>
    a.localeCompare(b),
  )

  return {
    packDir,
    packLayout,
    prevPackDir,
    prevLayout,
    packId,
    districtIds,
  }
}
