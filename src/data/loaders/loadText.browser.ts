import { getDatasetBaseDir } from '../datasetResolver'
import { fetchDatasetResource } from './fetchDatasetResource.browser'

interface LoadTextOptions {
  baseDir?: string
  datasetId?: string
}

const joinUrl = (baseDir: string, filePath: string) => {
  const base = baseDir.replace(/\/+$/g, '')
  const file = filePath.replace(/^\/+/, '')
  return base ? `${base}/${file}` : filePath
}

export const loadText = async (
  filePath: string,
  options: LoadTextOptions = {},
): Promise<string> => {
  const baseDir = options.baseDir ?? getDatasetBaseDir(options.datasetId)
  const url = baseDir.startsWith('http')
    ? new URL(filePath, baseDir.endsWith('/') ? baseDir : `${baseDir}/`).toString()
    : joinUrl(baseDir, filePath)
  return fetchDatasetResource(url, {
    init: { cache: 'no-store' },
    read: (response) => response.text(),
  })
}
