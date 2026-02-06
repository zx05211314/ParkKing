import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface SmokePublicDataOptions {
  baseDir?: string
}

const SYSTEM_DIRS = new Set(['_ops', '.staging', '.backup'])

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const baseIndex = args.findIndex((arg) => arg === '--baseDir')
  return {
    baseDir: baseIndex >= 0 ? args[baseIndex + 1] ?? null : null,
  }
}

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const directoryExists = async (dirPath: string) => {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

const readRegistryDistrictIds = async (baseDir: string) => {
  const registryPath = path.resolve(baseDir, 'registry.json')
  if (!(await fileExists(registryPath))) {
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

const listDistrictDirs = async (baseDir: string) => {
  const entries = await fs.readdir(baseDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.') && !SYSTEM_DIRS.has(name))
    .sort((a, b) => a.localeCompare(b))
}

export const runSmokePublicData = async (options: SmokePublicDataOptions = {}) => {
  const baseDir = path.resolve(options.baseDir ?? 'public/data/generated')

  if (!(await directoryExists(baseDir))) {
    throw new Error(`Public data directory missing: ${baseDir}`)
  }

  const registryDistrictIds = await readRegistryDistrictIds(baseDir)
  if (registryDistrictIds === null) {
    console.warn(`WARN: registry.json missing at ${path.resolve(baseDir, 'registry.json')}`)
  }

  const dirDistrictIds = await listDistrictDirs(baseDir)
  const districtIds = Array.from(
    new Set([...(registryDistrictIds ?? []), ...dirDistrictIds]),
  ).sort((a, b) => a.localeCompare(b))

  if (districtIds.length === 0) {
    console.warn(`WARN: no district folders found under ${baseDir}`)
    return { baseDir, districtIds, registryFound: registryDistrictIds !== null }
  }

  const errors: string[] = []

  if (registryDistrictIds !== null) {
    for (const districtId of registryDistrictIds) {
      const districtDir = path.resolve(baseDir, districtId)
      if (!(await directoryExists(districtDir))) {
        errors.push(`[${districtId}] folder missing at ${districtDir}`)
      }
    }
  }

  for (const districtId of districtIds) {
    const districtDir = path.resolve(baseDir, districtId)
    if (!(await directoryExists(districtDir))) {
      continue
    }

    const metaPath = path.resolve(districtDir, 'dataset_meta.json')
    if (!(await fileExists(metaPath))) {
      errors.push(`[${districtId}] dataset_meta.json missing at ${metaPath}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Public data smoke failed:\n${errors.join('\n')}`)
  }

  console.log(`Public data smoke ok: ${districtIds.length} district(s)`)
  return { baseDir, districtIds, registryFound: registryDistrictIds !== null }
}

const run = async () => {
  const args = parseArgs(process.argv)
  await runSmokePublicData({ baseDir: args.baseDir ?? undefined })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
