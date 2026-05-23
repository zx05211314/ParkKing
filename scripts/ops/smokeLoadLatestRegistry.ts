import * as path from 'node:path'
import { readSmokeLoadLatestJson } from './smokeLoadLatestFiles'
import { collectExpectedDistrictErrors } from './smokeLoadLatestValidation'
import type {
  SmokeLoadLatestRegistry,
  SmokeLoadLatestRegistryEntry,
} from './smokeLoadLatestTypes'

export const loadSmokeLoadLatestRegistry = async (params: {
  baseDir: string
  expectedDistricts: string[]
}): Promise<SmokeLoadLatestRegistryEntry[]> => {
  const registryPath = path.resolve(params.baseDir, 'registry.json')
  const registry = await readSmokeLoadLatestJson<SmokeLoadLatestRegistry>(registryPath)
  const districts = registry.districts ?? []

  if (params.expectedDistricts.length === 0 && districts.length < 2) {
    throw new Error(`Expected >= 2 districts in registry, got ${districts.length}`)
  }

  if (params.expectedDistricts.length > 0) {
    const registryDistrictIds = new Set<string>(
      districts
        .map((entry) => entry.districtId?.trim())
        .filter((entry): entry is string => Boolean(entry)),
    )
    const expectedErrors = await collectExpectedDistrictErrors({
      baseDir: params.baseDir,
      expectedDistricts: params.expectedDistricts,
      registryDistrictIds,
    })
    if (expectedErrors.length > 0) {
      throw new Error(`Expected district checks failed:\n${expectedErrors.join('\n')}`)
    }
  }

  return districts
}
