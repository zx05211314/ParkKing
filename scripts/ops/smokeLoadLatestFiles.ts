import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export const readSmokeLoadLatestJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export const smokeLoadLatestFileExists = async (filePath: string) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

export const smokeLoadLatestDirectoryExists = async (dirPath: string) => {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

export const resolveSmokeLoadLatestDatasetRoot = (datasetRoot?: string) => {
  const root = datasetRoot ?? process.env.DATASET_DIR ?? 'public/data/generated'
  return path.resolve(root)
}
