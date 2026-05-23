import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export const readBaselineJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export const findBaselineDatasetDir = async (districtId: string) => {
  const candidates = [
    path.resolve('data/generated', districtId),
    path.resolve('public/data/generated', districtId),
  ]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  throw new Error(`Dataset directory not found for ${districtId}`)
}
