import * as path from 'node:path'
import {
  smokePublicDataDirectoryExists,
  smokePublicDataFileExists,
} from './smokePublicDataFiles'

export const buildSmokePublicDistrictIds = (
  registryDistrictIds: string[] | null,
  dirDistrictIds: string[],
) =>
  Array.from(new Set([...(registryDistrictIds ?? []), ...dirDistrictIds])).sort((a, b) =>
    a.localeCompare(b),
  )

export const validateSmokePublicDataDistricts = async (params: {
  baseDir: string
  districtIds: string[]
  registryDistrictIds: string[] | null
}) => {
  const { baseDir, districtIds, registryDistrictIds } = params
  const errors: string[] = []

  if (registryDistrictIds !== null) {
    for (const districtId of registryDistrictIds) {
      const districtDir = path.resolve(baseDir, districtId)
      if (!(await smokePublicDataDirectoryExists(districtDir))) {
        errors.push(`[${districtId}] folder missing at ${districtDir}`)
      }
    }
  }

  for (const districtId of districtIds) {
    const districtDir = path.resolve(baseDir, districtId)
    if (!(await smokePublicDataDirectoryExists(districtDir))) {
      continue
    }

    const metaPath = path.resolve(districtDir, 'dataset_meta.json')
    if (!(await smokePublicDataFileExists(metaPath))) {
      errors.push(`[${districtId}] dataset_meta.json missing at ${metaPath}`)
    }
  }

  return errors
}
