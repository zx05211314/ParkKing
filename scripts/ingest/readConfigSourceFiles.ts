import * as fs from 'node:fs/promises'
import crypto from 'node:crypto'
import type { ResolvedConfig, SourceFileMeta } from './readConfigTypes'

export const hashString = (value: string) => {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export const collectSourceFiles = async (
  inputs: ResolvedConfig['inputs'],
  optionalFilePaths: string[] = [],
): Promise<SourceFileMeta[]> => {
  const sourceFiles: SourceFileMeta[] = []
  for (const [key, filePath] of Object.entries(inputs)) {
    if (!filePath) {
      continue
    }
    try {
      const stat = await fs.stat(filePath)
      sourceFiles.push({
        path: filePath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      })
    } catch {
      throw new Error(`Input file not found for ${key}: ${filePath}`)
    }
  }
  for (const filePath of optionalFilePaths) {
    try {
      const stat = await fs.stat(filePath)
      sourceFiles.push({
        path: filePath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      })
    } catch {
      continue
    }
  }
  return sourceFiles
}

export const buildConfigHashes = (raw: string, sourceFiles: SourceFileMeta[]) => {
  const configHash = hashString(raw)
  const datasetHash = hashString(JSON.stringify({ configHash, sourceFiles }))
  return { configHash, datasetHash }
}
