import * as path from 'node:path'
import { hashFile, type FileEntry } from './diffPackHashing'
import { listFiles } from './diffPackListing'

export const buildFileMap = async (
  dir: string,
  metaFiles: Record<string, FileEntry> | null,
): Promise<Map<string, FileEntry>> => {
  const entries = await listFiles(dir)
  entries.sort((a, b) => a.localeCompare(b))
  const result = new Map<string, FileEntry>()

  for (const relPath of entries) {
    const metaEntry = metaFiles?.[relPath]
    if (
      metaEntry &&
      typeof metaEntry.sha256 === 'string' &&
      typeof metaEntry.bytes === 'number'
    ) {
      result.set(relPath, { sha256: metaEntry.sha256, bytes: metaEntry.bytes })
    } else {
      const filePath = path.resolve(dir, relPath)
      result.set(relPath, await hashFile(filePath))
    }
  }

  return result
}
