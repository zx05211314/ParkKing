const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.document !== 'undefined'

const getViteDatasetDir = () => {
  const viteEnv = (import.meta as { env?: Record<string, string> }).env
  return viteEnv?.VITE_DATASET_DIR ?? null
}

const getViteDataBaseUrl = () => {
  const viteEnv = (import.meta as { env?: Record<string, string> }).env
  const value = viteEnv?.VITE_DATA_BASE_URL
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

  if (typeof process !== 'undefined' && process.env?.DATASET_DIR) {
    return process.env.DATASET_DIR
  }

  const isTestEnv =
    typeof process !== 'undefined' &&
    (process.env.VITEST || process.env.NODE_ENV === 'test')

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

  if (typeof process !== 'undefined' && process.env?.DATASET_DIR) {
    return joinBaseDir(process.env.DATASET_DIR, normalizedId)
  }

  const isTestEnv =
    typeof process !== 'undefined' &&
    (process.env.VITEST || process.env.NODE_ENV === 'test')

  if (isTestEnv) {
    return joinBaseDir('tests/fixtures', normalizedId)
  }

  return joinBaseDir('public/data/generated', normalizedId)
}
