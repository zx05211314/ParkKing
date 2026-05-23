import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSyncPublicDataArgs } from './syncPublicDataArgs'
import {
  copySyncPublicArtifacts,
  copySyncPublicDistricts,
} from './syncPublicDataCopy'
import { listSyncPublicDistrictIds } from './syncPublicDataDistricts'

export interface SyncPublicDataOptions {
  sourceDir?: string
  targetDir?: string
}

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const syncPublicData = async (options: SyncPublicDataOptions = {}) => {
  const sourceRoot = path.resolve(options.sourceDir ?? 'data/generated')
  const targetRoot = path.resolve(options.targetDir ?? 'public/data/generated')

  if (!(await fileExists(sourceRoot))) {
    throw new Error(`Source directory not found: ${sourceRoot}`)
  }

  await fs.mkdir(targetRoot, { recursive: true })

  const districtIds = await listSyncPublicDistrictIds(sourceRoot)
  await copySyncPublicDistricts(sourceRoot, targetRoot, districtIds)
  await copySyncPublicArtifacts(sourceRoot, targetRoot)

  console.log(
    `Synced ${districtIds.length} district(s) from ${sourceRoot} to ${targetRoot}`,
  )

  return { sourceRoot, targetRoot, districtIds }
}

const run = async () => {
  const args = parseSyncPublicDataArgs(process.argv)
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
