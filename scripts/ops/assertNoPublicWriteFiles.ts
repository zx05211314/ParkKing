import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type {
  FileSnapshotEntry,
  PublicWriteSnapshot,
} from './assertNoPublicWriteTypes'

export const listPublicWriteFiles = async (
  baseDir: string,
): Promise<FileSnapshotEntry[]> => {
  try {
    await fs.access(baseDir)
  } catch {
    return []
  }

  const entries: FileSnapshotEntry[] = []
  const walk = async (dirPath: string) => {
    const dirents = await fs.readdir(dirPath, { withFileTypes: true })
    for (const dirent of dirents) {
      const fullPath = path.resolve(dirPath, dirent.name)
      if (dirent.isDirectory()) {
        await walk(fullPath)
      } else if (dirent.isFile()) {
        const stat = await fs.stat(fullPath)
        entries.push({
          path: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
          mtimeMs: stat.mtimeMs,
          size: stat.size,
        })
      }
    }
  }

  await walk(baseDir)
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

export const writePublicWriteSnapshot = async (
  snapshotPath: string,
  snapshot: PublicWriteSnapshot,
) => {
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true })
  await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8')
}

export const loadPublicWriteSnapshot = async (
  snapshotPath: string,
): Promise<PublicWriteSnapshot> => {
  const raw = await fs.readFile(snapshotPath, 'utf-8')
  return JSON.parse(raw) as PublicWriteSnapshot
}
