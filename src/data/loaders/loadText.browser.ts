import { getDatasetBaseDir } from '../datasetResolver'

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
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`)
  }
  return response.text()
}
