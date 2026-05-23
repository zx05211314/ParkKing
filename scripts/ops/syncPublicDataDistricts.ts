import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const SYSTEM_DIRS = new Set(['_ops', '.staging', '.backup'])

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const isSyncPublicDistrictCandidate = (name: string) => {
  if (name.startsWith('.')) {
    return false
  }
  return !SYSTEM_DIRS.has(name)
}

export const listSyncPublicDistrictIds = async (sourceRoot: string) => {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true })
  const districtIds: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || !isSyncPublicDistrictCandidate(entry.name)) {
      continue
    }
    const metaPath = path.resolve(sourceRoot, entry.name, 'dataset_meta.json')
    if (await fileExists(metaPath)) {
      districtIds.push(entry.name)
    }
  }

  return districtIds.sort((a, b) => a.localeCompare(b))
}
