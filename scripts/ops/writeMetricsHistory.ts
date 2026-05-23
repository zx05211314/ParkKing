import { fileURLToPath } from 'node:url'

import { parseWriteMetricsHistoryArgs } from './writeMetricsHistoryArgs'
import { writeMetricsHistoryDistricts } from './writeMetricsHistoryDistrictWrites'
import { resolveMetricsHistoryRunState } from './writeMetricsHistoryRunState'
import type { WriteMetricsHistoryParams } from './writeMetricsHistoryTypes'

export type { MetricsHistoryEntry } from './writeMetricsHistoryTypes'

export const writeMetricsHistory = async (params: WriteMetricsHistoryParams) => {
  const { packLayout, prevLayout, packId, districtIds } =
    await resolveMetricsHistoryRunState(params)
  await writeMetricsHistoryDistricts({
    packLayout,
    prevLayout,
    packId,
    districtIds,
  })
}

const run = async () => {
  const args = parseWriteMetricsHistoryArgs(process.argv)
  if (!args.packDir) {
    throw new Error('Usage: tsx writeMetricsHistory.ts --pack <path> [--prevPack <path>]')
  }
  await writeMetricsHistory({
    packDir: args.packDir,
    prevPackDir: args.prevPackDir ?? undefined,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
