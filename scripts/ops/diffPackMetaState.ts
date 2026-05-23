import * as path from 'node:path'
import { fileExists, readJson } from './diffPackJson'
import type { FileEntry } from './diffPackHashing'

export const readMeta = async (
  dir: string,
): Promise<Record<string, unknown> | null> => {
  const metaPath = path.resolve(dir, 'dataset_meta.json')
  if (!(await fileExists(metaPath))) {
    return null
  }
  try {
    return await readJson<Record<string, unknown>>(metaPath)
  } catch {
    return null
  }
}

export const getMetaFiles = (meta: Record<string, unknown> | null) => {
  if (!meta || typeof meta !== 'object') {
    return null
  }
  const files = meta.files
  if (!files || typeof files !== 'object') {
    return null
  }
  return files as Record<string, FileEntry>
}
