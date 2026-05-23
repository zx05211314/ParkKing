import * as path from 'node:path'
import fg from 'fast-glob'

export const normalizeRelPath = (baseDir: string, filePath: string) => {
  return path.relative(baseDir, filePath).replace(/\\/g, '/')
}

export const listFiles = async (dir: string): Promise<string[]> => {
  const globRoot = dir.replace(/\\/g, '/')
  const matches = await fg(`${globRoot}/**`, { onlyFiles: true, dot: true })
  return matches.map((entry) => normalizeRelPath(dir, entry))
}
