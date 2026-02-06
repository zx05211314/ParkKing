import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface SyncPublicDataOptions {
  sourceDir?: string
  targetDir?: string
}

const SYSTEM_DIRS = new Set(['_ops', '.staging', '.backup'])

const parseArgs = (argv: string[]) => {
  const args = [...argv]
  const sourceIndex = args.findIndex((arg) => arg === '--source')
  const targetIndex = args.findIndex((arg) => arg === '--target')
  return {
    sourceDir: sourceIndex >= 0 ? args[sourceIndex + 1] ?? null : null,
    targetDir: targetIndex >= 0 ? args[targetIndex + 1] ?? null : null,
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

const isDistrictCandidate = (name: string) => {
  if (name.startsWith('.')) {
    return false
  }
  return !SYSTEM_DIRS.has(name)
}

const listDistrictIds = async (sourceRoot: string) => {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true })
  const districtIds: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || !isDistrictCandidate(entry.name)) {
      continue
    }
    const metaPath = path.resolve(sourceRoot, entry.name, 'dataset_meta.json')
    if (await fileExists(metaPath)) {
      districtIds.push(entry.name)
    }
  }

  return districtIds.sort((a, b) => a.localeCompare(b))
}

export const syncPublicData = async (options: SyncPublicDataOptions = {}) => {
  const sourceRoot = path.resolve(options.sourceDir ?? 'data/generated')
  const targetRoot = path.resolve(options.targetDir ?? 'public/data/generated')

  if (!(await fileExists(sourceRoot))) {
    throw new Error(`Source directory not found: ${sourceRoot}`)
  }

  await fs.mkdir(targetRoot, { recursive: true })

  const districtIds = await listDistrictIds(sourceRoot)

  for (const districtId of districtIds) {
    const sourceDir = path.resolve(sourceRoot, districtId)
    const targetDir = path.resolve(targetRoot, districtId)
    await fs.rm(targetDir, { recursive: true, force: true })
    await fs.cp(sourceDir, targetDir, { recursive: true, force: true })
  }

  const registryPath = path.resolve(sourceRoot, 'registry.json')
  if (await fileExists(registryPath)) {
    await fs.copyFile(registryPath, path.resolve(targetRoot, 'registry.json'))
  }

  const reportPath = path.resolve(sourceRoot, 'ingest_all_report.json')
  if (await fileExists(reportPath)) {
    await fs.copyFile(reportPath, path.resolve(targetRoot, 'ingest_all_report.json'))
  }

  console.log(
    `Synced ${districtIds.length} district(s) from ${sourceRoot} to ${targetRoot}`,
  )

  return { sourceRoot, targetRoot, districtIds }
}

const run = async () => {
  const args = parseArgs(process.argv)
  await syncPublicData({
    sourceDir: args.sourceDir ?? undefined,
    targetDir: args.targetDir ?? undefined,
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
