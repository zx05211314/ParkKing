import * as path from 'node:path'
import { fileExists } from './diffPackFiles'
import { DEFAULT_DATASET_ROOTS } from './reportGateAnomalyConstants'

export const resolvePackPath = async (districtId: string, packPath: string | null) => {
  if (packPath) {
    const resolved = path.resolve(packPath)
    if (await fileExists(path.resolve(resolved, 'dataset_meta.json'))) {
      return resolved
    }
    const nested = path.resolve(resolved, districtId)
    if (await fileExists(path.resolve(nested, 'dataset_meta.json'))) {
      return nested
    }
    throw new Error(`Could not locate dataset_meta.json in pack path: ${packPath}`)
  }

  for (const root of DEFAULT_DATASET_ROOTS) {
    const candidate = path.resolve(root, districtId)
    if (await fileExists(path.resolve(candidate, 'dataset_meta.json'))) {
      return candidate
    }
  }

  throw new Error(`Could not locate latest published pack for district: ${districtId}`)
}

export const resolveDistrictMetaPath = async (
  packPath: string | null,
  districtId: string,
) => {
  if (!packPath) {
    return null
  }
  const directMeta = path.resolve(packPath, 'dataset_meta.json')
  if (await fileExists(directMeta)) {
    return directMeta
  }
  const nestedMeta = path.resolve(packPath, districtId, 'dataset_meta.json')
  if (await fileExists(nestedMeta)) {
    return nestedMeta
  }
  return null
}
