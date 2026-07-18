import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export const readBaselineJson = async <T>(filePath: string): Promise<T> => {
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as T
}

export const findBaselineDatasetDir = async (
  districtId: string,
  generatedRoot = 'public/data/generated',
) => {
  const root = path.resolve(generatedRoot)
  const candidate = path.join(root, districtId)
  try {
    await fs.access(candidate)
    return candidate
  } catch {
    throw new Error(`Dataset directory not found for ${districtId} under ${root}`)
  }
}
