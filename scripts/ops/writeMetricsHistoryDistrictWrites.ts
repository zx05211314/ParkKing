import * as path from 'node:path'

import { buildMetricsHistoryEntry } from './writeMetricsHistoryEntry'
import { readMetricsHistoryJson } from './writeMetricsHistoryFiles'
import { writeMetricsHistoryFile } from './writeMetricsHistoryStore'
import type { PackLayout } from './writeMetricsHistoryTypes'

export const writeMetricsHistoryDistricts = async (params: {
  packLayout: PackLayout
  prevLayout: PackLayout | null
  packId: string
  districtIds: string[]
}) => {
  const writtenPaths: string[] = []

  for (const districtId of params.districtIds) {
    const districtDir = params.packLayout.districts.get(districtId)
    if (!districtDir) {
      continue
    }
    const metaPath = path.resolve(districtDir, 'dataset_meta.json')
    const meta = await readMetricsHistoryJson<Record<string, unknown>>(metaPath)

    const previousDir = params.prevLayout?.districts.get(districtId)
    const previousHistoryPath = previousDir
      ? path.resolve(previousDir, 'metrics_history.jsonl')
      : null

    const entry = buildMetricsHistoryEntry(meta, params.packId)
    const targetPath = path.resolve(districtDir, 'metrics_history.jsonl')

    await writeMetricsHistoryFile({
      targetPath,
      entry,
      previousPath: previousHistoryPath,
    })
    writtenPaths.push(targetPath)
  }

  return writtenPaths
}
