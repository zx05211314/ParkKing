import { readViteEnv } from '../api/client'

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.document !== 'undefined'

type RuntimeEnv = Record<string, string | undefined>

const getRuntimeEnv = (): RuntimeEnv | null =>
  (globalThis as typeof globalThis & { process?: { env?: RuntimeEnv } }).process
    ?.env ?? null

const getViteDatasetDir = () => {
  return readViteEnv().VITE_DATASET_DIR ?? null
}

const getViteDataBaseUrl = () => {
  const value = readViteEnv().VITE_DATA_BASE_URL
  if (!value) {
    return null
  }
  const trimmed = value.trim().replace(/\/+$/g, '')
  return trimmed.length > 0 ? trimmed : null
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

export const getDatasetRootDir = (): string => {
  if (isBrowser()) {
    const baseUrl = getViteDataBaseUrl()
    if (baseUrl) {
      return `${baseUrl}/data/generated`
    }
    const viteDir = getViteDatasetDir()
    if (viteDir && viteDir.length > 0) {
      return viteDir
    }
    return '/data/generated'
  }

  const runtimeEnv = getRuntimeEnv()
  if (runtimeEnv?.DATASET_DIR) {
    return runtimeEnv.DATASET_DIR
  }

  const isTestEnv =
    Boolean(runtimeEnv?.VITEST) || runtimeEnv?.NODE_ENV === 'test'

  if (isTestEnv) {
    return 'tests/fixtures'
  }

  return 'public/data/generated'
}

export const getDataBaseUrl = (): string | null => {
  if (!isBrowser()) {
    return null
  }
  return getViteDataBaseUrl()
}

export const getDatasetBaseDir = (datasetId?: string): string => {
  const normalizedId = normalizeDatasetId(datasetId)
  if (isBrowser()) {
    const baseUrl = getViteDataBaseUrl()
    if (baseUrl) {
      return joinBaseDir(`${baseUrl}/data/generated`, normalizedId)
    }
    const viteDir = getViteDatasetDir()
    if (viteDir && viteDir.length > 0) {
      return joinBaseDir(viteDir, normalizedId)
    }
    return joinBaseDir('/data/generated', normalizedId)
  }

  const runtimeEnv = getRuntimeEnv()
  if (runtimeEnv?.DATASET_DIR) {
    return joinBaseDir(runtimeEnv.DATASET_DIR, normalizedId)
  }

  const isTestEnv =
    Boolean(runtimeEnv?.VITEST) || runtimeEnv?.NODE_ENV === 'test'

  if (isTestEnv) {
    return joinBaseDir('tests/fixtures', normalizedId)
  }

  return joinBaseDir('public/data/generated', normalizedId)
}
