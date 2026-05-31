import { readFile } from 'node:fs/promises'
import * as path from 'node:path'

interface LoadGeoJsonOptions {
  baseDir?: string
  datasetId?: string
}

const normalizeDatasetId = (datasetId?: string) => {
  if (!datasetId) {
    return 'xinyi'
  }
  const trimmed = datasetId.trim().replace(/^\/+|\/+$/g, '')
  return trimmed.length > 0 ? trimmed : 'xinyi'
}

const joinBaseDir = (baseDir: string, datasetId: string) => {
  const base = baseDir.replace(/\/+$/g, '')
  const id = datasetId.replace(/^\/+|\/+$/g, '')
  if (!id) {
    return base
  }
  if (base.endsWith(`/${id}`) || base === id) {
    return base
  }
  return `${base}/${id}`
}

const getNodeDatasetBaseDir = (datasetId?: string): string => {
  const normalizedId = normalizeDatasetId(datasetId)

  if (process.env.DATASET_DIR) {
    return joinBaseDir(process.env.DATASET_DIR, normalizedId)
  }

  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return joinBaseDir('tests/fixtures', normalizedId)
  }

  return joinBaseDir('public/data/generated', normalizedId)
}

export const loadGeoJson = async <T>(
  filePath: string,
  options: LoadGeoJsonOptions = {},
): Promise<T> => {
  const baseDir = options.baseDir ?? getNodeDatasetBaseDir(options.datasetId)
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(baseDir, filePath)
  const raw = await readFile(resolvedPath, 'utf-8')
  const sanitized = raw.replace(/^\uFEFF/, '')
  return JSON.parse(sanitized) as T
}
