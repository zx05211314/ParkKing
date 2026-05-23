import * as path from 'node:path'
import { fileExists } from './publishGateFiles'

export const listPublishGateDatasetDirCandidates = (
  districtId: string,
  datasetRootDir?: string,
) => {
  const candidates: string[] = []
  if (datasetRootDir) {
    candidates.push(path.resolve(datasetRootDir, districtId))
  }
  candidates.push(path.resolve(process.cwd(), 'public/data/generated', districtId))
  candidates.push(path.resolve(process.cwd(), 'data/generated', districtId))
  return candidates
}

export const resolvePublishGateDatasetDir = async (
  districtId: string,
  datasetRootDir?: string,
) => {
  let fallback: string | null = null

  for (const candidate of listPublishGateDatasetDirCandidates(
    districtId,
    datasetRootDir,
  )) {
    if (await fileExists(candidate)) {
      const metaPath = path.resolve(candidate, 'dataset_meta.json')
      if (await fileExists(metaPath)) {
        return candidate
      }
      if (!fallback) {
        fallback = candidate
      }
    }
  }

  return fallback
}
