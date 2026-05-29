import fg from 'fast-glob'
import { relativeCompat } from './pathCompat'

export const normalizeRelPath = (baseDir: string, filePath: string) => {
  return relativeCompat(baseDir, filePath).replace(/\\/g, '/')
}

export const listFiles = async (dir: string): Promise<string[]> => {
  const globRoot = dir.replace(/\\/g, '/')
  const matches = await fg(`${globRoot}/**`, { onlyFiles: true, dot: true })
  return matches.map((entry) => normalizeRelPath(dir, entry))
}
