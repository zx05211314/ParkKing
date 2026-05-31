import * as path from 'node:path'
import { diffPacks } from './diffPacks'
import type { PackDiffReport } from './diffPackTypes'
import { fileExists } from './publishGateFiles'
import { readPublishGateJson } from './publishGatePackMetadata'

export const loadStoredPublishGateDiffReport = async (datasetDir: string) => {
  const diffPath = path.resolve(datasetDir, 'diff_report.json')
  if (!(await fileExists(diffPath))) {
    return null
  }

  try {
    return await readPublishGateJson<PackDiffReport>(diffPath)
  } catch {
    return null
  }
}

export const loadGeneratedPublishGateDiffReport = async (params: {
  districtId: string
  datasetDir: string
  publishedRootDir?: string | null
  log?: (message: string, error: unknown) => void
}) => {
  if (!params.publishedRootDir) {
    return null
  }

  const prevDir = path.resolve(params.publishedRootDir, params.districtId)
  if (
    prevDir === params.datasetDir ||
    !(await fileExists(path.resolve(prevDir, 'dataset_meta.json')))
  ) {
    return null
  }

  try {
    return await diffPacks({ prevDir, nextDir: params.datasetDir })
  } catch (error) {
    ;(params.log ?? console.warn)('Diff report generation failed:', error)
    return null
  }
}
