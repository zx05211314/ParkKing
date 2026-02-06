import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { getDatasetBaseDir } from '../datasetResolver'

interface LoadGeoJsonOptions {
  baseDir?: string
  datasetId?: string
}

export const loadGeoJson = async <T>(
  filePath: string,
  options: LoadGeoJsonOptions = {},
): Promise<T> => {
  const baseDir =
    options.baseDir ?? getDatasetBaseDir(options.datasetId)
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(baseDir, filePath)
  const raw = await readFile(resolvedPath, 'utf-8')
  const sanitized = raw.replace(/^\uFEFF/, '')
  return JSON.parse(sanitized) as T
}
