import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSmokePublicDataArgs } from './smokePublicDataArgs'
import {
  listSmokePublicDistrictDirs,
  readSmokePublicRegistryDistrictIds,
  smokePublicDataDirectoryExists,
} from './smokePublicDataFiles'
import {
  buildSmokePublicDistrictIds,
  validateSmokePublicDataDistricts,
} from './smokePublicDataValidation'

export interface SmokePublicDataOptions {
  baseDir?: string
}

export const runSmokePublicData = async (options: SmokePublicDataOptions = {}) => {
  const baseDir = path.resolve(options.baseDir ?? 'public/data/generated')

  if (!(await smokePublicDataDirectoryExists(baseDir))) {
    throw new Error(`Public data directory missing: ${baseDir}`)
  }

  const registryDistrictIds = await readSmokePublicRegistryDistrictIds(baseDir)
  if (registryDistrictIds === null) {
    console.warn(`WARN: registry.json missing at ${path.resolve(baseDir, 'registry.json')}`)
  }

  const dirDistrictIds = await listSmokePublicDistrictDirs(baseDir)
  const districtIds = buildSmokePublicDistrictIds(registryDistrictIds, dirDistrictIds)

  if (districtIds.length === 0) {
    console.warn(`WARN: no district folders found under ${baseDir}`)
    return { baseDir, districtIds, registryFound: registryDistrictIds !== null }
  }

  const errors = await validateSmokePublicDataDistricts({
    baseDir,
    districtIds,
    registryDistrictIds,
  })

  if (errors.length > 0) {
    throw new Error(`Public data smoke failed:\n${errors.join('\n')}`)
  }

  console.log(`Public data smoke ok: ${districtIds.length} district(s)`)
  return { baseDir, districtIds, registryFound: registryDistrictIds !== null }
}

const run = async () => {
  const args = parseSmokePublicDataArgs(process.argv)
  await runSmokePublicData({ baseDir: args.baseDir ?? undefined })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
