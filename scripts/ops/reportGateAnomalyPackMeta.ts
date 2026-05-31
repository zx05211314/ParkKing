import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileExists, readJson } from './diffPackFiles'
import { resolveDistrictMetaPath } from './reportGateAnomalyPackPaths'

export const readPublishedAt = async (packPath: string | null, districtId: string) => {
  const metaPath = await resolveDistrictMetaPath(packPath, districtId)
  if (!metaPath) {
    return null
  }
  try {
    const meta = await readJson<Record<string, unknown>>(metaPath)
    return typeof meta.publishedAt === 'string' ? meta.publishedAt : null
  } catch {
    return null
  }
}

export const listDistrictIdsInPack = async (packPath: string | null) => {
  if (!packPath) {
    return []
  }
  const directMetaPath = path.resolve(packPath, 'dataset_meta.json')
  if (await fileExists(directMetaPath)) {
    try {
      const meta = await readJson<Record<string, unknown>>(directMetaPath)
      const districtId =
        typeof meta.districtId === 'string' && meta.districtId.trim().length > 0
          ? meta.districtId
          : path.basename(packPath)
      return [districtId]
    } catch {
      return [path.basename(packPath)]
    }
  }

  let entries: Array<{ name: string; isDirectory: () => boolean }> = []
  try {
    entries = await fs.readdir(packPath, { withFileTypes: true })
  } catch {
    return []
  }

  const districtIds: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    if (entry.name.startsWith('.') || entry.name === '_ops') {
      continue
    }
    const metaPath = path.resolve(packPath, entry.name, 'dataset_meta.json')
    if (await fileExists(metaPath)) {
      districtIds.push(entry.name)
    }
  }
  return districtIds.sort((a, b) => a.localeCompare(b))
}
