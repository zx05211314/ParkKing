import { getDatasetBaseDir } from '../datasetResolver'
import { fetchDatasetResource } from './fetchDatasetResource.browser'

interface LoadGeoJsonOptions {
  baseDir?: string
  datasetId?: string
}

const joinUrl = (baseDir: string, filePath: string) => {
  const base = baseDir.replace(/\/+$/g, '')
  const file = filePath.replace(/^\/+/, '')
  return base ? `${base}/${file}` : filePath
}

export const loadGeoJson = async <T>(
  filePath: string,
  options: LoadGeoJsonOptions = {},
): Promise<T> => {
  const baseDir =
    options.baseDir ?? getDatasetBaseDir(options.datasetId)

  const url = baseDir.startsWith('http')
    ? new URL(filePath, baseDir.endsWith('/') ? baseDir : `${baseDir}/`).toString()
    : joinUrl(baseDir, filePath)
  return fetchDatasetResource<T>(url, {
    init: { cache: 'no-store' },
    read: (response) => response.json() as Promise<T>,
  })
}
