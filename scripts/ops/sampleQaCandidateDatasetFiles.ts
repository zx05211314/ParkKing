import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { REQUIRED_DATASET_FILES } from './sampleQaCandidateTypes'

export const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const hasRequiredDatasetFiles = async (dirPath: string) => {
  for (const fileName of REQUIRED_DATASET_FILES) {
    const target = path.resolve(dirPath, fileName)
    if (!(await fileExists(target))) {
      return false
    }
  }
  return true
}

export const resolveDistrictDatasetDir = async (
  districtId: string,
  datasetRoots: string[],
) => {
  for (const root of datasetRoots) {
    const candidate = path.resolve(root, districtId)
    if (await hasRequiredDatasetFiles(candidate)) {
      return candidate
    }
  }
  return null
}
