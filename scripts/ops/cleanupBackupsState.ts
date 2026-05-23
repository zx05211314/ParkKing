import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import {
  parseDistrictId,
  type BackupEntryInfo,
} from './cleanupBackupsRetention'

export const listCleanupDirectories = async (dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
}

export const loadCleanupBackupGroups = async (backupRoot: string) => {
  const grouped: Record<string, BackupEntryInfo[]> = {}
  const backupDirs = await listCleanupDirectories(backupRoot)

  for (const name of backupDirs) {
    const fullPath = path.resolve(backupRoot, name)
    const stat = await fs.stat(fullPath)
    const districtId = parseDistrictId(name)
    grouped[districtId] = grouped[districtId] ?? []
    grouped[districtId].push({ name, mtimeMs: stat.mtimeMs })
  }

  return grouped
}

export const loadCleanupStagingEntries = async (stagingRoot: string) => {
  const entries: BackupEntryInfo[] = []
  const stagingDirs = await listCleanupDirectories(stagingRoot)

  for (const name of stagingDirs) {
    const fullPath = path.resolve(stagingRoot, name)
    const stat = await fs.stat(fullPath)
    entries.push({ name, mtimeMs: stat.mtimeMs })
  }

  return entries
}
