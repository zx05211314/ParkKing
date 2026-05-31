import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const SYSTEM_DIRS = new Set(['_ops', '.staging', '.backup'])

export const smokePublicDataFileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const smokePublicDataDirectoryExists = async (dirPath: string) => {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

export const readSmokePublicRegistryDistrictIds = async (baseDir: string) => {
  const registryPath = path.resolve(baseDir, 'registry.json')
  if (!(await smokePublicDataFileExists(registryPath))) {
    return null
  }

  const raw = await fs.readFile(registryPath, 'utf-8')
  const parsed = JSON.parse(raw) as {
    districts?: Array<{ districtId?: string }>
  }

  const ids = Array.from(
    new Set(
      (parsed.districts ?? [])
        .map((entry) => entry.districtId?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  )

  return ids.sort((a, b) => a.localeCompare(b))
}

export const listSmokePublicDistrictDirs = async (baseDir: string) => {
  const entries = await fs.readdir(baseDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.') && !SYSTEM_DIRS.has(name))
    .sort((a, b) => a.localeCompare(b))
}
