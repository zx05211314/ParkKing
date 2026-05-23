import * as path from 'node:path'

import {
  readSmokeLoadLatestJson,
  smokeLoadLatestDirectoryExists,
  smokeLoadLatestFileExists,
} from './smokeLoadLatestFiles'

export const ensureSmokeLoadLatestBoundaryFields = (
  meta: Record<string, unknown>,
  districtId: string,
) => {
  if (meta.districtId && meta.districtId !== districtId) {
    throw new Error(`dataset_meta districtId mismatch for ${districtId}`)
  }
  if (!meta.boundaryCenter || !meta.boundaryBBox) {
    throw new Error(`boundaryCenter/boundaryBBox missing for ${districtId}`)
  }
}

export const collectExpectedDistrictErrors = async (params: {
  baseDir: string
  expectedDistricts: string[]
  registryDistrictIds: Set<string>
}) => {
  const errors: string[] = []

  for (const districtId of params.expectedDistricts) {
    const districtDir = path.resolve(params.baseDir, districtId)
    const metaPath = path.resolve(districtDir, 'dataset_meta.json')

    if (!params.registryDistrictIds.has(districtId)) {
      errors.push(`[${districtId}] registry missing in registry.json`)
    }

    const hasFolder = await smokeLoadLatestDirectoryExists(districtDir)
    if (!hasFolder) {
      errors.push(`[${districtId}] folder missing at ${districtDir}`)
      continue
    }

    if (!(await smokeLoadLatestFileExists(metaPath))) {
      errors.push(`[${districtId}] dataset_meta.json missing at ${metaPath}`)
      continue
    }

    try {
      const meta = await readSmokeLoadLatestJson<Record<string, unknown>>(metaPath)
      if (meta.districtId && meta.districtId !== districtId) {
        errors.push(
          `[${districtId}] dataset_meta.json districtId mismatch: ${String(meta.districtId)}`,
        )
      }
    } catch {
      errors.push(`[${districtId}] dataset_meta.json unreadable at ${metaPath}`)
    }
  }

  return errors
}
