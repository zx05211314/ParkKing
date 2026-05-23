import { getDatasetBaseDir, getDatasetRootDir } from '../data/datasetResolver'
import {
  validateRegistryEntry,
  verifyMetaSha256,
  type RegistryEntry,
} from '../data/districtPack'
import type { DatasetOption } from './datasetLoadEffectTypes'

export const loadDatasetRegistryOptions = async (
  datasetId: string | null,
): Promise<{
  options: DatasetOption[]
  nextDatasetId: string | null
} | null> => {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return null
  }

  const rootDir = getDatasetRootDir().replace(/[\\/]+$/g, '')
  const candidates = [`${rootDir}/registry.json`]

  for (const url of candidates) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        continue
      }
      const payload = (await response.json()) as {
        districts?: RegistryEntry[]
      }
      const entries = payload.districts ?? []
      const verifyHashes =
        (import.meta as { env?: Record<string, string> }).env?.VITE_VERIFY_HASHES ===
        '1'
      const validEntries: typeof entries = []
      for (const entry of entries) {
        const validation = validateRegistryEntry(entry)
        if (!validation.valid) {
          continue
        }
        if (verifyHashes) {
          const baseDir = getDatasetBaseDir(entry.districtId)
          const metaCheck = await verifyMetaSha256(baseDir, entry.metaSha256)
          if (!metaCheck.valid) {
            continue
          }
        }
        validEntries.push(entry)
      }
      if (validEntries.length === 0) {
        return null
      }

      const options = validEntries.map((entry) => ({
        id: entry.districtId,
        label: entry.districtName,
      }))

      return {
        options,
        nextDatasetId:
          datasetId && !options.find((option) => option.id === datasetId)
            ? options[0]?.id ?? datasetId
            : datasetId,
      }
    } catch {
      continue
    }
  }

  return null
}
