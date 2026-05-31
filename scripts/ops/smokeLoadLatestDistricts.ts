import * as path from 'node:path'
import {
  readSmokeLoadLatestJson,
  smokeLoadLatestDirectoryExists,
  smokeLoadLatestFileExists,
} from './smokeLoadLatestFiles'
import { ensureSmokeLoadLatestBoundaryFields } from './smokeLoadLatestValidation'
import type { SmokeLoadLatestRegistryEntry } from './smokeLoadLatestTypes'

export const verifySmokeLoadLatestDistricts = async (params: {
  baseDir: string
  districts: SmokeLoadLatestRegistryEntry[]
  pointerFileName: string
}) => {
  for (const entry of params.districts) {
    const districtId = entry.districtId
    if (!districtId) {
      throw new Error('Registry entry missing districtId')
    }

    const districtDir = path.resolve(params.baseDir, districtId)
    if (!(await smokeLoadLatestDirectoryExists(districtDir))) {
      throw new Error(`Registry district folder missing for ${districtId}: ${districtDir}`)
    }

    const metaPath = path.resolve(districtDir, 'dataset_meta.json')
    if (!(await smokeLoadLatestFileExists(metaPath))) {
      throw new Error(`Registry district dataset_meta missing for ${districtId}: ${metaPath}`)
    }
    const meta = await readSmokeLoadLatestJson<Record<string, unknown>>(metaPath)
    ensureSmokeLoadLatestBoundaryFields(meta, districtId)

    const latestPath = path.resolve(districtDir, params.pointerFileName)
    const latest = await readSmokeLoadLatestJson<{ manifestPath?: string }>(latestPath)
    if (!latest.manifestPath) {
      throw new Error(`${params.pointerFileName} missing manifestPath for ${districtId}`)
    }

    const manifestPath = path.resolve(params.baseDir, latest.manifestPath)
    const manifest = await readSmokeLoadLatestJson<Record<string, unknown>>(manifestPath)
    if (manifest.districtId && manifest.districtId !== districtId) {
      throw new Error(`Manifest districtId mismatch for ${districtId}`)
    }
  }
}
